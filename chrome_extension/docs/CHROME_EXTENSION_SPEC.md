# Chrome Extension — Full Specification

**Resume Tailor Apply Automation**  
Consumes the local autofill server to match jobs by URL, load applicant/autofill data, and fill ATS application forms.

---

## 1. Overview

The extension enables users to:

1. **Select profile** — Choose which Resume Tailor profile (and linked applicant) to use.
2. **Match job by URL** — Detect when the current tab is a supported ATS job page and match it to a generation.
3. **Autofill current page** — Fill form fields using applicant data and job-specific Q&A (on user click).
4. **Show resume/cover paths** — Display file paths and copy buttons; no automatic file upload.

**Prerequisite:** Resume Tailor (Electron app) must be running so the local server is available. The server binds to `127.0.0.1` (dev port **38421**, prod **38422**).

**Data and security:** All API calls go only to the local server (`127.0.0.1`). No data is sent to third parties. Applicant data and answers are fetched by the extension only when the user has selected a profile and only from the localhost server.

---

## 2. Server API (Contract)

The extension talks to the **Resume Tailor autofill server**. All endpoints are GET, JSON responses. The server sends `Access-Control-Allow-Origin: *` for CORS.

| Endpoint | Query | Response |
|----------|--------|----------|
| `GET /health` | — | `{ "ok": true \| false }` — `false` if server failed to bind. |
| `GET /profiles` | — | `[{ "profileId", "name", "applicantId" \| null }]` |
| `GET /autofill` | `profileId` (required) | `{ "applicant": { firstName, lastName, email, phone, address: { address1, address2, city, state, zip, country } } \| null, "answers": { [key]: string } }`. 404 if profile not found; 200 with `applicant: null, answers: {}` if profile has no applicant. |
| `GET /match` | `url` (tab URL), `profileId` (required) | **Match:** `{ "match": "exact", "generationId", "files": { "resumePdfPath", "coverPdfPath" }, "jobJsonPath" }`. `resumePdfPath` / `coverPdfPath` may be `null`. **No match:** `{ "match": "none" }` (200). 400 if `profileId` missing. |

**Base URL:** `http://127.0.0.1:38421` (dev) or `http://127.0.0.1:38422` (prod). Extension should try health on both or use a single configurable base (e.g. dev 38421 by default; optional settings for port).

**Calling `/match`:** Pass the current tab URL as the `url` query parameter. The extension **must** use `encodeURIComponent(tabUrl)` so the server receives the full URL correctly (URLs contain `&`, `?`, `#` which would otherwise break the query string).

**Job-specific Q&A:** The server returns `jobJsonPath` (absolute path to `job.json`). The extension cannot read local files. For autofill field mapping, the extension needs the **content** of `job.json` (e.g. `qa: [{ question, answer }]`). **Recommendation:** Add a server endpoint that returns job.json content, e.g. `GET /job-json?url=&profileId=` or include `jobJson` in the `/match` response. Until then, extension can rely only on `/autofill` (applicant + key-value answers) and use a fixed field-to-key mapping; job-specific Q&A would require the new endpoint.

---

## 3. UX Flow

### 3.1 First-time / Popup

1. User opens extension popup.
2. Extension calls `GET /health`. If not ok: show "Resume Tailor is not running. Start the app to use autofill."
3. Extension calls `GET /profiles` and shows a profile selector (dropdown or list).
4. User selects a profile → save `profileId` (and optionally `profileName`) to `chrome.storage.local`.
5. If the profiles list is empty, show: "No profiles in Resume Tailor. Create one in the app first."
6. Optionally show "Change profile" in popup for later.

### 3.2 On a job page (content script / overlay)

1. **ATS detection:** Content script runs on host permissions (e.g. Workday, Lever, Ashby, SmartRecruiters). Optionally show a small badge or page action when the URL matches. Only show the overlay on apply pages (not on job list or other non-apply URLs).
2. **Match:** If no profile is stored, show "Select a profile in the extension popup first" and do not call the server. Otherwise call `GET /match?url=<encodeURIComponent(currentTabUrl)>&profileId=<stored profileId>`.
3. **No match:** Show message: "No tailored resume found for this job and profile." Optionally: "Generate one in Resume Tailor first."
4. **Match:** Load autofill data:
   - Call `GET /autofill?profileId=<stored profileId>` for applicant + answers.
   - If server exposes job.json content (see §2), load job-specific Q&A for field mapping.
