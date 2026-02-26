# Generate & History Usability Tweaks

**Status**: ✅ Completed  
**Created**: 2026-02-26  
**Version**: 1.4.0  

---

## 1. Overview

This feature bundles small but high-impact usability improvements to the Generate and History screens, and tightens validation around job links. The goal is to make it faster to run generations, reduce visual clutter, and make it easier to find past applications by date.

---

## 2. Changes Delivered

### 2.1 Generate screen usability

- **Generate button placement**
  - Moved the primary **“Generate resume & cover letter”** button to the **top** of the task panel.
  - The button now sits in a **toolbar row** alongside the Prompt dropdown when a single profile with prompts is selected.
  - The toolbar is responsive (`flex`, wraps on small widths); the prompt region stretches, the button keeps a comfortable tap size.

- **Profiles selector cleanup**
  - Removed **“Select all” / “Deselect all”** buttons from the profile selector to reduce clutter and reclaim vertical space.
  - Profile selection is now a simple checkbox list with a summary of how many profiles are selected.

### 2.2 Job link requirement

- **Job posting URL is now required**:
  - Generate screen: **Job posting URL** field is marked required (`*`) and must be non-empty to enable the Generate button.
  - Backend: `runGenerationCallAOnly` and `runFullGeneration` both validate `sourceUrl` and return an error when it is missing or blank.
  - This ensures every stored job has a URL attached for better traceability and re-opening postings from History.

### 2.3 History screen date filter and styling

- **Date range filter**
  - Added a **Date** dropdown next to the search input and profile filter with options:
    - **All time**
    - **Today**
    - **Last 7 days**
    - **Last 30 days**
  - The filter adjusts the `fromDate` passed to `history:list`, which in turn filters jobs by `created_at`.
  - “Clear” resets the search text, profile filter, and date range back to **All time**.

- **Role styling adjustment**
  - History card role line (`.history-item-role`) is now **black, normal-weight text** (no longer bold) to reduce visual noise while still being prominent via color.

---

## 3. Technical Summary

| Area | Detail |
|------|--------|
| **Components – Generate** | `GenerateScreen.tsx`: new `generate-toolbar` row combining Prompt selection and the primary Generate button; root profile selector no longer exposes Select all/Deselect all callbacks. |
| **Components – History** | `HistoryScreen.tsx`: new `dateRange` state, Date filter `<select>` in the search bar, and `fromDate` passed into `historyList` queries. |
| **Styles** | `renderer/styles.css`: `.generate-toolbar`, `.generate-toolbar-prompt`, `.generate-toolbar-actions`, `.generate-toolbar-button`; `.history-date-filter`; `.history-item-role` font-weight changed to 400. |
| **Backend – Search** | `main/db/jobsDao.ts`: `searchJobs` now accepts optional `fromDate` / `toDate` and applies them to `created_at`. |
| **Backend – IPC/Types** | `main/preload.ts`, `renderer/types/electron.d.ts`: `historyList` query extended with `fromDate` / `toDate`. |
| **Backend – Validation** | `main/generation/pipeline.ts`: `runGenerationCallAOnly` and `runFullGeneration` enforce non-empty `sourceUrl` and return `"Job posting URL is required"` when missing. |
| **Breaking** | No schema changes; behaviour change: generations without a job URL are now rejected (URL required). Considered a minor, backward-compatible feature change for versioning purposes. |

---

## 4. Files Touched

- `renderer/screens/GenerateScreen.tsx` – Generate toolbar, removal of Select all/Deselect all usage, URL required in `canGenerate`.
- `renderer/components/GenerateProfilesSelector.tsx` – Profiles selector simplified (buttons removed).
- `renderer/screens/HistoryScreen.tsx` – Date range filter state and wiring into `historyList`.
- `renderer/styles.css` – Generate toolbar styles, history date filter styles, role text weight change.
- `main/db/jobsDao.ts` – `searchJobs` extended with `fromDate`/`toDate`.
- `main/preload.ts` – `historyList` IPC type extended (date filters).
- `renderer/types/electron.d.ts` – Renderer-side `historyList` type extended (date filters).
- `main/generation/pipeline.ts` – URL required validation in generation pipeline helpers.

---

## 5. Testing Plan

- **Generate screen**
  - With at least one profile selected and prompts available:
    - Confirm the Prompt dropdown appears at the top of the task panel.
    - Confirm the **Generate** button appears on the same row and remains enabled only when:
      - Job posting URL is non-empty, and
      - Job description textarea is non-empty, and
      - Output path and API key are set.
  - Try to generate with an empty Job posting URL:
    - Button should be disabled in the UI.
    - If the backend is called manually without `sourceUrl`, it should return `"Job posting URL is required"`.

- **History screen**
  - Generate several resumes across different dates (today and earlier).
  - Verify that:
    - **All time** shows all cards.
    - **Today** shows only jobs created on the current local date.
    - **Last 7 days** and **Last 30 days** constrain results appropriately.
  - Confirm the **Date** filter resets to **All time** when clicking **Clear**.
  - Verify role text is black, non-bold, and still readable.

- **Regression**
  - Existing History profile filter and search by keyword continue to work.
  - Analytics and other screens are unaffected.

---

## 6. Backward Compatibility

- No database migrations; existing jobs and generations remain valid.
- Behaviour change:
  - New generations now require a job posting URL; attempts without a URL are rejected early with a clear error message.
  - History role styling is softer (non-bold) but still black; no functional impact.
- External API surface (IPC channels) remains compatible; `history:list` only gains optional parameters.

