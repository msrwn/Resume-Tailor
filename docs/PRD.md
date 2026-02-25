# Resume Tailor Desktop App — PRD (MVP, Updated)

## 0) One-paragraph summary
Build a local-first Electron desktop app that turns a pasted Job Description (JD) into (1) a **PDF resume** rendered from a **selected Profile’s non-negotiable HTML template**, (2) a **PDF cover letter** rendered from model text, and (3) a saved **JD text file**, while also saving all job/application metadata (company, role, optional URL, contact info, follow-up links, prompt/template hashes, model usage, and cost estimates) into a local DB so you can instantly search and retrieve past applications. Each Profile owns a **base resume (plain text)** and **one or more role-focused prompts**; for every JD we send `base resume + selected prompt + JD` to the LLM and get back a **structured JSON resume + cover letter + QA answers** that is merged into the Profile’s template.

---

## 1) Goals
- **One-click generation**: paste JD → click Generate → PDFs + JD saved into deterministic folders.
- **Local-first**: files + DB stored on the user’s machine.
- **Profiles**: support multiple “Base Resume + Prompts + HTML Template” bundles and select one Profile **and one Prompt** per generation.
- **Traceability**: every output is attributable to the exact Profile and model config used.
- **Zero overwrites**: handle missing company/role safely and prevent collisions automatically.
- **Fast retrieval**: search by company/role/keywords; show contact info for follow-up.

---

## 2) Non-goals (MVP)
- No auto-applying on job boards.
- No JD scraping from URL (URL is optional metadata only; JD text is the source of truth).
- No cloud sync across devices.
- No multi-user support.
- No template redesign by the app (the app only uses the Profile’s template as-is).

---

## 3) Target users & primary use case
**User**: a job seeker applying at high volume (10–100+ apps/day).  
**Flow**: copy JD → paste into app → generate → later search → open PDFs + find recruiter email/phone quickly.

---

## 4) Key product decisions

### 4.1 Desktop runtime
- Electron app (Windows first; macOS later).

### 4.2 Local database
- SQLite stored under app data directory.

### 4.3 Two-call design (required)
- **Call A: JD Extraction**
- **Call B: Resume Payload + Cover Letter**  
This improves reliability and allows model/cost optimization per step.

### 4.4 No local server for PDFs (required)
- PDF generation must be done **locally in Electron** using Chromium’s PDF printing:
  - Render HTML in a hidden `BrowserWindow` / `webContents`
  - Use `webContents.printToPDF()` to produce PDF bytes
  - Save to disk  
No separate local HTTP server is needed.

### 4.5 Profiles (MVP)
A **Profile** is a versioned bundle that controls generation behavior:
- **Rules Prompt** (rules_text)
- **Resume HTML Template** (template_html)

Select Profile per generation; one Profile can be set as Default.

---

## 5) User experience (UI)

### 5.1 Navigation
- Generate
- History
- Profiles
- Settings

### 5.2 Generate screen
**Inputs**
- JD Text (large paste area)
- Job URL (optional input)
- Profile dropdown (default preselected)

**Actions**
- Generate
- Clear

**Outputs shown**
- Extracted Company + Role
- Contact Email/Phone (if found)
- Output folder path + quick actions:
  - Open Folder
  - Open Resume PDF
  - Open Cover PDF

**Status/Progress**
- Stepper:
  1) Save job record
  2) Call A extraction
  3) Call B generation
  4) Validate outputs
  5) Render PDFs
  6) Write files
  7) Done

### 5.3 History screen
- Search box (company/role/keywords/req id)
- Filters (date range, Profile, status)
- Results list
- Detail panel shows:
  - JD text
  - Extracted fields (Company, Title, Type, Budget, Tech Stack)
  - Contact info + follow-up links
  - Output files + Open Folder
  - Profile used + hashes
  - Model usage + cost estimate

### 5.4 Profiles screen (MVP + base resume / prompts)
Two-column layout:
- Left: Profile list (Default badge)
- Right: Profile editor
  - Profile Name
  - Tabs:
    - Rules (legacy; still editable for validation hints)
    - Base Resume (plain text, single source of truth per profile)
    - Resume Template (HTML)
    - Prompts (list of role-focused prompts for this profile)
  - Buttons: New (clone), Save, Set Default, Archive, Validate