5. Show overlay (e.g. floating panel or inline bar):
   - **Primary action:** [ Fill this page ]
   - **Paths (read-only):**  
     Resume: path or "—" if null [Copy, only when path exists]  
     Cover: path or "—" if null [Copy, only when path exists]  
   - No auto-upload; user manually uploads using the path or opens the folder.

### 3.3 Autofill trigger

- User clicks **"Fill this page"**.
- Extension runs the autofill engine on the **current DOM** (current step only in multi-step flows).
- After user clicks "Next" (or navigates to the next step), user clicks "Fill this page" again for the next step.

---

## 4. Autofill Engine

### 4.1 Trigger

- Explicit: user clicks "Fill this page". No automatic fill on load.

### 4.2 Field detection strategy

For each field to fill:

1. **Locate element:** Use a combination of:
   - Associated `<label>` text (for/id).
   - `aria-label` / `aria-labelledby`.
   - `placeholder`.
   - Nearby text (e.g. preceding sibling or parent text).
2. **Normalize label text:** Trim, lowercase, collapse spaces. Map to a **canonical key** (see §5).
   - Example: "Are you legally authorized to work in the United States?" → `work_auth.us_authorized`.
3. **Match to value:** Value comes from:
   - **Identity/contact:** `applicant` from `/autofill`.
   - **Custom Q&A:** `answers` from `/autofill` (key-value).
   - **Job Q&A:** If available, `job.json` `qa[]` (question → answer); normalize question text to the same canonical keys where applicable.

### 4.3 Field types

| Type | Action |
|------|--------|
| **Text** | `input.value = value`; dispatch `input` and `change` (so React/Vue/Angular pick up). |
| **Checkbox** | Set `checkbox.checked = true` (or false from value); dispatch `change`. |
| **Radio** | Find option by label text (or value); programmatic click or set `checked` and dispatch `change`. |
| **Dropdown** | Open dropdown (click); select option by visible text (or value); close. Dispatch `change`. |

Use platform-specific adapters (§7) where DOM structure differs (e.g. Workday custom components).

### 4.4 Safety rules

- **Do NOT auto-fill:**
  - Submit / "Apply" buttons.
  - Consent checkboxes (e.g. "I agree to terms") by default.
  - Legal confirmations (e.g. "I certify under penalty of perjury").
- **Optional future setting:** `allowAutoConsent: false` (default); if true, allow filling consent checkboxes (document risk).

---

## 5. Supported autofill categories

Canonical keys (examples) for mapping ATS labels → values:

| Category | Example keys | Source |
|----------|----------------|--------|
| Identity | (optional; Chrome may handle) | `applicant` |
| Contact | email, phone, address fields | `applicant` |
| Work authorization | `work_auth.us_authorized`, `work_auth.sponsorship` | `answers` or job Q&A |
| EEO | `eeo.gender`, `eeo.veteran`, `eeo.disability`, race/ethnicity if defined | `answers` |
| Preferences | `relocation`, `salary`, `availability` | `answers` or job Q&A |

Store these in Resume Tailor's applicant "Custom Q&A" (autofill_answers) and/or in job.json `qa` for job-specific answers. Extension maps label text → key → value.

---

## 6. Multi-step and upload handling

- **Multi-step:** Fill **current step only**. User advances (Next); on the new step, user clicks "Fill this page" again. No automatic step detection required for v1.
- **Upload:** No automatic file upload. Show resume/cover **paths** and a **Copy** button. User pastes path into the ATS file input or opens the folder and attaches the file manually.

---

## 7. ATS adapter pattern

Platform-specific logic for detection and filling:

```ts
interface AtsAdapter {
  /** True if current page is this ATS (e.g. hostname + path pattern). */
  detect(): boolean;
  /** Run field detection and fill using provided data. */
  fill(data: AutofillData): FillResult;
}

interface FillResult {
  filled: string[];   // keys or field ids filled
  missing: string[]; // keys we could not find a field for
  errors?: string[];
}
```

**Adapters (priority for v1):**

