# Implementation / Development Plan (MVP) — Milestones + Detailed Test Plan (Auto + Manual)

## 0) Conventions
- “Auto tests” = unit + integration tests runnable in CI (no GUI interaction required unless noted)
- “Manual tests” = step-by-step QA checklist for human validation
- Each milestone must ship behind a stable main branch and produce a working installer/dev build.

---

## 1) Milestone 1 — Project Setup, App Shell, and Build Pipeline

### 1.1 Development tasks
- [ ] Initialize Electron + TypeScript repo
- [ ] Add UI framework (React + TS recommended)
- [ ] Configure bundler/build (Vite/Webpack) for renderer
- [ ] Set up electron main process structure:
  - `main/` (Electron main process)
  - `renderer/` (UI)
  - `shared/` (types, schemas, utils)
- [ ] Add code quality tooling:
  - ESLint + Prettier
  - TypeScript strict mode
- [ ] Add packaging tool (electron-builder or electron-forge)
- [ ] Add environment handling:
  - `APP_ENV=development|production`
  - Logging gate (no sensitive logs in prod)

### 1.2 Deliverables
- App opens with a left nav: Generate / History / Profiles / Settings
- Packaging produces a runnable build (Windows)

### 1.3 Automatic tests
**Unit**
- [ ] `sanitizePathSegment()` basic behavior tests (placeholder util created now)
- [ ] `formatDateFolder()` tests (YYYY_MM_DD)

**Integration (node)**
- [ ] “App config read” returns defaults if missing

### 1.4 Manual tests
- [ ] Launch dev build → UI loads without console errors
- [ ] Navigate between screens
- [ ] Package build installs & launches
- [ ] Confirm app data directory created (empty)

---

## 2) Milestone 2 — Config System + Secure API Key Storage

### 2.1 Development tasks
- [ ] Implement config manager:
  - Read/write `{appDataDir}/config.json`
  - Schema + defaults
- [ ] Implement outputRootPath picker in Settings
- [ ] Implement API key storage using OS keychain:
  - Windows Credential Manager / macOS Keychain (library: `keytar`)
- [ ] Add Settings UI fields:
  - outputRootPath
  - jdExtractionModel, resumePayloadModel, fallbackModel
  - retryCountCallA, retryCountCallB, fallbackEnabled
- [ ] Add IPC:
  - `config:get`, `config:set`, `secrets:setKey`, `secrets:clearKey`, `secrets:hasKey`

### 2.2 Deliverables
- User can set outputRootPath and persist across restarts
- User can set/clear API key without storing it in plaintext config/db

### 2.3 Automatic tests
**Unit**
- [ ] Config schema validation tests (missing fields → defaulted)
- [ ] `config:set` writes file atomically (write temp + rename)

**Integration**
- [ ] Config round-trip:
  - set outputRootPath → restart config manager → value persists
- [ ] Secrets adapter mocked tests:
  - setKey → hasKey true → clearKey → hasKey false

### 2.4 Manual tests
- [ ] Settings → set outputRootPath → restart app → value persists
- [ ] Set API key → close app → reopen → “key exists” indicator true
- [ ] Clear key → indicator false

---

## 3) Milestone 3 — SQLite DB + Migrations + Basic History List

### 3.1 Development tasks
- [ ] Add SQLite driver (recommend `better-sqlite3`)
- [ ] Implement migrations with `PRAGMA user_version`
- [ ] Create tables:
  - `profiles`, `jobs`, `generations`
- [ ] Seed default Profile record (initial rules_text + template_html stored exactly as provided)
- [ ] Build basic History screen:
  - list jobs with latest generation status (if any)
- [ ] Add IPC:
  - `db:init`, `history:list`, `jobs:get`, `generation:get`

### 3.2 Deliverables
- DB created at `{appDataDir}/app.db`
- App loads and displays empty history list
- Default profile exists in DB

### 3.3 Automatic tests
**Unit**
- [ ] Migration runner tests:
  - fresh db applies migrations to latest version
  - rerun is idempotent
- [ ] DAO tests (in-memory or temp sqlite file):
  - insert profile → fetch profile
  - insert job → fetch job
  - insert generation → latest generation query works

**Integration**
- [ ] App startup triggers `db:init` and creates db if missing

### 3.4 Manual tests
- [ ] First launch: verify DB file exists
- [ ] Profiles shows seeded default profile
- [ ] History loads (empty)

---

## 4) Milestone 4 — Profiles Feature (CRUD + Editor + Hashing + Validate Button)

