# Multi-Profile Generation — Feature Proposal

**Status**: 📋 Proposed  
**Created**: 2026-02-16  
**Feature**: Select multiple profiles and generate one tailored resume (and outputs) per profile

---

## 1. Goal

- **Current**: User selects one profile → one generation → one set of outputs (resume, cover, optional QA PDF) under one profile folder.
- **Enhanced**: User can select **multiple profiles** → **one job** (JD), **one Call A** (extraction), then **one generation per profile** → multiple output folders (one per profile), each with its own resume/cover/QA PDFs.

Existing behaviour is preserved: selecting a single profile works exactly as today.

---

## 2. User Experience (UX)

### 2.1 Profile selection

- **Option A (recommended): Multi-select with checkboxes**  
  - Replace single dropdown with a list of profiles, each with a checkbox.  
  - “Select all” / “Clear” optional.  
  - At least one profile must be selected to enable Generate.  
  - Matches “select multiple” mental model and is accessible.

- **Option B: Multi-select dropdown**  
  - Keep dropdown but allow selecting multiple items (e.g. Ctrl+click or checkboxes inside dropdown).  
  - More compact but slightly less obvious for “multiple”.

- **Option C: Single dropdown + “Add another profile”**  
  - Keep current dropdown, add “Add profile” that adds a second (third, …) dropdown or chip.  
  - Clear but more UI complexity.

**Recommendation**: Option A — checkbox list under a “Profiles” label, with optional “Select all” / “Deselect all”.

### 2.2 Persistence

- Persist **selected profile IDs** in localStorage (e.g. `resumeTailor_selectedProfileIds` as JSON array).  
- On load: if one ID, keep current behaviour; if multiple, show multiple checked.  
- No need to persist “multi-select mode” separately; the list of IDs is enough.

### 2.3 Generate button and validation

- **Enable Generate** when: JD non-empty, at least one profile selected, output path set, API key set, not loading.  
- Button label can stay “Generate resume & cover letter” or become “Generate” with subtitle “1 profile” / “3 profiles” when multiple selected.

### 2.4 Progress

- **Single profile**: Keep current progress (e.g. “Extracting…”, “Generating…”, “Rendering PDFs…”).  
- **Multiple profiles**:  
  - **Call A** once: “Extracting job details…”  
  - Then for each profile: “Generating for **Profile Name** (1/3)” … “(2/3)” … “(3/3)”.  
  - Progress bar can be global (e.g. 0–100 over all profiles) or step-based (e.g. “Step 2 of 4: Profile B”).

### 2.5 Results (simplified)

- **No custom multi-profile result UI on the Generate screen.**  
- After a successful run, show a short success message (e.g. “Generated 2 resumes.” or “Generated 2 of 3 profiles; 1 failed.”).  
- **All results are shown in History**: list each generation as its own card (one card per profile). So for 3 selected profiles, the user sees 3 history cards (same job/company/role, different profile name and links). Simple listing, no extra UI.

---

## 3. Technical Approach

### 3.1 Data model (no schema change)

- **Job**: One job per run (same as now). Same `job_id` for all generations in that run.  
- **Generations**: One row per profile. Each has same `job_id`, different `profile_id`, different `output_dir` (and thus different `resume_pdf_path`, `cover_pdf_path`, `qa_pdf_path`).  
- Folder structure already supports this:  
  `{outputRoot}/{baseFolder}/{companyFolder}/{roleFolder}/{profileFolder}/`  
  So we get one folder per profile under the same company/role.

### 3.2 Pipeline strategy: one Call B per profile (recommended)

1. Create **one** job, run **Call A** once (JD extraction).  
2. For **each** selected profile, in sequence:  
   - `buildOutputDirectory(..., profileName: profile.name, ...)`  
   - Run **Call B** for that profile (same `callAResult`, same `jdText`, same `questions`)  
   - Validate Call B output  
   - Render PDFs (resume, cover, QA if applicable) into that profile’s folder  
   - Write JD.txt in that profile’s folder  
   - Create **one generation** row for that profile  
   - Update progress: “Profile X (i/N)”

**Benefits**: No duplicate Call A; one job, N generations; clear progress; same code paths as today per profile.  
**JD.txt**: Write in **each profile folder** so each folder is self-contained.

---

### 3.2a Design decision: One Call B per profile vs one combined Call B

**Idea (combined Call B):** Send all profile prompts in one request and ask the model to output N resumes + N cover letters in one JSON to reduce input token usage (JD + Call A sent once).

**Recommendation: keep one Call B per profile.** Reasons:

| Concern | One Call B per profile | One combined Call B |
|--------|------------------------|----------------------|
| **Accuracy** | Each profile is independent; no mixing of tone/style between profiles. | One long prompt with N rule sets increases risk of the model mixing profiles or dropping quality for some. |
| **Reliability** | Same proven prompt and schema we use today; failures are isolated to one profile. | One large JSON (N resumes, N cover letters, optional N QA) is more prone to truncation, format errors, and harder to validate. |
| **Retry / errors** | If Call B fails for profile 2, we retry only profile 2; others are already done. | If the single Call B fails, we retry the entire multi-profile output. |
| **Future development** | New features (e.g. new fields, QA) stay per profile; no change to a global “multi-profile schema”. | Any new output type or profile-specific option forces a single, complex schema that grows with N and is harder to evolve. |
| **Token usage** | We repeat (JD + Call A + one profile’s rules) per profile — higher input token cost for N profiles. | We send (JD + Call A + all profiles’ rules) once — lower input tokens, but one large output and the tradeoffs above. |