### 5.5 Settings screen (MVP)
- **Output Root Path** (folder picker) — where date folders are created
- Model settings:
  - Call A model
  - Call B model
  - Fallback model (optional but supported)
- Retry/fallback toggles
- Token/cost display preferences (optional)
- Utilities: open config location, open DB location

---

## 6) Configuration

### 6.1 Config file
A local config file stores user settings, including output root path and model choices.

- Location:
  - Windows: `%APPDATA%/<app-name>/config.json`
  - macOS: `~/Library/Application Support/<app-name>/config.json`

### 6.2 Config fields (MVP)
- `outputRootPath` (string, required; set via Settings)
- `useDateBaseFolder` (boolean, default true)
- `dateFolderFormat` (string, default `YYYY_MM_DD`; keep fixed in MVP if desired)

Model:
- `jdExtractionModel`
- `resumePayloadModel`
- `fallbackModel`
- `retryCountCallA` (default 1)
- `retryCountCallB` (default 1)
- `fallbackEnabled` (default true)

---

## 7) Data model (SQLite schema)

### 7.1 Table: `profiles`
- `profile_id` TEXT PRIMARY KEY (uuid)
- `name` TEXT NOT NULL
- `rules_text` TEXT NOT NULL                  -- still used for validation hints and legacy profiles
- `base_resume_text` TEXT NOT NULL            -- plain-text base resume; single source of truth
- `template_html` TEXT NOT NULL               -- resume HTML template
- `rules_hash` TEXT NOT NULL
- `template_hash` TEXT NOT NULL
- `is_default` INTEGER NOT NULL DEFAULT 0
- `created_at` TEXT NOT NULL (ISO)
- `updated_at` TEXT NOT NULL (ISO)
- `archived_at` TEXT NULL (ISO)

Rules:
- Exactly one Profile has `is_default = 1` (enforced by app).

### 7.2 Table: `profile_prompts`
A Profile can have multiple prompts (e.g., Mobile-focused, Web-focused) that all share the same base resume and template.

- `prompt_id` TEXT PRIMARY KEY (uuid)
- `profile_id` TEXT NOT NULL (FK to profiles)
- `name` TEXT NOT NULL                         -- e.g. "Mobile-focused", "Web platform"
- `prompt_text` TEXT NOT NULL                  -- full instructions sent to the LLM
- `created_at` TEXT NOT NULL (ISO)
- `updated_at` TEXT NOT NULL (ISO)
- `archived_at` TEXT NULL (ISO)

Indexes:
- `idx_prompts_profile_id`

### 7.3 Table: `jobs`
One JD paste = one job record.
- `job_id` TEXT PRIMARY KEY (uuid)
- `created_at` TEXT NOT NULL (ISO)
- `jd_text` TEXT NOT NULL
- `jd_hash` TEXT NOT NULL (SHA-256 of jd_text)
- `source_url` TEXT NULL

Extracted (from Call A):
- `company_name` TEXT NULL
- `job_title` TEXT NULL
- `job_type` TEXT NULL
- `budget` TEXT NULL
- `required_tech_stack` TEXT NULL (string or JSON)
- `job_description_clean` TEXT NULL

Contact (from Call A):
- `contact_email` TEXT NULL
- `contact_phone` TEXT NULL
- `follow_up_links_json` TEXT NULL (JSON array, max 5)
- `contact_source_text` TEXT NULL (snippets)

### 7.3 Table: `generations`
A job can have multiple generations (reruns, Profile variants).
- `generation_id` TEXT PRIMARY KEY (uuid)
- `job_id` TEXT NOT NULL (FK)
- `profile_id` TEXT NOT NULL (FK)
- `status` TEXT NOT NULL (`success` | `failed`)
- `created_at` TEXT NOT NULL (ISO)

Traceability:
- `rules_hash` TEXT NOT NULL
- `template_hash` TEXT NOT NULL

Model usage:
- `jd_model_used` TEXT NOT NULL
- `payload_model_used` TEXT NOT NULL
- `fallback_used` INTEGER NOT NULL DEFAULT 0
- `fallback_reason` TEXT NULL