### 4.1 Development tasks
- [ ] Profiles list UI:
  - create (clone), edit, archive, set default
- [ ] Profile editor:
  - Rules tab (multiline)
  - Template tab (multiline)
- [ ] Hashing:
  - compute `rules_hash`, `template_hash` (SHA-256) on save
- [ ] Validate button (MVP “static validations” only):
  - rules_text non-empty
  - template_html contains required skeleton markers (e.g., `<html>`, `<body>`)
- [ ] IPC:
  - `profiles:list`, `profiles:create`, `profiles:update`, `profiles:archive`, `profiles:setDefault`, `profiles:validate`

### 4.2 Deliverables
- User can maintain 3+ profiles
- Default profile enforced
- Hashes stored

### 4.3 Automatic tests
**Unit**
- [ ] `sha256()` utility tests
- [ ] Profile DAO tests:
  - create profile stores hashes
  - setDefault flips other profiles off
  - archive excludes from list

**Integration**
- [ ] Seed default profile exists after db init

### 4.4 Manual tests
- [ ] Create new profile by clone → rename → save
- [ ] Set new profile as default → old default removed
- [ ] Archive a profile → no longer selectable in Generate dropdown
- [ ] Validate shows errors for empty rules/template

---

## 5) Milestone 5 — Filesystem Utilities + Output Folder Strategy (No Overwrites)

### 5.1 Development tasks
- [ ] Implement filesystem utility module:
  - `sanitizePathSegment()`
  - `ensureDir()`
  - `versionedFilePath()` (adds `_v2` suffix)
  - `computeBaseFolder(date, tz)` (America/Los_Angeles)
- [ ] Implement output directory builder:
  - `{outputRootPath}/{YYYY_MM_DD}/{companyFolder}/{roleFolder}/{profileFolder}/`
  - `not_specified_{jd_hash_short}` fallback
  - collision rules
- [ ] Add “Open Folder” IPC:
  - `files:openFolder`, `files:openFile`

### 5.2 Deliverables
- Deterministic folder structure with collision-proof naming
- No overwrites (versions always applied)

### 5.3 Automatic tests
**Unit**
- [ ] sanitize tests:
  - removes illegal chars
  - collapses underscores
  - length cap
- [ ] versioned naming tests:
  - existing file → returns `_v2`
  - multiple existing → `_v3`
- [ ] output path computation tests:
  - missing company/title uses `not_specified_{hash}`
  - two different hashes produce different folders

**Integration**
- [ ] create output folder, write dummy files, verify version increments

### 5.4 Manual tests
- [ ] Set outputRootPath
- [ ] Create “fake generation” writes into correct folder
- [ ] Run twice with same output names → `_v2` appears

---

## 6) Milestone 6 — LLM Adapter + Call A (JD Extraction) End-to-End

### 6.1 Development tasks
- [x] Implement LLM adapter:
  - request builder (JSON-only)
  - response parser (strict JSON parse)
  - usage capture (tokens if available)
  - retry/fallback logic per config
- [x] Implement Call A prompt builder:
  - inputs: JD text, selected profile rules_text, optional job URL
  - output: JSON with extraction + contact info
- [x] Persist extraction into `jobs` table
- [x] Update Generate screen:
  - paste JD
  - optional URL input
  - profile dropdown
  - start generation → show progress through Call A
  - show extracted company/title/contact fields immediately after Call A

### 6.2 Deliverables
- [x] JD extraction works and is saved in DB
- [x] Generate UI shows extracted fields

### 6.3 Automatic tests
**Unit**
- [ ] LLM response parsing tests:
  - valid JSON
  - JSON with leading/trailing text → fail (or strict strip once if you implement)
- [ ] Retry logic tests:
  - fail once then succeed
  - fail until fallback triggers

**Integration (mocked HTTP)**
- [ ] Call A success path:
  - mock LLM response → DB updated with extracted fields
- [ ] Contact extraction:
  - JD contains email/phone → stored fields present
  - only generic links → follow_up_links_json = null/empty

### 6.4 Manual tests
- [ ] Paste a JD with:
  - clear company/title → verify extracted
- [ ] Paste a JD with:
  - recruiter email/phone → verify extracted + stored
- [ ] Paste a JD with no company/title → verify UI shows Not specified or blank

---

## 7) Milestone 7 — Call B (Resume Payload + Cover) + Validation Engine (Profile-driven)

### 7.1 Development tasks
- [x] Call B prompt builder:
  - inputs: JD text, profile rules_text, Call A output
  - output: strict JSON with `resume_payload` + `cover_letter_text`
