## Gia Profile & History Enhancements

**Status**: ✅ Completed  
**Created**: 2026-03-05  
**Version**: 1.6.0

---

### 1. Overview

This feature release refines the Gia profile’s resume behaviour (header coverage, languages, employment history) and upgrades the History and Generate screens for better search, filtering, and editing.

---

### 2. Requirements

- Gia profile:
  - Ensure the tailored resume header can represent all key fields from the base resume (LinkedIn, website, etc.).
  - Preserve the full employment history from the base resume (no truncation at 2019 or similar cut-offs).
  - Include a **Languages** section when the base resume contains one.
  - Avoid inventing certificate URLs when none exist.
- History screen:
  - Support quick date filters plus an explicit custom date range.
  - Persist search filters (query, profile, date range) across tab navigation and restarts.
  - Display the count of results for the current filters.
  - Allow richer keyword search across job, contact, profile, prompt, and manual notes.
  - Allow manual editing of history card header fields (company name and role title).
- Generate screen:
  - Make profile selection cleaner and more compact on a single horizontal row.

---

### 3. Technical Approach

#### 3.1 Gia prompt, schema, and template

- **Prompt updates** (`docs/prompts/gia_prompt_2026_03_05.md`):
  - Relaxed the “10+ years” constraint and instructed the model to mirror true seniority from the base resume (e.g. 15+ / 20+ years).
  - Strengthened **ROLE & CONTENT STRATEGY** to:
    - Keep **all** professional experience roles from the base resume (no gaps).
    - Ensure the `experience` array is sorted in strict reverse-chronological order; preserve base ordering when dates are ambiguous.
  - Strengthened **CONSTRAINTS**:
    - “DO NOT truncate or hide earlier roles based on a time window (e.g. do not stop at 2019).”
    - Require a `languages` array and a rendered Languages section when the base resume contains a Languages section.
  - Added an authenticity rule for certificates:
    - Only include `url` when there is a real certification link in base resume or JD context.
    - Do not invent or guess certification URLs.

- **JSON schema & types** (`main/llm/callBPrompt.ts`, `shared/types.ts`):
  - Extended `CallBMeta` with optional:
    - `contact_linkedin?: string`
    - `contact_website?: string`
  - Extended `CallBResume` with:
    - `languages?: Array<{ name: string; proficiency?: string }>`
  - Updated the documented JSON example in:
    - Gia prompt (`gia_prompt_2026_03_05.md`)
    - Call B output format (`CALL_B_OUTPUT_FORMAT` in `callBPrompt.ts`)
    - Base resume / multi-prompt feature doc example.

- **Template & merge** (`docs/prompts/gia_template_2026_03_05.md`, `main/pdf/templateMerge.ts`):
  - Header:
    - Updated contact line to `... • {github} • {linkedin} • {address}`.
    - Mapped `{linkedin}` and `{website}` placeholders via `PLACEHOLDER_ALIASES` to `contact_linkedin` and `contact_website`.
  - Languages:
    - Added a `Languages` section stub to the Gia HTML template with placeholder list items.
    - `buildMergePayloadFromStructuredResume` now:
      - Accepts `resume.languages` and builds a `<ul>` of `<li>Language — Proficiency</li>`.
      - Injects a `languages` HTML string into the merge payload.
    - `mergeResumeTemplate`:
      - Replaces any stub `<ul>` under `<h2>Languages</h2>` with the generated Languages HTML when present.
  - Certificates:
    - Changed certificate rendering to:
      - Render `<li><a href="URL">Title</a></li>` when `title` and a non-empty `url` are provided.
      - Render `<li>Title</li>` (no link) when `url` is missing or blank.
    - Relaxed `CallBResume.certificates` type to `url?: string`.

#### 3.2 History search & editing

