## History Search Date Range Fix

- **Status**: ✅ Completed
- **Created**: 2026-03-10
- **Version**: 1.8.3

### Overview

Fix a bug where History keyword search only returned correct results after first running a search with a manually chosen custom date range. For "All time", "Last 7 days", and "Last 30 days", keyword matches outside the first page of newest generations could be silently dropped.

### Requirements

- Keyword search must behave consistently for all date ranges:
  - All time
  - Today
  - Last 7 days
  - Last 30 days
  - Custom range
- Paging must be applied **after** keyword filtering so older matching generations are still reachable.
- Behaviour must not depend on having previously used a custom date range.

### Technical Approach

- Extend `getGenerationsPage` in `main/db/generationsDao.ts` to accept an optional `keyword` parameter.
- Push keyword filtering into the SQL query:
  - Filter on `company_folder`, `role_folder`, `profile_folder`, and `notes` in `generations`.
  - Use an `EXISTS` subquery against `jobs` to match:
    - `company_name`, `job_title`, `jd_text`, `job_description_clean`
    - `contact_email`, `contact_phone`, `source_url`
  - Use `lower(...) LIKE '%keyword%'` to get case-insensitive matches.
- Update `history:list` IPC handler in `main/index.ts` to pass the trimmed `keyword` through to `getGenerationsPage`.
- Keep the existing limit+1 paging so `hasMore` continues to work correctly.

### Implementation Checklist

- [x] Add `keyword?: string` to `getGenerationsPage` parameters.
- [x] Update SQL to apply keyword filtering before `ORDER BY`/`LIMIT`/`OFFSET`.
- [x] Wire `HistoryListQuery.keyword` into `getGenerationsPage` from `history:list` IPC handler.
- [x] Verify searches that previously only worked after a custom range now work on the first try for "All time" and preset ranges.

### Database Changes

- No schema changes. All logic is implemented in the `generations` DAO query.

### API Changes

- IPC: `history:list`
  - Behaviour change only: `keyword` is now honoured directly in the DAO paging query instead of being applied purely in-memory after paging.

### UI Changes

- None. All behaviour changes are in the backend query; the History screen search bar and filters are unchanged.

### Testing Plan

- Start with a database containing:
  - Multiple generations spanning more than one page of results.
  - At least one older job whose company/role/JD text only appears beyond the first page.
- For each date range (All time, Last 7 days, Last 30 days, Custom):
  - Enter a keyword that matches the older job by:
    - Company name
    - Role title
    - JD text
  - Click **Search** and confirm:
    - The matching history cards appear.
    - Results no longer depend on first running a custom date range search.
- Confirm pagination:
  - When `hasMore` is true, **Load more** continues to return additional pages that all respect the keyword filter.

### Backward Compatibility

- Fully backward compatible:
  - No schema changes.
  - `history:list` API shape is unchanged.
  - Existing History filters and saved search state continue to work as before, with more predictable keyword results.