- [x] Implement rule parser (MVP):
  - Parse bullet counts from profile rules_text
  - Parse skills categories list
  - Parse summary opener
  - Parse `<strong>` constraints
  - Parse min skills count
- [x] Implement validation engine:
  - JSON schema checks
  - cover letter sentence count approx 4–5
  - resume_payload object checks (resume HTML after merge in M8)
- [x] Degraded mode:
  - if parsing fails → warn + reduced checks
- [x] Persist generation metadata in DB:
  - models used, fallback reasons, token counts, status success/failed

### 7.2 Deliverables
- [x] Structured output from Call B
- [x] Validation blocks bad output
- [x] Stored generation records include traceability

### 7.3 Automatic tests
**Unit**
- [ ] Rule parser tests using fixture rules_text:
  - extracts bullet counts
  - extracts skills categories
  - detects `<strong>` constraints
- [ ] Validation tests:
  - cover letter sentence count pass/fail
  - `<strong>` in Skills fails
  - bullet count mismatch fails (when parsing succeeds)
  - degraded mode triggers when parsing fails

**Integration (mocked HTTP)**
- [ ] Call B success → DB generation record created
- [ ] Call B invalid JSON → retries → fallback (if enabled) → recorded

### 7.4 Manual tests
- [ ] Run Generate with a JD and default profile:
  - verify UI reaches “Validated” state
- [ ] Force invalid output (temporarily mock response):
  - verify user sees error and generation saved as failed

---

## 8) Milestone 8 — Template Merge + Local PDF Generation (No Server)

### 8.1 Development tasks
- [x] Implement template merge:
  - `resume_payload` → final HTML string based on selected `template_html`
  - Must not modify CSS/layout; only fill placeholders
- [x] Implement cover letter HTML wrapper builder
- [x] Implement PDF renderer:
  - hidden BrowserWindow reuse strategy
  - `printToPDF({ printBackground: true })`
- [ ] Write output files:
  - resume PDF
  - cover PDF
  - JD.txt
- [x] Update Generate UI:
  - show output paths
  - “Open Folder/Open PDF” actions
- [x] Store file paths in `generations`

### 8.2 Deliverables
- [x] End-to-end output artifacts generated and saved correctly
- [x] No local server present

### 8.3 Automatic tests
**Unit**
- [ ] Cover HTML wrapper test:
  - escapes user text safely
- [ ] Template merge tests:
  - required placeholders are replaced
  - output contains `<html>` and expected sections

**Integration (Electron)**
- [ ] PDF generation smoke test:
  - generate small HTML → `printToPDF()` returns non-empty bytes
  - write to temp file → file size > 0
  - (Run in CI only if Electron headless supported; otherwise run as local integration test)

### 8.4 Manual tests
- [ ] Generate on a real JD:
  - resume PDF opens and renders correctly
  - cover PDF opens and renders correctly
  - JD.txt saved
- [ ] Confirm no server process is running
- [ ] Confirm rerun creates `_v2` files, no overwrites

---

## 9) Milestone 9 — History Details, Re-run, and Polishing

### 9.1 Development tasks
- [ ] History search:
  - simple LIKE queries for MVP
  - optional: SQLite FTS later
- [ ] Detail view:
  - show extracted fields
  - show contact info + follow-up links
  - show generation traceability (profile name, hashes, models used, fallback status)
  - show open file/folder
- [ ] “Re-run generation” button:
  - reuse job JD text + optional URL
  - allow selecting another profile for rerun
- [ ] Improve error UX:
  - user-friendly error code categories:
    - `CONFIG_MISSING`
    - `LLM_PARSE_ERROR`
    - `LLM_VALIDATION_ERROR`
    - `PDF_RENDER_ERROR`
    - `FS_WRITE_ERROR`
- [ ] Add safe logging with redaction

### 9.2 Deliverables
- You can find and reopen any application quickly
- Reruns create new generation records and never overwrite old outputs

### 9.3 Automatic tests
**Unit**
- [ ] Search query builder tests (escaping wildcards)
- [ ] Rerun logic tests: new generation_id, new versioned files

**Integration**
- [ ] Create job → generation → rerun → verify 2 generations linked to same job

### 9.4 Manual tests
- [ ] Search by company name
- [ ] Open output folder from history detail
- [ ] Rerun with different profile → outputs stored under new profile folder

---

## 10) Milestone 10 — Release Candidate (Packaging + Regression Suite)