1. **Workday** — `*://*.myworkdayjobs.com/*` — often custom components; likely needs the most mapping.
2. **Lever** — `*://jobs.lever.co/*`
3. **Ashby** — `*://*.ashbyhq.com/*`
4. **SmartRecruiters** — `*://*.smartrecruiters.com/*`

Default adapter: generic DOM (label/aria/placeholder/nearby text) when no specific adapter matches.

---

## 8. Permissions

```json
{
  "permissions": ["storage", "activeTab", "scripting"],
  "host_permissions": [
    "http://127.0.0.1:38421/",
    "http://127.0.0.1:38422/",
    "*://*.myworkdayjobs.com/*",
    "*://*.ashbyhq.com/*",
    "*://jobs.lever.co/*",
    "*://*.smartrecruiters.com/*"
  ]
}
```

- **storage:** Persist selected `profileId`.
- **activeTab / scripting:** Inject content script or run scripts when needed.
- **host_permissions:** Local server (both ports so dev/prod work) + ATS origins for content script and fetch.

---

## 9. Performance and caching

- **Call `/match` once per page load** (e.g. when overlay is shown or when tab URL matches ATS). Cache result in memory for the tab; no polling.
- **Cache `/autofill` per session** — when profile is selected or when match succeeds, cache applicant + answers for the session to avoid repeated requests.
- **No polling** — all requests are user- or page-driven.

---

## 10. Error handling

| Situation | UX |
|-----------|----|
| **Server not running** (`/health` fails or `ok: false`) | "Resume Tailor is not running. Start the app to use autofill." |
| **No match** (`/match` returns `match: "none"`) | "No tailored resume found for this job and profile." |
| **Profile not found** (`/autofill` 404) | "Profile not found. Choose another profile in the extension." |
| **Missing fields** (after fill) | "Could not find field: Expected Salary" (list missing keys). Optionally show filled count: "Filled 12 fields; 2 not found." |
| **Network error** (CORS, connection refused) | "Could not reach Resume Tailor. Is the app running?" |

Use consistent error payload from server: `{ "error": "CODE", "message": "..." }` for 4xx/5xx. Extension should parse the response body on non-2xx and display `message` when present (fallback to generic text if body is not JSON).

### 10.1 Edge cases and robustness

| Case | Handling to avoid unexpected errors |
|------|--------------------------------------|
| **No profile selected** | If `chrome.storage` has no `profileId`, do not call `/match`. Show: "Select a profile in the extension popup first." |
| **Empty profiles list** | If `GET /profiles` returns `[]`, show: "No profiles in Resume Tailor. Create one in the app first." |
| **URL in `/match`** | Tab URL may contain `&`, `?`, `#`. Always pass `url` as `encodeURIComponent(currentTabUrl)` so the server receives the full URL correctly. |
| **Null file paths** | `files.resumePdfPath` or `files.coverPdfPath` can be `null`. Show "—" or hide that row; enable [Copy] only when path is non-null. |
| **Port discovery** | Extension cannot know dev vs prod. Try health on dev port (38421) first, then prod (38422). Cache the working base URL in `chrome.storage.local` so the next popup/open reuses it and avoids repeated probes. |
| **Full name field** | Some forms have a single "Full name" input. Use `applicant.firstName + " " + applicant.lastName` (trimmed) when mapping to such a field. |
| **Fill button twice** | Make fill idempotent (setting same value is safe) or disable "Fill this page" after first successful fill for the current step to avoid duplicate/confusion. |
| **Overlay on wrong page** | Only show the overlay on URLs that match ATS apply pages (host + path). On same host but non-apply (e.g. job list), show nothing or a minimal "Not a supported apply page." |
| **SPA navigation** | If the ATS uses client-side routing (e.g. from list to apply without full reload), content script may not run again. v1: assume full page load per job; optional later: observe URL changes and re-run match/overlay. |
| **FillResult.errors** | Use `errors` for runtime failures: e.g. "Field X is read-only", "Could not set dropdown Y". Surface these in the overlay so the user knows what was skipped. |

---

## 11. Architecture summary

