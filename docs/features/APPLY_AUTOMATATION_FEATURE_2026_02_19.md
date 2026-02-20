# Apply Automation Feature (Autofill Bundle)

## Overview

- Generate an autofill bundle per job generation
- Store applicant autofill data
- Run a local server for Chrome extension to:
  - Match job by URL + profile
  - Return autofill data + file paths

---

## 1. New Database Changes

### 1.1 Add applicant_profiles table

```sql
CREATE TABLE IF NOT EXISTS applicant_profiles (
  applicant_id TEXT PRIMARY KEY,
  name TEXT,
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  phone TEXT,

  address1 TEXT,
  address2 TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  country TEXT,

  created_at TEXT,
  updated_at TEXT
);
```

### 1.2 Add autofill_answers table

```sql
CREATE TABLE IF NOT EXISTS autofill_answers (
  applicant_id TEXT,
  key TEXT,
  value TEXT,
  updated_at TEXT,
  PRIMARY KEY (applicant_id, key)
);
```

### 1.3 Modify profiles table

```sql
ALTER TABLE profiles ADD COLUMN applicant_id TEXT;
```

### 1.4 Modify jobs table

```sql
ALTER TABLE jobs ADD COLUMN normalized_url TEXT;
ALTER TABLE jobs ADD COLUMN platform_id TEXT;
```

---

## 2. URL Handling

### Input requirement

- **Job URL is REQUIRED for generation.** The Generate button cannot be run without a job URL; generation is blocked until a URL is provided.

### Normalize URL

**Function:**

- Lowercase hostname
- Remove fragment (`#...`)
- Remove params: `utm_*`, `gclid`, `fbclid`, `lever-source`
- Keep pathname

**Return:**

- `normalizedUrl`: string
- `platformId`: string

---

## 3. Generation Output

**On successful generation**, in output folder write:

- `resume.pdf`
- `cover.pdf`
- `qa.pdf` (optional, when questions are provided)
- `JD.txt`
- `job.json` — job meta + **Q&A content** from the Generate screen (see 3.2)
- `autofill_data.json`

### 3.1 autofill_data.json format

```json
{
  "schemaVersion": "1.0",
  "createdAt": "...",

  "generation": {
    "generationId": "...",
    "jobId": "...",
    "profileId": "...",
    "profileName": "..."
  },

  "match": {
    "sourceUrl": "...",
    "normalizedUrl": "...",
    "platformId": "...",
    "hostname": "..."
  },

  "files": {
    "outputDir": "...",
    "resumePdfPath": "...",
    "coverPdfPath": "...",
    "qaPdfPath": null
  },

  "jobMeta": {
    "companyName": "...",
    "jobTitle": "..."
  }
}
```

> ⚠️ **Do NOT include personal info here**

### 3.2 job.json format

`job.json` is created from **job meta** (extraction/Call A) plus the **Q&A content** collected on the Generate screen during resume generation. The extension (or any consumer) can read this file to get the questions and answers for this job.

**Source of Q&A:** On the Generate screen, the user can enter questions (one per line). During generation, Call B returns answers; together they form the Q&A used for `qa.pdf`. The same **questions + answers** are written into `job.json` so they live alongside the output folder and can be used for autofill or reference.

**Format:**

```json
{
  "schemaVersion": "1.0",
  "createdAt": "...",
  "jobId": "...",
  "jobMeta": {
    "companyName": "...",
    "jobTitle": "...",
    "jobType": null,
    "sourceUrl": "..."
  },
  "qa": [
    { "question": "Are you legally authorized to work in the US?", "answer": "Yes, I am." },
    { "question": "What is your expected salary range?", "answer": "..." }
  ]
}
```

- **jobMeta:** From job row / Call A (company name, job title, etc.; can include `sourceUrl` for reference).
- **qa:** Array of `{ "question": string, "answer": string }` from the Generate-screen questions and Call B’s QA output. If the user did not enter questions, `qa` is `[]`. If questions were entered but Call B did not return QA, `qa` can be `[]` or partial; pipeline should write what is available.

**When to write:** When writing output files after a successful generation (same time as JD.txt, autofill_data.json). Path: same output folder, file name `job.json`. The `/match` response’s `jobJsonPath` points to this file.

---

## 4. Local Server (Electron Main)