### 10.1 Development tasks
- [ ] Harden installer settings (signing optional MVP)
- [ ] Ensure app updates config/db correctly on version bump
- [ ] Add “diagnostics export” (optional):
  - export last N error logs without JD text
- [ ] Regression test pass

### 10.2 Deliverables
- RC build ready for daily use at high volume

### 10.3 Automatic tests
- [ ] Full unit test suite runs green
- [ ] Integration test suite runs green
- [ ] Lint + typecheck in CI

### 10.4 Manual tests (Regression checklist)
- [ ] Fresh install → set outputRootPath → set API key → generate success
- [ ] Create + switch profiles → generate success
- [ ] Missing company/title → not_specified_{hash} folders created
- [ ] Contact extraction works for email/phone
- [ ] Rerun creates `_v2` files
- [ ] History shows correct records and opens artifacts
- [ ] Failure cases:
  - remove API key → Generate blocked
  - break outputRootPath → shows FS error

---

## 11) Milestone 11 — Base Resume + Multi-Prompt Refactor (Breaking Change)

### 11.1 Goals
- Make **base resume (plain text)** the source of truth per Profile.
- Allow **multiple prompts per Profile** (e.g., Mobile, Web) and select a prompt on the Generate screen.
- Update Call B to return a **structured `resume` object + `cover_letter` + `qa`**, instead of the legacy `resume_payload` blob.
- Preserve existing behavior for **History, PDFs, QA feature, and Settings**.

### 11.2 Development tasks

#### A) Data model & migrations
- [ ] Add `base_resume_text` column to `profiles` (TEXT NOT NULL, default empty string for migration).
- [ ] Create `profile_prompts` table:
  - `prompt_id`, `profile_id`, `name`, `prompt_text`, timestamps, `archived_at`.
  - Index on `profile_id`.
- [ ] Optionally set a **default prompt** for each profile (code-level rule: first non-archived).
- [ ] Wire migrations in `main/db/migrations.ts` and bump `user_version`.

#### B) Shared types & contracts
- [ ] Update `CallBOutput` in `shared/types.ts`:
  - Replace/extend legacy `resume_payload` with `resume` object matching the new schema (summary, skills, experience, freelance, education[], certificates, etc.).
  - Ensure `cover_letter` is a plain-text field.
  - Keep `qa` as `Array<{question: string; answer: string}>` (from QA feature).
- [ ] Update any legacy references to `resume_payload` to use `resume` or to go through a compatibility adapter.

#### C) LLM adapter & prompts
- [ ] Extend `runResumePayload()` in `main/llm/openaiAdapter.ts` to accept:
  - `baseResumeText`
  - `promptText` (selected profile-prompt)
  - `questions?: string[]`
- [ ] Update `buildCallBMessages()` in `main/llm/callBPrompt.ts` to:
  - Include **base resume text** in INPUTS.
  - Include **selected prompt text** as the main instruction block.
  - Keep JD extraction and JD raw text sections.
  - Append questions (if any) exactly as per QA feature spec.
- [ ] Update Call B instructions to request the **new structured `resume` JSON** contract (matching TRD/PRD).

#### D) Pipeline & merge layer
- [ ] Update `runFullGeneration()` and `runOneProfileGeneration()` in `main/generation/pipeline.ts` to:
  - Load `base_resume_text` and selected prompt for the Profile.
  - Pass them into `runResumePayload()`.
- [ ] Update `validateCallBOutput()` in `main/validation/validator.ts` to:
  - Work against the new `resume` structure.
  - Keep QA validation logic intact.
- [ ] Update `buildMergePayloadFromStructuredResume()` and `mergeResumeTemplate()` in `main/pdf/templateMerge.ts` to:
  - Map the new `resume` structure into the default HTML template.
  - Preserve existing `<strong>` constraints behavior for summary/experience and keep Skills plain text.
- [ ] Maintain a **compatibility path** for old generations that still have `resume_payload` (if we need to re-open old outputs).

#### E) Profiles UI & Generate screen
- [ ] Update Profiles screen to:
  - Add a **Base Resume** tab (plain-text editor).
  - Add a **Prompts** tab (list with CRUD for prompts).
- [ ] Update Generate screen to:
  - Show a **Prompt dropdown** after the Profile dropdown.
  - Persist and restore the last-used prompt per Profile (optional).
  - Keep Questions input and QA behavior unchanged.

#### F) History & QA
- [ ] Ensure History detail still shows:
  - Company, role, contact info, follow-up links.
  - Which Profile and **which Prompt** were used (store prompt name or id in generations if needed).