- **Backend search behaviour** (`main/index.ts`, `main/db/jobsDao.ts`):
  - `jobsDao.searchJobs` continues to filter by:
    - `company_name`, `job_title`, `created_at` (with `fromDate` / `toDate`), `limit`, `offset`.
  - `history:list` IPC handler now:
    - Separates `keyword` from the SQL query; it uses SQL only for structural filters (date range, etc.).
    - After retrieving jobs and generations, **post-filters** by `keyword` across:
      - `job.company_name`, `job.job_title`, `job.jd_text`, `job.job_description_clean`
      - `job.contact_email`, `job.contact_phone`, `job.source_url`
      - `generation.notes`
      - `profileName`, `promptName`
    - Maintains sorting by `generation.created_at` descending.

- **History IPC extensions** (`main/index.ts`, `main/preload.ts`, `renderer/types/electron.d.ts`):
  - Added `jobs:update` IPC handler which:
    - Calls `updateJobExtraction(jobId, data)` to update editable job fields.
    - Returns the updated `job`.
  - Exposed `jobsUpdate` in preload and renderer type definitions for use in the History screen.

- **History UI changes** (`renderer/screens/HistoryScreen.tsx`, `renderer/styles.css`):
  - **Custom date range**:
    - Extended `dateRange` state to include `'custom'`.
    - Added a **Custom range** option to the Date dropdown.
    - When `custom` is selected, shows two vertical date pickers:
      - `From` (`customFrom`) → mapped to `fromDate` at 00:00:00.
      - `To` (`customTo`) → mapped to `toDate` at 23:59:59.999.
    - `buildSearchQuery` encapsulates building the `historyList` query object (keyword, profile_id, from/to).
  - **Search filter persistence**:
    - On mount:
      - Reads `historySearchState_v1` from `localStorage` and restores:
        - `searchQuery`, `profileFilterId`, `dateRange`, `customFrom`, `customTo`.
      - Immediately loads history with the restored query; falls back to default load when absent/invalid.
    - On change:
      - Persists the above fields back to `localStorage`, ensuring filters survive tab changes and restarts.
  - **Result count display**:
    - When not loading and `results.length > 0`, shows:
      - `Showing N results for current filters`.
  - **Manual editing of header info**:
    - Added local state:
      - `editingJobId`, `jobDraftCompany`, `jobDraftTitle`.
    - Card header:
      - When not editing:
        - Displays company name + role and an icon button (✎) to **Edit header**.
      - When editing:
        - Replaces the header display with two inputs:
          - `Company name`
          - `Role title`
        - Displays compact icon buttons directly under the role input:
          - Green ✓ (Save) → calls `jobsUpdate(jobId, { company_name, job_title })` and updates in-memory results.
          - Red ✕ (Cancel) → resets draft state and exits edit mode.
      - Both icon buttons have accessible `aria-label`s.
  - **Icon button styling**:
    - Introduced `.button-icon`, `.button-icon-save`, `.button-icon-cancel` for small green/red icon buttons.
    - Slight top margin in `.history-item-edit-header-actions` to visually separate them from the text inputs.
  - **History search layout tweaks**:
    - Custom date inputs stacked vertically using `.history-date-custom-group` so the search bar remains compact.

#### 3.3 Generate screen profile row

- **GenerateProfilesSelector** (`renderer/components/GenerateProfilesSelector.tsx`, `renderer/styles.css`):
  - Layout:
    - Wrapped the label and profile list into `.generate-profiles-row`:
      - Left: `Profiles` label (`.generate-profiles-label`).
      - Right: all profile radio buttons in `.generate-profile-checkboxes`.
    - Result: label text and all profile radios share the same horizontal lane.
  - Alignment:
    - Reused checkbox alignment rules for `input[type="radio"]` so radios and labels align vertically.
    - Added a small right margin on the radio input to ensure clear spacing between the circle and the profile name.
  - Clean-up:
    - Removed the redundant “1 profile selected” hint under the list.

---

### 4. Implementation Checklist