**Conclusion:** The extra input tokens (repeated JD + Call A) are the cost of keeping behaviour simple, accurate, and easy to extend. If token cost becomes an issue later (e.g. many profiles per run), we can revisit a “batch” Call B with a single structured output for N profiles, accepting the added complexity and risk. For this feature, **one Call B per profile** is the better tradeoff.

### 3.3 API shape

**Backend**

- `runFullGeneration` (or new `runFullGenerationMulti`) accepts **profileIds: string[]** (length ≥ 1).  
- Internally:  
  - If `profileIds.length === 1`: behave exactly as current `runFullGeneration(profileId)`.  
  - If `profileIds.length > 1`: create one job, run Call A once, then for each `profileId` run the “per-profile” block (Call B, validate, render, write, create generation).  
- Return type for multi-profile: e.g. `{ success, jobId, job, extraction, results: Array<{ profileId, profileName, generationId, outputDir, resumePdfPath, coverPdfPath, qaPdfPath, error? }> }`.  
- Generate screen only needs to show a short success (or partial-success) message; detailed results are shown in History (one card per generation).

**IPC / preload**

- `generation:runFull` (or new channel) accepts `profileIds: string[]` instead of (or in addition to) `profileId: string`.  
- If only `profileId` is sent (backward compatibility), treat as `profileIds: [profileId]`.

### 3.4 Error handling

- **Call A fails**: Same as now — return error, no generations created.  
- **Call B fails for profile N**:  
  - **Strict**: Abort entire run, return error, optionally mark job as failed (no generations or only generations 1..N-1 if already committed).  
  - **Best-effort**: Continue with other profiles; at the end return `success: true` plus a list of `warnings` or `partialFailures` (e.g. `{ profileId, profileName, error }`). UI shows “Generated 2 of 3 profiles” and which one failed.  

**Recommendation**: Best-effort so one bad profile doesn’t block the rest; surface failures clearly in the result.

### 3.5 Backward compatibility

- **UI**: If only one profile is selected, treat it exactly as today (single result block, same links).  
- **API**: Accept either `profileId: string` or `profileIds: string[]`; if `profileId` provided, convert to `profileIds: [profileId]` internally.  
- **History**: Show **one card per generation** (not one per job). So for a run with 3 profiles, the user sees 3 history cards — same company/role, each card with its profile name and its own Open folder / Open Resume PDF / etc. Simple listing, no extra UI. Requires History to list by generation (or to show one row per generation when a job has multiple generations); no DB schema change.

---

## 4. Implementation Outline

### Phase 1: Backend — multi-profile pipeline

- [ ] Add `runFullGenerationMulti(params: { ...; profileIds: string[] })` (or extend `runFullGeneration` to accept `profileIds: string[]` and handle both single and multi).
- [ ] Implement: one job, one Call A; loop over `profileIds`; for each: build output dir, Call B, validate, render PDFs, write JD.txt, create generation record; collect results and optional errors.
- [ ] Return structure: `{ success, jobId, job, extraction, results: Array<{ profileId, profileName, generationId, outputDir, resumePdfPath, coverPdfPath, qaPdfPath, error? }> }`.
- [ ] Progress: extend progress messages for “Generating for X (i/N)” and optional step percentage.

### Phase 2: API and IPC

- [ ] Update IPC handler to accept `profileIds?: string[]` (and keep `profileId?: string` for backward compatibility).
- [ ] Preload and renderer types: accept `profileIds: string[]` (or single `profileId` converted to array).

### Phase 3: Generate screen UI

- [ ] Replace single profile dropdown with checkbox list (or multi-select) for profiles.
- [ ] Persist selected IDs in localStorage; restore on load; ensure at least one selected for Generate.
- [ ] Call API with `profileIds` (array of selected IDs).
- [ ] Result view: show a short success message only (e.g. “Generated 2 resumes.” or “Generated 2 of 3; 1 failed.”). No per-profile links on Generate screen; user uses History to open outputs.

### Phase 4: History

- [ ] History lists **one card per generation** (so multi-profile run shows multiple cards: same job/company/role, each with its profile name and Open folder / PDF links). Adjust query/display so all generations for a job are shown as separate cards instead of only “latest generation per job”.

### Phase 5: Tests and docs

- [ ] Test: one profile → same behaviour as before.
- [ ] Test: two profiles → one job, two generations, two output folders.
- [ ] Test: Call B fails for second profile → first profile’s outputs present, error for second.
- [ ] Update CHANGELOG and feature doc when implemented.

---

## 5. Summary

| Aspect | Proposal |
|--------|----------|
| **Selection** | Multi-select via checkbox list (at least one profile required). |
| **Run** | One job, one Call A, then one Call B + PDFs + generation record per profile. |
| **Output** | One folder per profile under same company/role; each folder self-contained (resume, cover, QA if any, JD.txt). |
| **Progress** | “Generating for Profile X (i/N)”. |
| **Results** | Generate screen: short success message only. History: one card per generation (simple listing; each card has profile name and Open folder / PDF links). |
| **Errors** | Best-effort: continue other profiles, report which profile failed. |
| **Compatibility** | Single-profile selection and API shape preserved; no DB schema change. |

This keeps existing behaviour intact, reuses the current folder and DB model, and adds a clear path to multi-profile generation with minimal risk.