```
User selects profile (popup)
        ↓
Saved to chrome.storage
        ↓
User opens job page (ATS)
        ↓
Content script: detect ATS → GET /match?url=&profileId=
        ↓
Resume Tailor server → returns generation + paths (and optionally job Q&A)
        ↓
Extension loads GET /autofill?profileId= → applicant + answers
        ↓
Overlay: [ Fill this page ] + Resume/Cover paths + Copy
        ↓
User clicks "Fill this page" → adapter.fill(data)
        ↓
Fields populated (current step only)
        ↓
User clicks Next → repeat "Fill this page" on next step
```

**Separation of concerns:**

- **Resume Tailor (server):** Data (profiles, applicant, answers, generations) and file paths; no UI.
- **Extension:** UI (popup, overlay), ATS detection, field mapping, and safe DOM filling.

---

## 12. Suggested extension structure

```
chrome_extension/
  manifest.json          # Manifest V3
  popup/
    popup.html
    popup.js             # Profile list, health check, save to storage
  content/
    content.js           # Inject overlay, call /match, /autofill, show paths
    overlay.html / overlay.css  # Or inline overlay in content.js
  background/
    service-worker.js    # Optional: port detection, messaging
  adapters/
    index.js             # Adapter registry: detect() → which adapter
    workday.js
    lever.js
    ashby.js
    smartrecruiters.js
    generic.js           # Fallback: label/aria/placeholder
  lib/
    api.js               # fetch wrappers: health(), profiles(), autofill(), match()
    storage.js           # chrome.storage helpers
    fieldMap.js          # Label text → canonical key mapping
```

---

## 13. Server-side recommendation (optional)

To support job-specific Q&A in the extension without reading local files:

- **Option A:** Add `GET /job-json?url=&profileId=` that runs the same match logic, then reads `job.json` from the generation output folder and returns its JSON (company name, job title, `qa[]`). Extension calls this after a successful `/match` to get `qa` for field mapping.
- **Option B:** Extend `/match` response when `match === 'exact'` with an inline `jobJson: { qa: [...] }` (and optionally full job meta). Keeps one round-trip; slightly larger response.

Document the chosen approach in the server API so the extension can depend on it.

---

## 14. Why this design works

- **Deterministic:** Match by normalized URL + profileId; no guessing.
- **Scalable:** New fields = new keys in applicant answers or job Q&A; extension mapping can be extended.
- **Safe:** No auto-submit; no auto consent; explicit "Fill this page."
- **Multi-step friendly:** One step at a time; user triggers fill per step.
- **Clear contract:** Server = data + paths; extension = UI + filling logic.

---

## 15. Implementation checklist (extension)

- [ ] Manifest V3, permissions and host_permissions as in §8.
- [ ] Popup: health check → profile list → save selected profile to `chrome.storage.local`; handle empty list (§3.1); optional port discovery with cached base URL (§10.1).
- [ ] Content script: inject on ATS host_permissions; only show overlay on apply pages; if no profile stored, show message and do not call server (§3.2, §10.1).
- [ ] API module: base URL config (dev 38421 / prod 38422 or single configurable port); fetch wrappers for health, profiles, autofill, match; **encode URI** when calling `/match?url=...` (§2, §10.1); parse error body on non-2xx (§10).
- [ ] Overlay: show paths or "—" when null; enable Copy only when path is non-null (§10.1).
- [ ] Adapter registry: detect ATS from URL → select adapter; implement at least generic + one ATS (e.g. Workday or Lever).
- [ ] Field mapping: label normalization → canonical key; full name = firstName + " " + lastName where needed (§10.1); fill using applicant + answers (and job Q&A when server exposes it).
- [ ] Fill: idempotent or disable button after first fill for current step; surface FillResult.errors in overlay (§10.1).
- [ ] Error UX: server down, no match, missing profile, missing fields (§10).
- [ ] No auto-submit; no auto consent (§4.4).

---

## 16. Doc history

- **v1** — Initial spec aligned with Resume Tailor autofill server (health, profiles, autofill, match); ATS adapters; overlay UX; safety rules; optional job.json endpoint recommendation.
- **v1.1** — Fixed section references (§5, §7). Added edge cases and robustness (§10.1): no profile, empty profiles, URL encoding, null paths, port discovery, full name, idempotent fill, overlay only on apply pages, SPA note, FillResult.errors. Clarified API (nullable paths, error body parsing). Expanded implementation checklist and data/security note.