- [x] Extend Gia prompt instructions for full employment history, dynamic seniority, and languages.
- [x] Extend Call B JSON schema (meta + resume) and shared types for contact + languages.
- [x] Update Gia HTML resume template for LinkedIn and Languages section.
- [x] Implement languages + safer certificates rendering in `templateMerge`.
- [x] Add `jobs:update` IPC handler and preload wiring.
- [x] Enhance `history:list` to keyword-filter across jobs, generations, profile, prompt, and notes.
- [x] Add custom date range picker and persistent search filters to History screen.
- [x] Show result count for History searches.
- [x] Implement header editing (company/role) on History cards.
- [x] Align Generate screen profile radios next to the Profiles label; remove redundant selection hint.

---

### 5. Database Changes

- No new migrations.
- `jobs:update` reuses `updateJobExtraction` and does not alter schema.

---

### 6. API / IPC Changes

- **New IPC handler**:
  - `jobs:update(jobId, data)` → `{ success, job?, error? }`
    - `data` is a partial of the `updateJobExtraction` payload (`company_name`, `job_title`, etc.).
- **Updated IPC behaviour**:
  - `history:list`:
    - Now returns `results` filtered by `keyword` in-process (JS), looking at job, generation, profile, and prompt fields.

---

### 7. UI Changes

- **Gia resume**:
  - Header supports LinkedIn and website placeholders.
  - Languages section appears when provided by the model.
  - Certificates without URLs render as plain text.
- **History screen**:
  - Custom date range (From/To) under a new `Custom range` option.
  - Search filters persist across navigation/restarts.
  - Result count line under the search bar.
  - Editable company name and role per history card, with compact icon Save/Cancel buttons.
- **Generate screen**:
  - Profiles label and all radio buttons aligned in a single row with clearer spacing.

---

### 8. Testing Plan

- **Gia resume output**:
  - Use the Gia profile with the 20+ year base resume.
  - Generate resumes for a few JDs and confirm:
    - Summary reflects the correct total years (20+), not hardcoded 10+.
    - All employment history roles present in base resume (including pre-2019) appear in the `experience` array in reverse-chronological order.
    - When the base resume has a Languages section, the JSON contains `resume.languages` and the PDF shows a Languages section.
    - Certificates without links in base resume are rendered as plain text, not as `href="#"` or invented URLs.
  - Verify header includes LinkedIn when present in Gia meta.

- **History search**:
  - Generate multiple jobs with distinct:
    - Company names, job titles, JD text snippets, contact emails, manual notes, and prompts.
  - Search by:
    - Company name, role, JD keyword, contact email, prompt name, and note content.
  - Confirm all relevant cards appear and irrelevant cards are excluded.

- **Date filters**:
  - Generate jobs on different days (or adjust system date / seed data).
  - Verify:
    - Today / Last 7 days / Last 30 days work as before.
    - Custom From/To range correctly includes/excludes expected jobs.

- **Filter persistence**:
  - Set a non-empty search query, select a profile, choose Custom date range.
  - Navigate to History → Generate → History.
  - Confirm filters are preserved and results reflect those filters.
  - Quit and reopen the app; confirm filters still restored.

- **Header editing**:
  - On a history card, click the ✎ icon, change company name and role title.
  - Save and confirm:
    - The card updates immediately.
    - Reloading History still shows the edited values (persisted to DB).
  - Cancel and confirm the original values remain unchanged.

- **Generate profile row**:
  - Open Generate screen with several profiles.
  - Confirm:
    - “Profiles” label and all radio buttons are on the same horizontal row.
    - Radio circles and labels are vertically aligned, with visible spacing between circle and text.

---

### 9. Backward Compatibility

- JSON schema changes are strictly additive (optional fields) and do not break existing outputs.
- History search and date filters remain backward compatible; default behaviour (All time, no keyword) is unchanged.
- No database schema changes; existing jobs and generations remain valid.

