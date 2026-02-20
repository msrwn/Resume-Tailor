# Resume Tailor Desktop App — Technical Requirements (MVP)

## 1) Scope and Deliverables
### 1.1 Deliverables
- Electron desktop application (Windows MVP; macOS optional later)
- Local database (SQLite) with migrations
- Profiles feature (Rules + Template editing, default profile)
- Generate pipeline:
  - Call A (JD Extraction) → structured job info + contact info
  - Call B (Resume Payload + Cover Letter) → strict JSON
  - Local validation from selected Profile rules_text
  - Local PDF generation (no local server)
  - Deterministic filesystem output under `{outputRootPath}/{YYYY_MM_DD}/...`
- History UI for search + detail view + open output folder/files
- Settings UI + `config.json` (outputRootPath, models, retry/fallback)

### 1.2 Out of scope (MVP)
- URL scraping to fetch JD (URL is stored only)
- Cloud sync / multi-device sync
- Auto-apply to jobs
- Multi-user auth
- Complex rule engine beyond MVP parsing targets

---

## 2) Architecture Overview
### 2.1 Processes
- **Main process**
  - Filesystem I/O
  - SQLite access
  - Config read/write
  - LLM API calls
  - PDF generation via hidden BrowserWindow / webContents
- **Renderer process**
  - UI (Generate / History / Profiles / Settings)
  - Calls main via IPC
  - Displays progress and results

### 2.2 Packaging
- Build with `electron-builder` or `electron-forge`
- App data directories must be OS-standard:
  - Windows: `%APPDATA%/<app-name>/`
  - macOS: `~/Library/Application Support/<app-name>/`

---

## 3) Technology Stack
### 3.1 Runtime
- Node.js (bundled with Electron)

### 3.2 UI
- React + TypeScript (recommended), or your existing stack
- State management minimal (React Query/Zustand optional)

### 3.3 DB
- SQLite (recommended: `better-sqlite3` for sync simplicity, or `sqlite3` async)
- Migration strategy: `PRAGMA user_version` + sequential migration scripts

### 3.4 PDF generation
- Chromium printing:
  - `webContents.printToPDF()` in a hidden `BrowserWindow`
  - No local HTTP server

### 3.5 LLM provider
- OpenAI API via official SDK or direct HTTPS
- Adapter pattern so model switching is config-only

---

## 4) Configuration Requirements
### 4.1 Config file location
- `{appDataDir}/config.json`

### 4.2 Required config keys
- `outputRootPath` (string; required once user sets it)
- `useDateBaseFolder` (boolean; default true)
- `dateFolderFormat` (string; default "YYYY_MM_DD")

LLM:
- `jdExtractionModel` (string)
- `resumePayloadModel` (string)
- `fallbackModel` (string)
- `retryCountCallA` (int; default 1)
- `retryCountCallB` (int; default 1)
- `fallbackEnabled` (boolean; default true)

### 4.3 Secrets
- OpenAI API key must be stored in OS keychain:
  - Windows Credential Manager
  - macOS Keychain
- UI must provide:
  - Set key
  - Test key (optional)
  - Clear key

---

## 5) Database Requirements (SQLite)
### 5.1 File location
- `{appDataDir}/app.db`

### 5.2 Schema (minimum)
#### Table: `profiles`
- `profile_id` TEXT PK
- `name` TEXT NOT NULL
- `rules_text` TEXT NOT NULL
- `template_html` TEXT NOT NULL
- `rules_hash` TEXT NOT NULL
- `template_hash` TEXT NOT NULL
- `is_default` INTEGER NOT NULL DEFAULT 0
- `created_at` TEXT NOT NULL
- `updated_at` TEXT NOT NULL
- `archived_at` TEXT NULL

Constraint (enforced in code):
- only one `is_default = 1`

#### Table: `jobs`
- `job_id` TEXT PK
- `created_at` TEXT NOT NULL
- `jd_text` TEXT NOT NULL
- `jd_hash` TEXT NOT NULL
- `source_url` TEXT NULL
- `company_name` TEXT NULL
- `job_title` TEXT NULL
- `job_type` TEXT NULL
- `budget` TEXT NULL
- `required_tech_stack` TEXT NULL
- `job_description_clean` TEXT NULL
- `contact_email` TEXT NULL
- `contact_phone` TEXT NULL
- `follow_up_links_json` TEXT NULL
- `contact_source_text` TEXT NULL

Indexes:
- `idx_jobs_created_at`
- `idx_jobs_company_name`
- `idx_jobs_job_title`
- `idx_jobs_jd_hash`

