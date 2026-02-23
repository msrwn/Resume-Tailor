# Apply Automation — Chrome Extension

This folder holds the **Chrome extension** spec and implementation that consumes the Resume Tailor local autofill server.

## Contents

- **[docs/CHROME_EXTENSION_SPEC.md](./docs/CHROME_EXTENSION_SPEC.md)** — Full specification (PRD): UX flow, server API contract, autofill engine, ATS adapters, permissions, error handling.
- **Extension source:** `manifest.json`, `popup/`, `content/`, `lib/`, `adapters/`.

## Overview

- The **Electron app** runs a local HTTP server (`127.0.0.1`, ports 38421 dev / 38422 prod) with endpoints: `/health`, `/profiles`, `/autofill`, `/match`.
- The **Chrome extension** lets the user pick a profile, match the current job page by URL, load autofill data, and click "Fill this page" to populate ATS forms. It also shows resume/cover file paths with copy buttons (no auto-upload).

Resume Tailor must be running for the extension to work.

## Load the extension (development)

1. Start **Resume Tailor** (Electron app) so the autofill server is running on port **38421** (dev) or **38422** (prod).
2. Open Chrome and go to `chrome://extensions/`.
3. Turn on **Developer mode** (top right).
4. Click **Load unpacked** and select this folder (`chrome_extension`).
5. Use the extension icon to open the popup → you should see "Connected to Resume Tailor." and the profile list. Select a profile → Save.
6. Open a supported ATS job/apply page (e.g. Lever, Workday, Ashby, SmartRecruiters). The overlay appears if there is a match for the current URL and selected profile.

**Note:** All requests to the local server go through the extension’s **background service worker** so Chrome can connect to `127.0.0.1` reliably. If you still see "Resume Tailor is not running", ensure the Electron app is running and listening on 38421 or 38422, then reload the extension and try again.

## Supported ATS (content script runs on)

- `*://*.myworkdayjobs.com/*`
- `*://*.ashbyhq.com/*`
- `*://jobs.lever.co/*`
- `*://*.smartrecruiters.com/*`

## Next steps (optional)

- Add a server endpoint that returns `job.json` content for job-specific Q&A (see spec §2 and §13).
- Add platform-specific adapters (Workday, Lever, etc.) for better field mapping.