- Start server on app launch
- **Host:** `127.0.0.1`
- **Port:** Use separate ports for dev and prod (e.g. dev `38421`, prod `38422`). If port is in use, **fail startup** with a clear error (no fallback).
- **Stop on quit:** Shut down the server when the app closes so the port is released (see 4.6).

### 4.1 Endpoint: GET /health

```json
{ "ok": true }
```

### 4.2 Endpoint: GET /profiles

Return all profiles:

```json
[
  {
    "profileId": "...",
    "name": "...",
    "applicantId": "..."
  }
]
```

### 4.3 Endpoint: GET /autofill?profileId=xxx

Return applicant + answers:

```json
{
  "applicant": {
    "firstName": "...",
    "lastName": "...",
    "email": "...",
    "phone": "...",
    "address": { ... }
  },
  "answers": {
    "work_auth.us_authorized": "yes",
    "eeo.gender": "male"
  }
}
```

### 4.4 Endpoint: GET /match

**Input:** `/match?url=<tabUrl>&profileId=<profileId>`

**Steps:**

1. Normalize URL
2. Query:

```sql
SELECT *
FROM generations g
JOIN jobs j ON g.job_id = j.job_id
WHERE j.normalized_url = ?
AND g.profile_id = ?
ORDER BY g.created_at DESC
LIMIT 1;
```

**Response:**

```json
{
  "match": "exact",
  "generationId": "...",
  "files": {
    "resumePdfPath": "...",
    "coverPdfPath": "..."
  },
  "jobJsonPath": "..."
}
```

- `jobJsonPath` is the absolute path to `job.json` in the generation output folder. The extension can read that file to get job meta and **Q&A content** (questions from the Generate screen + answers from Call B); see 3.2.

### 4.5 Optional: GET /generation/:id

Return parsed `autofill_data.json`.

### 4.6 Stop server on app quit

The server must shut down when the user closes the app so the port is released and the process exits cleanly.

**Implementation:**

1. **Keep a reference** to the Node.js `http.Server` (e.g. store the return value of `http.createServer(...)` before calling `.listen()`, or the result of `.listen()` if your API returns the server).
2. **Call `server.close()`** in Electron’s `before-quit` handler (the app already uses `before-quit` for `disposePdfWindow()` and `closeDatabase()` — add server shutdown there).

**Example (in main process):**

```ts
import * as http from 'http';

let autofillServer: http.Server | null = null;

function startAutofillServer(): void {
  const server = http.createServer(/* ... */);
  const port = process.env.NODE_ENV === 'development' ? 38421 : 38422; // see 10.5; fail if in use
  server.once('error', (err) => { console.error('Autofill server failed to bind:', err.message); });
  server.listen(port, '127.0.0.1', () => { autofillServer = server; });
}

// In app.whenReady():
startAutofillServer();

// In app.on('before-quit', () => { ... }):
if (autofillServer) {
  autofillServer.close();
  autofillServer = null;
}
disposePdfWindow();
closeDatabase();
```

- `server.close()` stops accepting new connections and allows existing requests to finish; the port is then released. No need to wait for the callback unless you want to delay quit.
- On macOS, `before-quit` runs when the user quits the app (e.g. Cmd+Q or dock quit). On Windows/Linux, it runs when the last window is closed (if you call `app.quit()` from `window-all-closed`). So one place (`before-quit`) is enough for all platforms.

---

## 5. Generation Pipeline Changes

**Before saving generation:**

- Compute `normalized_url`
- Detect `platform_id`
- Store in jobs table

**After PDFs created:**

- Write `job.json` to output folder (job meta + Q&A from Generate-screen questions and Call B QA output; see 3.2).
- Write `autofill_data.json` to output folder.

---

## 6. Platform Detection

Simple mapping:

```text
if (hostname.includes("lever.co")) return "lever"
if (hostname.includes("ashbyhq.com")) return "ashby"
if (hostname.includes("myworkdayjobs.com")) return "workday"
if (hostname.includes("smartrecruiters.com")) return "smartrecruiters"
return "other"
```

---

## 7. Security

- Bind server only to localhost
- No external network
- No file write/delete endpoints

---

## 8. Non-Goals

- No auto form submission
- No scraping job page
- No file upload automation
- No cloud sync

---

## 9. Acceptance Criteria

- Generation creates `autofill_data.json`
- `/match` returns correct generation by URL + profileId
- `/autofill` returns applicant + answers
- Extension can retrieve:
  - Autofill data
  - Resume/cover file paths