Usage/cost (optional but recommended):
- `jd_input_tokens` INTEGER NULL
- `jd_cached_input_tokens` INTEGER NULL
- `jd_output_tokens` INTEGER NULL
- `payload_input_tokens` INTEGER NULL
- `payload_cached_input_tokens` INTEGER NULL
- `payload_output_tokens` INTEGER NULL
- `total_estimated_cost_usd` REAL NULL

Filesystem outputs:
- `base_folder` TEXT NOT NULL (e.g., `2026_02_12`)
- `company_folder` TEXT NOT NULL
- `role_folder` TEXT NOT NULL
- `profile_folder` TEXT NOT NULL
- `output_dir` TEXT NOT NULL
- `resume_pdf_path` TEXT NULL
- `cover_pdf_path` TEXT NULL
- `jd_txt_path` TEXT NULL

Errors:
- `error_code` TEXT NULL
- `error_message` TEXT NULL
- `raw_model_output_snippet` TEXT NULL (optional, capped)

---

## 8) Folder & filename strategy (no overwrites)

### 8.1 Base folder
- If `useDateBaseFolder` is true:
  - `baseFolder = YYYY_MM_DD` (America/Los_Angeles)
  - If exists, reuse; else create.
- Base folder is created under:
  - `{outputRootPath}/{baseFolder}/`

### 8.2 Company/role extraction fallback (collision-proof)
Compute:
- `jd_hash_short = first 8 chars of SHA-256(jd_text)`

Folders:
- `companyFolder = sanitize(company_name) OR "not_specified_{jd_hash_short}"`
- `roleFolder = sanitize(job_title) OR "not_specified_{jd_hash_short}"`
- `profileFolder = sanitize(profile_name)`

Final path:
- `/{baseFolder}/{companyFolder}/{roleFolder}/{profileFolder}/`

Collision rule:
- If computed path exists but belongs to a different JD hash, append:
  - `{roleFolder}__{jd_hash_short}`

### 8.3 Files inside output folder
Default filenames (owner first name is extracted from the Profile’s rules prompt personal info):
- `Tan_Resume.pdf`
- `Tan_CoverLetter.pdf`
- `JD.txt`

If a file already exists, version it:
- `Tan_Resume_v2.pdf`, `Tan_CoverLetter_v2.pdf`, etc.

---

## 9) Generation pipeline (end-to-end)

### Step 1 — Create/Upsert Job record
- Save `jd_text`, `jd_hash`, and optional `source_url`.

### Step 2 — Call A: JD Extraction
Inputs:
- JD text
- Selected Profile’s `rules_text`
- Optional job URL (metadata only)

Outputs:
- JD extraction fields (Company, Title, Type, Budget, Tech Stack, Clean description)
- Contact: email/phone/follow-up links + source snippets (if present)

Persist to `jobs`.

### Step 3 — Call B: Tailored Resume JSON + Cover Letter + QA
Inputs:
- JD text
- Selected Profile’s **base_resume_text**
- Selected Prompt’s `prompt_text` (e.g., Mobile-focused, Web-focused)
- Selected Profile’s `rules_text` (for validation hints; optional)
- JD extraction output
- Optional questions array (from Generate screen)

Outputs:
- `resume` object: structured JSON resume derived from base resume + JD + prompt (summary, skills by category, experience, freelance projects, education[], certificates, etc.).
- `cover_letter` text (4–5 sentences).
- Optional `qa` array: answers to user-provided questions.

### Step 4 — Validate (derived from the selected Profile rules_text)
- JSON schema validation (shape + required fields)
- Prompt-derived constraints (see Section 10)

If fails:
- Retry per Settings (`retryCountCallA` / `retryCountCallB`)
- If still fails and `fallbackEnabled`:
  - run fallback model once for that call
- If fallback also fails:
  - generation marked failed; store error data

### Step 5 — Render PDFs locally (no server)
- Resume:
  - Merge payload into selected Profile’s template_html → final resume HTML
  - Render HTML → PDF via Chromium `printToPDF()`
- Cover:
  - Convert cover letter text → minimal internal HTML → PDF via `printToPDF()`

### Step 6 — Write outputs & finalize generation record
- Create folders
- Save PDFs + JD.txt
- Save paths + metadata in `generations`

---

## 10) Validation rules derived from the selected Profile’s rules prompt

### 10.1 Principle
Validation rules must be **obtained from the selected Profile’s rules_text**, not hardcoded to specific company names or fixed strings beyond generic structural checks.

