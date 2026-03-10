# History Search Folder Fields

**Status**: ✅ Completed  
**Created**: 2026-03-10  
**Version**: 1.8.2  

---

## 1. Overview

Improve History search so it matches against the **generation folder fields** (`role_folder`, `company_folder`, `profile_folder`) in addition to existing job and metadata fields. This fixes cases where searching for a role or company name that only appears in the folder path (e.g. `Team lead`) returns matches in the database but not in the History UI.

---

## 2. Requirements

- Keyword search on the History screen should also match:
  - `generation.role_folder`
  - `generation.company_folder`
  - `generation.profile_folder`
- Searches like “Team lead” should return any history cards whose generation folder names contain that text, even when the text is not present in `jobs.job_title` or `jobs.company_name`.
- Behaviour remains otherwise unchanged:
  - Profile filter, date range, and notes search continue to work as before.
  - Only jobs with at least one generation are shown.

---

## 3. Technical Approach

- Extend the in-memory keyword filter inside the `history:list` IPC handler to push `generation.role_folder`, `generation.company_folder`, and `generation.profile_folder` into the search haystack alongside existing job and metadata fields.
- Keep the underlying `jobsDao.searchJobs` API and SQL unchanged; the enhancement is purely in the aggregation/filtering step that combines jobs and generations.

---

## 4. Implementation Checklist

- [x] Update `history:list` handler to include generation folder fields in the keyword search haystack.
- [x] Verify searches that previously only matched `role_folder` (e.g. “Team lead”) now return corresponding history cards.
- [x] Confirm profile/date filters and notes search still behave as before.

---

## 5. Database Changes

- No schema or migration changes.
- Uses existing `Generation` fields: `role_folder`, `company_folder`, `profile_folder`.

---

## 6. API Changes

- **IPC**: `history:list`
  - Behavioural change only: keyword filtering now also considers generation folder fields.
- **Types**: No changes to shared types; `Generation` already includes the folder fields.

---

## 7. UI Changes

- **History screen**
  - No visual changes to the History screen layout or controls.
  - Keyword searches now align more closely with what users see in their output folders and what they can find via direct database queries.

---

## 8. Testing Plan

- With existing history data:
  - Run a search for a term that appears **only** in `role_folder` or `company_folder` (e.g. “Team lead”) and confirm matching cards are returned.
  - Repeat with different profile folders and ensure results respect the **Profile** filter when set.
  - Apply **Today / Last 7 days / Last 30 days / Custom** date ranges and verify results are correctly intersected with the folder-based keyword matches.
- Regression:
  - Confirm that searches by company name, role title, JD text, notes, and profile/prompt names still work as documented in v1.6.0.

---

## 9. Backward Compatibility

- Fully backward compatible:
  - No schema or IPC shape changes.
  - Existing databases and history data continue to work.
  - Only broadens which fields are considered when evaluating a keyword match.