---

## 10. Improvements & Clarifications

### 10.1 Document / structure

- **Title:** Use **Automation** (not Automatation). Rename file to `APPLY_AUTOMATION_FEATURE_2026_02_19.md`.
- **Numbered sections:** Sections 1–9 are clear; the new sections below are additive.

### 10.2 Data model clarifications

- **Profile vs applicant:** A **profile** = rules + template bundle; **applicant** = one person's autofill data (name, email, phone, address, custom answers). One profile links to one applicant via `profiles.applicant_id`. Applicant data is **edited in the Profile section**, next to Resume Template (same place as rules/template). Define a clear **input format** for applicant fields so the extension and forms stay in sync.
  - **Applicant input format example** (to be used in the Profile UI and stored in `applicant_profiles` / `autofill_answers`):

| Field        | Format / rules           | Example                |
|-------------|---------------------------|------------------------|
| First name  | Text, trim                | `Jane`                 |
| Last name   | Text, trim                | `Doe`                  |
| Email       | Valid email               | `jane.doe@example.com` |
| Phone       | E.164 or freeform text    | `+1 (555) 123-4567`    |
| Address 1   | Text, single line         | `123 Main St`          |
| Address 2   | Optional, single line     | `Apt 4`                |
| City        | Text                      | `San Francisco`        |
| State       | Text or code (2-letter)   | `CA`                   |
| Zip         | Text                      | `94102`                |
| Country     | Text or code (ISO 3166-1) | `US`                   |
| Custom Q&A  | Key-value (key: string, value: string) | `work_auth.us_authorized` → `yes` |

  - Store standard fields in `applicant_profiles`; store custom key-value answers in `autofill_answers`. Validate and normalize in the Profile UI (e.g. trim, email format) before save.

  - **Applicant info UI (Profile screen):** In the **Profiles** screen, the right-hand editor currently has two tabs: **Rules** and **Resume Template**. Add a third tab **Applicant** (or **Applicant info**) next to them. When that tab is active, show a form that matches the input format above:
    - **Name:** First name, Last name (two text inputs).
    - **Contact:** Email, Phone (email input + text input, with optional email validation).
    - **Address:** Address 1, Address 2 (optional), City, State, Zip, Country (single-line inputs; optional grouping under an "Address" heading).
    - **Custom Q&A:** A list of key-value pairs (e.g. key `work_auth.us_authorized`, value "yes"). Always show this section on the Applicant tab: a list of rows with key + value inputs, plus "Add answer" to add more. Keys are freeform or from a fixed set depending on product choice. Stored in `autofill_answers`.
    - Reuse the same **Edit / Save / Cancel** pattern as the rest of the profile editor: changing applicant data sets "editing" and enables Save/Cancel; Save persists to `applicant_profiles` and `autofill_answers` and links the profile via `applicant_id`.
    - If the profile has no applicant yet, the first save creates an applicant record and sets `profiles.applicant_id`; subsequent saves update the existing applicant and answers.
- **Job URL required:** **Generation is blocked without a job URL.** The Generate button is disabled (or the flow does not start) until the user provides a job URL. No generation without URL.

### 10.3 URL normalization

- **Empty or invalid URL:** If `source_url` is empty, null, or not a valid URL, skip normalization and do not set `normalized_url` / `platform_id` (store NULL). Same for `/match?url=`: return 400 or `{ "match": "none" }` with a clear message if URL is missing/invalid.
- **Path-only and edge URLs:** Define behavior for `https://company.com` (path is `/`): normalized form could be `https://company.com/` and still match. Document that pathname is kept as-is (no trailing-slash normalization) to avoid subtle mismatches, or explicitly define one canonical form (e.g. always strip trailing slash).
- **Encoding:** Normalize percent-encoding (e.g. decode then re-encode in a canonical form, or always lowercase hex in encoded segments) so `%2F` vs `/` and `%2f` vs `%2F` don't cause different `normalized_url` values.
- **More tracking params:** Consider stripping other common params: `ref`, `source`, `utm_*` (you have this), `mc_cid`, `mc_eid`, etc., and document "strip all query params" vs "strip only listed params." Listing keeps behavior predictable.

### 10.4 File paths