### 10.2 MVP parsing targets
The parser should extract:
- Bullet count requirements (selectors and counts) from the Profile rules_text:
  - Support both company-specific and role-tier patterns defined by the Profile.
- Skills categories list (exact category names) from the Profile rules_text
- Summary opener requirement string from the Profile rules_text
- `<strong>` usage constraints from the Profile rules_text (where allowed and per-bullet highlight limits)
- Minimum total skills requirement from the Profile rules_text

Template checks:
- Required sections exist (Summary, Skills, Professional Experience, Education, Certificates)
- HTML is renderable (basic well-formed checks)

### 10.3 Degraded mode
If rule parsing fails due to edits:
- Mark Profile as “validation degraded”
- Continue with basic schema validation + render checks
- Show warning in UI

---

## 11) LLM abstraction, fallback model, and model swapping

### 11.1 Provider adapter
All LLM calls go through a single adapter module with two functions:
- `runJdExtraction(...)`
- `runResumePayload(...)`

### 11.2 Settings-driven model selection
- Call A model can differ from Call B model.
- Model names and limits are controlled via config/settings.

### 11.3 Fallback model (purpose and behavior)
Fallback exists to improve success rate when the primary model fails to comply with strict structured output and validation requirements.

Fallback is used only when:
- JSON parsing fails after retries, or
- validation fails after retries, or
- transient provider errors occur (timeouts, 5xx, rate limits).

Limits:
- Fallback runs **at most once per call**.
- Fallback usage is stored in DB (`fallback_used`, `fallback_reason`).

Fallback can be disabled via Settings (`fallbackEnabled=false`).

---

## 12) Output JSON contracts (conceptual)

### 12.1 Call A output (conceptual)
- `company_name`
- `job_title`
- `job_type`
- `budget`
- `required_tech_stack` (array or string)
- `job_description_clean` (string)
- `contact`:
  - `email`
  - `phone`
  - `follow_up_links` (array max 5; ignore generic domain links per Profile rules)
  - `source_text_snippets` (array of short snippets)

### 12.2 Call B output (conceptual)
Per JD, Call B returns a strictly-typed JSON object:

- `owner_first_name` (string)
- `company_name` (string | null, best guess)
- `job_title` (string | null, best guess)
- `resume` (object) — structured resume derived from **base resume + JD + selected prompt**, including at least:
  - `full_name`, `first_name`, `title`
  - `contact` (phone, email, github, address)
  - `summary` (plain text)
  - `skills` (array of `{category, items[]}`)
  - `experience` (array of roles with bullets)
  - `freelance_projects` (array with bullets)
  - `education` (array of degrees)
  - `certificates` (array with titles/URLs)
- `cover_letter` (string; 4–5 sentences)
- `qa` (optional array of `{question, answer}`) when questions were provided.

The template merge layer is responsible for mapping this `resume` object into the Profile’s `template_html` (using placeholders/sections), and the QA feature uses `qa` for the Q&A PDF. Validation constraints still derive from the selected Profile’s `rules_text`.

---

## 13) Security & privacy
- API key stored in OS keychain (preferred).
- JD text stored locally; no third-party sync.
- Optional future: “mask sensitive” display in UI.

---

## 14) Error handling & resilience
- If Call A fails: job record remains with raw JD; generation marked failed.
- If Call B fails: generation marked failed; job record remains searchable.
- If PDF render fails: generation marked failed; store error details.
- Provide “Re-run generation” from History.

---

## 15) MVP acceptance criteria
1) User can create **3+ Profiles**, set one default, and select Profile on Generate screen.
2) Paste JD + click Generate produces:
   - `Tan_Resume.pdf`, `Tan_CoverLetter.pdf`, `JD.txt`
   - saved under `{outputRootPath}/{YYYY_MM_DD}/{Company}/{Role}/{Profile}/`
3) If company/role missing, folders use `not_specified_{jd_hash_short}` and never overwrite.
4) Contact email/phone and follow-up links (if present) are extracted and saved to DB; visible in History.
5) Job URL is optional and saved when provided.
6) Two-call design is implemented with retry + optional fallback.
7) Each generation stores: Profile + hashes, models used, output paths.

---

## 16) MVP milestones (implementation order)
1) DB schema + migrations