#### Table: `generations`
- `generation_id` TEXT PK
- `job_id` TEXT NOT NULL
- `profile_id` TEXT NOT NULL
- `status` TEXT NOT NULL
- `created_at` TEXT NOT NULL
- `rules_hash` TEXT NOT NULL
- `template_hash` TEXT NOT NULL
- `jd_model_used` TEXT NOT NULL
- `payload_model_used` TEXT NOT NULL
- `fallback_used` INTEGER NOT NULL DEFAULT 0
- `fallback_reason` TEXT NULL
- `jd_input_tokens` INTEGER NULL
- `jd_cached_input_tokens` INTEGER NULL
- `jd_output_tokens` INTEGER NULL
- `payload_input_tokens` INTEGER NULL
- `payload_cached_input_tokens` INTEGER NULL
- `payload_output_tokens` INTEGER NULL
- `total_estimated_cost_usd` REAL NULL
- `base_folder` TEXT NOT NULL
- `company_folder` TEXT NOT NULL
- `role_folder` TEXT NOT NULL
- `profile_folder` TEXT NOT NULL
- `output_dir` TEXT NOT NULL
- `resume_pdf_path` TEXT NULL
- `cover_pdf_path` TEXT NULL
- `jd_txt_path` TEXT NULL
- `error_code` TEXT NULL
- `error_message` TEXT NULL
- `raw_model_output_snippet` TEXT NULL

Indexes:
- `idx_generations_created_at`
- `idx_generations_job_id`
- `idx_generations_profile_id`
- `idx_generations_status`

### 5.3 Migration requirements
- App must apply migrations on startup
- Migrations must be idempotent and versioned
- Any schema change bumps `user_version`

---

## 6) Filesystem Output Requirements
### 6.1 Base folder
- If `useDateBaseFolder=true`, compute base folder using America/Los_Angeles date:
  - `YYYY_MM_DD`
- Output root:
  - `{outputRootPath}/{baseFolder}/`
- Create base folder if missing

### 6.2 Path construction (collision-proof)
Compute:
- `jd_hash_short = first 8 of sha256(jd_text)`

Derive folders:
- `companyFolder = sanitize(company_name) OR "not_specified_{jd_hash_short}"`
- `roleFolder = sanitize(job_title) OR "not_specified_{jd_hash_short}"`
- `profileFolder = sanitize(profile_name)`

Final directory:
- `{outputRootPath}/{baseFolder}/{companyFolder}/{roleFolder}/{profileFolder}/`

Collision rule:
- If directory exists and is associated with a different JD hash, append:
  - `{roleFolder}__{jd_hash_short}`

### 6.3 File naming
- Owner first name derived from Profile rules_text personal info (e.g. "Tan")
- Files:
  - `{FirstName}_Resume.pdf`
  - `{FirstName}_CoverLetter.pdf`
  - `JD.txt`

Overwrite rule:
- Never overwrite; if exists, increment version suffix:
  - `{FirstName}_Resume_v2.pdf`, etc.

### 6.4 Sanitization
- Must be stable across OS:
  - Trim whitespace
  - Replace slashes/backslashes with `_`
  - Remove `:*?"<>|` and control chars
  - Collapse multiple underscores
  - Limit segment length (e.g., 80 chars)
- Must preserve readability

---

## 7) LLM Integration Requirements
### 7.1 Call Design (required)
- **Call A**: JD extraction
- **Call B**: resume payload + cover letter

### 7.2 Adapter interface
Implement an adapter with:
- `runJdExtraction({ jdText, rulesText, jobUrl, model, ... })`
- `runResumePayload({ jdText, rulesText, jdExtraction, model, ... })`

Adapter must return:
- `rawText` (for debugging, capped in DB)
- `json` (parsed object)
- `usage` (tokens/cost if available)

### 7.3 Strict JSON requirement
- Both calls must request **JSON-only** output
- Enforce:
  - Parse JSON
  - Reject if extra non-JSON content exists (or strip with strict heuristics once; prefer fail+retry)

### 7.4 Retry and fallback
For each call:
- Retry up to `retryCountCallX` if:
  - JSON parse fails
  - validation fails
  - transient provider errors
- If still failing and `fallbackEnabled=true`:
  - run fallback model once
  - record `fallback_used=1` and `fallback_reason`

### 7.5 Cost tracking
- If provider returns usage:
  - store input/output tokens per call
- Estimate cost using configured per-token rates (optional MVP)
- Persist `total_estimated_cost_usd`

---

## 8) Output Contracts (JSON)
### 8.1 Call A output JSON (minimum)
- `company_name` (string | null)
- `job_title` (string | null)
- `job_type` (string | null)
- `budget` (string | null)
- `required_tech_stack` (string | string[] | null)
- `job_description_clean` (string | null)
- `contact`:
  - `email` (string | null)
  - `phone` (string | null)
  - `follow_up_links` (string[] | null, max 5)
  - `source_text_snippets` (string[] | null)

### 8.2 Call B output JSON (minimum)
- `owner_first_name` (string)
- `company_name` (string | null)
- `job_title` (string | null)
- `resume_payload` (object)  <!-- template merge input -->
- `cover_letter_text` (string)