- **Absolute paths:** Paths in `autofill_data.json` and in `/match` and `/generation/:id` responses are **absolute filesystem paths** so the Chrome extension can open files without guessing the app's output directory. Mirror `output_dir` from generations in the JSON and API.
- **Missing files:** If the user deletes or moves the output folder after generation, `/match` may return paths that no longer exist. Document as a known limitation; no `filesExist` check or similar for now.

### 10.5 Local server

- **Port binding:** Use **separate port(s) for dev and prod.** If the chosen port is in use, **fail startup** with a clear error (do not fall back to another port) so the user knows the autofill server did not start. Define explicitly, e.g. dev port `38421`, prod port `38422` (or a single prod port and try that first in packaged app).
- **CORS:** If the Chrome extension uses `fetch` from a content script or popup, requests may be cross-origin. Document that the extension must request host permission for `http://127.0.0.1:PORT` (or use optional host permission); or add `Access-Control-Allow-Origin: *` for 127.0.0.1 only. Document the chosen approach.
- **Error responses:** Use consistent JSON error bodies, e.g. `{ "error": "code", "message": "Human message" }` for 4xx/5xx, and document one example.

### 10.6 API response details

- **GET /match when no match:** Return 200 with e.g. `{ "match": "none" }` (no `generationId`, no `files`) instead of 404, so the extension can distinguish "no match" from "server error." Optionally include `normalizedUrl` in the response so the extension can log or debug.
- **GET /autofill when profile has no applicant:** If `profileId` has no linked `applicant_id` or applicant not in `applicant_profiles`, return 200 with `{ "applicant": null, "answers": {} }` or 404 with a clear message; document the choice so the extension can show "Set up applicant data for this profile."
- **GET /generation/:id:** If the generation exists but `autofill_data.json` is missing (e.g. deleted or from an old run), return 200 with generation metadata and a flag like `autofillDataPresent: false`, or 404; document which.

### 10.7 Generation pipeline

- **When to write autofill_data.json:** Write only when generation **succeeds** and `job.source_url` (or the URL used for this job) is present and valid. If generation fails after job creation, no JSON; if URL is added later, no retroactive JSON (or add a separate "export autofill bundle" action later).
- **Index for match query:** Add an index on `jobs(normalized_url)` (and optionally `(normalized_url, profile_id)` if you query by both); the match query is critical for extension latency.

### 10.8 Security (additions)

- **No sensitive data in autofill_data.json:** We do **not** save any kind of personal or sensitive data in `autofill_data.json` (only paths, IDs, normalized URL, job meta). PII stays in the DB and is exposed only via `/autofill` when the extension requests it with a valid `profileId`. No concerns for now.
- **Rate limiting:** Not required; no rate limiting for v1 (localhost-only).

---

## 11. Edge Cases

| Case | Recommendation |
|------|----------------|
| Same job URL, multiple generations (same profile) | Match query already returns `ORDER BY g.created_at DESC LIMIT 1` — document that "latest generation wins." |
| Same job posted on multiple platforms (e.g. Lever and company career page) | Different URLs → different `normalized_url` → separate match entries. Document that matching is per-URL, not per-job. |
| Profile has no `applicant_id` | `/autofill` behavior: 200 with null/empty or 404 — decide and document. `/match` can still return files; extension may only get paths, not form data. |
| Job created without URL; URL added later | No autofill_data.json for that job unless you add a "re-export bundle" or backfill. Document as out of scope for v1. |
| Output folder moved or deleted | Paths in DB and in any cached autofill_data.json point to old location. Document: "Paths are valid only until output folder is moved or deleted." Optional: `filesExist` in `/match` (see 10.4). |
| Very long URL / path | Normalize as usual; if DB or filesystem limits are hit, fail job save or match with a clear error. |
| Duplicate `applicant_id` in autofill_answers | PK `(applicant_id, key)` prevents duplicates; upsert on key for that applicant. |
| App not running | Extension gets connection refused. Document: "Resume Tailor must be running for autofill/match to work." |
| Migration from pre-autofill DB | New columns `applicant_id`, `normalized_url`, `platform_id` are NULL for existing rows. Old jobs never match; old profiles have no applicant until user links one. |

---

## 12. Optional / Future

- **GET /generation/:id:** Implement if the extension needs to load a bundle by generation ID (e.g. from history). Otherwise defer.
- **Schema version in autofill_data.json:** You have `schemaVersion: "1.0"`. Extension can reject or handle unknown versions; document that.
- **Platform-specific field mapping:** Later, you could add a small mapping (e.g. "Lever field X → our key Y") in the server or in the JSON; out of scope for initial doc.
- **Health check payload:** `/health` could return `{ "ok": true, "port": 38421 }` so the extension knows which port to use if you ever support multiple instances (optional).