- [ ] Confirm QA PDFs still generate based on `qa` array and are not affected by schema changes.

### 11.3 Automatic tests

**Unit**
- [ ] New migration tests for `base_resume_text` + `profile_prompts`.
- [ ] `CallBOutput` schema tests for the new `resume` structure.
- [ ] Template merge tests that:
  - Convert a sample `resume` JSON (derived from the base resume) into valid HTML.

**Integration (mocked HTTP)**
- [ ] Mock Call B response using new JSON schema:
  - Verify PDFs are generated successfully.
  - Verify QA PDF generation remains intact when questions are present.

### 11.4 Manual tests
- [ ] Create a Profile, paste full base resume, create two prompts (“Mobile”, “Web”).
- [ ] Generate for the same JD with each prompt:
  - Confirm resume content meaningfully differs as per prompt.
  - Confirm cover letter and QA outputs are generated and saved.
- [ ] Restart app and re-open History items:
  - Confirm you can still open Resume, Cover, JD.txt, QA PDFs.
- [ ] Confirm legacy generations (pre-refactor) still appear in History and can open files (even if they used the old payload).

---

# A) Detailed Automatic Test Catalog (Suggested)

## A.1 Unit Test Suites
### A.1.1 `filesystem.test.ts`
- sanitizePathSegment:
  - illegal chars removed
  - whitespace trimmed
  - max length enforced
- versionedFilePath:
  - no conflict returns base name
  - conflict returns `_v2`
  - multiple conflicts returns `_vN`

### A.1.2 `config.test.ts`
- defaults populated on missing keys
- atomic write (write temp then rename)
- outputRootPath required check

### A.1.3 `db.test.ts`
- migrations apply from 0 → latest
- insert/select/update for jobs/profiles/generations
- setDefault enforces single default

### A.1.4 `llmParser.test.ts`
- strict JSON parsing
- parse failure triggers retry
- retry exhaustion triggers fallback (if enabled)

### A.1.5 `rulesParser.test.ts`
- bullet count parsing (company-based and tier-based patterns)
- skills categories extraction
- summary opener extraction
- strong constraints extraction

### A.1.6 `validation.test.ts`
- cover letter sentence count
- strong in Skills rejected
- bullet count mismatch rejected (when parsing succeeds)
- degraded mode allows reduced checks

## A.2 Integration Tests
### A.2.1 `generationPipeline.mocked.test.ts`
- mock Call A response → job updated
- mock Call B response → generation record created
- ensure output paths computed correctly
- ensure versioned files generated in temp directory

### A.2.2 `pdfRenderer.smoke.test.ts` (optional CI)
- render minimal HTML → printToPDF returns bytes → write to disk

---

# B) Detailed Manual Test Scripts (QA)

## B.1 Smoke Test (5 minutes)
1. Launch app
2. Settings → set outputRootPath to a writable folder
3. Settings → set API key
4. Profiles → confirm default exists
5. Generate → paste JD → Generate
6. Open Resume PDF, Cover PDF, and folder

Expected:
- files exist, open correctly, no errors.

## B.2 Missing Company/Role Collision Test
1. Paste JD that lacks clear company/title → Generate
2. Paste another JD also lacking company/title → Generate

Expected:
- folders differ by `not_specified_{hash}` and do not overwrite.

## B.3 File Versioning Test
1. Generate same JD twice (same profile)

Expected:
- second run produces `_v2` PDFs.

## B.4 Contact Info Extraction Test
1. Use a JD containing recruiter email/phone and a direct apply link
2. Generate
3. History → open job detail

Expected:
- email/phone saved and visible; follow-up links list populated; generic domain links excluded.

## B.5 Profile Switching Test
1. Clone profile, modify rules/template (small safe edit)
2. Set as active profile
3. Generate same JD

Expected:
- output is under `{ProfileFolder}` and generation metadata references that profile/hash.

## B.6 Failure Handling Test (No API Key)
1. Clear API key
2. Attempt Generate

Expected:
- Generate blocked with clear instruction.

## B.7 Failure Handling Test (Invalid Model Output)
1. Temporarily set adapter to return invalid JSON for Call B
2. Generate

Expected:
- retries happen; fallback triggers if enabled; if still fails, generation saved as failed with error message.

---

# C) Definition of Done (per milestone)
A milestone is “done” only when:
- All listed development tasks completed
- All Auto tests for that milestone are green
- All Manual tests for that milestone pass
- Build artifacts runnable in dev and packaged mode (where applicable)
- No regression in prior milestone acceptance tests