Notes:
- `resume_payload` shape is internal to the template merge engine.
- Validation rules must come from selected Profile rules_text.

---

## 9) Template Merge Requirements
### 9.1 Resume template
- The app must use the Profile’s `template_html` without modifying CSS/layout.
- Template merge must replace placeholder fields using `resume_payload`.

### 9.2 Cover letter HTML
- The app generates a simple internal HTML wrapper for cover letter text.
- Cover letter rendering must not depend on a user template (MVP).

---

## 10) Validation Requirements (Profile-driven)
### 10.1 Principle
Validation logic must derive constraints from selected Profile `rules_text`, not from hardcoded company names.

### 10.2 MVP parsing targets
Parser extracts:
- Bullet count constraints (selectors + counts) as expressed in the Profile rules_text
- Skills category names (exact list) from the Profile rules_text
- Summary opener requirement (string match prefix)
- `<strong>` constraints (allowed sections + per-bullet cap)
- Minimum total skills count threshold

### 10.3 Validation checks (minimum)
- Call B JSON parse success
- `cover_letter_text` length / sentence count (approx; 4–5 sentences)
- Resume HTML generated:
  - has required major sections
  - contains no `<strong>` inside Skills section (if Profile requires)
  - does not exceed per-bullet `<strong>` cap
- Bullet count per section matches parsed constraints (best-effort based on selector mapping)

### 10.4 Degraded mode
If parsing rules_text fails:
- mark Profile as `validation_degraded`
- continue with:
  - JSON schema validation
  - basic HTML checks
- show warning in UI

---

## 11) PDF Generation Requirements (No Local Server)
### 11.1 Engine
- Use Electron/Chromium:
  - create hidden BrowserWindow (offscreen)
  - load HTML via `loadURL("data:text/html...")` or `loadFile(temp.html)`
  - call `webContents.printToPDF({ ... })`

### 11.2 Rendering options
- Page size: Letter (default) or A4 (configurable later)
- Margins: minimal / default (do not alter template spacing)
- Background graphics enabled (so colors render if any)

### 11.3 Performance
- Generate end-to-end within target:
  - typical case: < 5 seconds on a modern machine (non-binding goal)
- No long-lived hidden windows; reuse one window if safe

---

## 12) Electron IPC Requirements
### 12.1 IPC channels (suggested)
- `config:get`
- `config:set`
- `profiles:list`
- `profiles:create`
- `profiles:update`
- `profiles:archive`
- `profiles:setDefault`
- `profiles:validate`
- `jobs:createFromPaste`
- `jobs:get`
- `history:search`
- `generation:start` (returns `generation_id`)
- `generation:status` (push events or polling)
- `files:openFolder`
- `files:openFile`

### 12.2 Progress events
Main process emits:
- `generation:progress` with:
  - `generation_id`
  - `step` (enum)
  - `message` (string)
  - `percent` (0–100)

---

## 13) UI Functional Requirements
### 13.1 Generate screen
- Must block Generate if:
  - JD text empty
  - API key missing
  - outputRootPath unset
- Must show extracted company/title after Call A
- Must show output paths and open actions on success
- Must show actionable error message on failure

### 13.2 History screen
- Search by:
  - company_name
  - job_title
  - free-text over jd_text (optional MVP if using SQLite FTS)
- Show latest generation status
- Open output folder and files
- Show contact email/phone and follow-up links

### 13.3 Profiles screen
- Create (clone) profile
- Edit rules/template
- Validate
- Set default
- Archive (soft delete)

### 13.4 Settings screen
- Set output root path
- Set models + retry + fallback
- Set/clear API key

---

## 14) Non-functional Requirements
### 14.1 Reliability
- Never overwrite existing files (version suffix)
- Store failed generations with error reason
- Allow rerun from History

### 14.2 Security
- No plaintext API key in config.json or DB
- API calls over HTTPS only
- Do not log JD text to console in production builds

### 14.3 Privacy
- All job content stored locally
- No telemetry in MVP unless explicitly added

### 14.4 Maintainability
- Single adapter module for LLM providers/models
- Centralized filesystem utility for sanitize/versioning
- Centralized rule parsing/validation module

---

## 15) Acceptance Tests (Engineering)
1. With valid config + key, a JD paste produces 2 PDFs + JD.txt in correct folder.
2. Two different JDs with missing company name do not collide (use `not_specified_{hash}`).
3. Existing output files trigger `_v2` naming.
4. Call A extracts contact email/phone (when present) and persists to DB.
5. Switching profiles changes validation + template behavior and outputs into `{Profile}/` folder.
6. Force invalid JSON from model → retry occurs → fallback occurs if enabled → success or properly recorded failure.
7. App restarts and History still shows all saved jobs and generation outputs.