---

## 13. Summary Checklist to Finalize

- [x] **Doc title:** Use Automation; rename file to `APPLY_AUTOMATION_FEATURE_2026_02_19.md`.
- [x] **Applicant data:** Edited in Profile section (next to Resume Template); use defined input format (see 10.2 table); store in `applicant_profiles` + `autofill_answers`.
- [x] **Job URL:** Generate button blocked without job URL; no generation without URL.
- [ ] Specify URL normalization for edge cases (empty, path-only, encoding).
- [x] **File paths:** All paths in API and JSON are absolute; missing-files case is a known limitation (no `filesExist` for now).
- [x] **Ports:** Dev and prod port set separately; fail startup if port in use (no fallback).
- [ ] Document CORS and extension host permission for 127.0.0.1.
- [x] **API:** `/match` no-match → 200 + `match: "none"`; define `/autofill` when profile has no applicant; error format `{ "error", "message" }`.
- [ ] Add index on `jobs(normalized_url)` in migration.
- [x] **Security:** No sensitive data in `autofill_data.json`; no rate limiting.

---

## 14. Implementation Plan (to avoid unexpected errors)

Implement in the order below so each step has the dependencies it needs and existing behavior keeps working.

### Phase 1: Database and shared utilities (no UI/API changes yet)

1. **Migrations (main/db/migrations.ts)**  
   - Add migration 3: create `applicant_profiles` and `autofill_answers`; alter `profiles` add `applicant_id`; alter `jobs` add `normalized_url`, `platform_id`; create index `idx_jobs_normalized_url` on `jobs(normalized_url)`.  
   - Use idempotent checks (e.g. `PRAGMA table_info`, or `CREATE TABLE IF NOT EXISTS`) so re-running is safe.  
   - Bump `user_version` and `CURRENT_VERSION` to 3.

2. **URL normalization (shared or main)**  
   - Add `normalizeJobUrl(url: string | null): { normalizedUrl: string | null; platformId: string }`.  
   - Invalid/empty URL → return `{ normalizedUrl: null, platformId: 'other' }` (or both null; document choice).  
   - Implement: lowercase hostname, strip fragment, strip listed query params, keep pathname.  
   - Add unit tests for edge cases (empty, invalid, `#`, `?utm_=`, encoding).

3. **Platform detection (shared or main)**  
   - Add `getPlatformId(hostname: string): string` (lever, ashby, workday, smartrecruiters, other).  
   - Use inside `normalizeJobUrl` so one call gives both normalized URL and platform.

4. **Jobs DAO**  
   - Extend `updateJobExtraction` (or add `updateJobMatchFields`) to accept `normalized_url` and `platform_id`.  
   - Pipeline will call this **before** creating the generation row so the match query can find the job later.

**Risk reduction:** Migrations run on app start; new columns are nullable. Old jobs stay with `normalized_url = NULL` and won’t match; that’s expected.

---

### Phase 2: Generation pipeline and URL requirement

5. **Pipeline: before saving generation**  
   - After job is created/updated from Call A, if `job.source_url` is present, call `normalizeJobUrl(job.source_url)` and then update the job with `normalized_url` and `platform_id` (via jobs DAO).  
   - If `source_url` is null/empty, leave `normalized_url` and `platform_id` as NULL (no update).

6. **Pipeline: after PDFs and JD.txt**  
   - **job.json:** Build payload from job row + `callBResult.json.qa` (and questions array from params). Write to `path.join(outputDir, 'job.json')` with schema in 3.2. Write on every successful generation (even when `qa` is []).  
   - **autofill_data.json:** Only when `job.source_url` is present and valid and we have `normalized_url`, write `autofill_data.json` to the same output folder (schema in 3.1). Use absolute paths for all file paths in the JSON.  
   - If writing either file fails, log and optionally fail the generation step (or leave generation success and document as best-effort); decide and be consistent.

7. **Generate screen: require job URL**  
   - Disable the “Generate” (or “Start”) button when the active task’s `sourceUrl` is empty or not a valid URL.  
   - Show a short hint: “Job URL is required for generation.”  
   - This avoids creating jobs/generations without a URL and keeps autofill/match behavior predictable.

**Risk reduction:** Existing flows that already pass a URL are unchanged. New file writes are additive (job.json, autofill_data.json); existing PDF/JD.txt logic stays. If file write fails, you can log and still mark generation success so the user still has PDFs.

---

### Phase 3: Local server

8. **Server module (main)**  
   - Create a small module (e.g. `main/autofillServer.ts`) that:  
     - Exposes `startAutofillServer()` and `getServerRef()` (or similar) so `main/index.ts` can call `server.close()` on quit.  
     - Uses a single port per environment (e.g. dev 38421, prod 38422 from env or `app.isPackaged`).  
     - Binds to `127.0.0.1` only.  
     - On `listen('error')`, log a clear message and optionally set a “server not running” flag so health returns 503 or the app can show a warning.  
   - Implement GET `/health`, GET `/profiles`, GET `/autofill?profileId=`, GET `/match?url=&profileId=`.  
   - For `/match`: normalize URL; if invalid/missing, return 200 `{ "match": "none" }`. Query DB (generations JOIN jobs) with `normalized_url` and `profile_id`; return 200 with `match: "exact"` + paths or `match: "none"`.  
   - For `/autofill`: if profile has no `applicant_id` or applicant missing, return 200 `{ "applicant": null, "answers": {} }` (doc says decide; this avoids 404 for extension).  
   - Return all paths as absolute.  
   - Send JSON error body `{ "error": "code", "message": "..." }` for 4xx/5xx.

9. **App lifecycle**  
   - In `app.whenReady()`, after DB init, call `startAutofillServer()`.  
   - In `app.on('before-quit')`, call `server.close()` (and set ref to null) before `disposePdfWindow()` and `closeDatabase()`.

**Risk reduction:** Server is read-only (no file write/delete). If the server fails to bind, app still runs; only autofill/match are affected. Extension can check `/health` and show “Resume Tailor server not available” when not ok.

---

### Phase 4: Applicant data and Profile UI

10. **Applicant DAOs (main/db)**  
    - Add `applicantProfilesDao` (create, get, update by applicant_id).  
    - Add `autofillAnswersDao` (get by applicant_id, upsert key-value, delete by applicant_id if needed).  
    - Ensure creating an applicant returns `applicant_id` (e.g. UUID) and that `profiles.applicant_id` is updated via existing profiles DAO (extend `updateProfile` or add a call that only sets `applicant_id`).

11. **IPC and types**  
    - Add IPC handlers for: get applicant by profile (or by applicant_id), save applicant (create or update), save autofill answers.  
    - Shared types: extend `Profile` with `applicant_id` (optional); add `Applicant`, `AutofillAnswers` (or inline in API).

12. **Profiles screen: Applicant tab**  
    - Add third tab “Applicant” next to Rules and Resume Template.  
    - Load applicant (and answers) when profile is selected; show form (name, contact, address, custom Q&A list).  
    - On Save: create or update applicant, upsert answers, set `profiles.applicant_id` if first time. Reuse Edit/Save/Cancel pattern; mark editing when any field changes.

**Risk reduction:** Profiles without applicant_id continue to work; `/autofill` returns null/empty. Validate email and trim strings in UI before save to avoid bad data.

---

### Order summary and dependency diagram

```
Phase 1 (DB + URL util) → Phase 2 (pipeline + URL gate) → Phase 3 (server) → Phase 4 (applicant UI)
         ↓                            ↓                         ↓                    ↓
   migrations, index           job.json, autofill_data.json   /match, /autofill   Applicant tab
   normalizeJobUrl             require URL on Generate         server.close()      applicant DAOs
   jobs normalized_url         update job before generation
```

### Testing and rollout

- **After Phase 1:** Run app, run migrations, create a job with URL, run generation (no UI change yet). Manually verify `jobs` has `normalized_url` and `platform_id` and that `job.json` and `autofill_data.json` appear when URL was provided.  
- **After Phase 2:** Generate with and without URL; confirm button is disabled when URL is missing.  
- **After Phase 3:** Call `/health`, `/match?url=...&profileId=...`, `/autofill?profileId=...` and confirm responses. Close app and confirm port is released.  
- **After Phase 4:** Create applicant from Profile, save, call `/autofill` and confirm applicant + answers returned.

This order and checklist should help avoid unexpected errors and keep the feature safe to ship in stages.
