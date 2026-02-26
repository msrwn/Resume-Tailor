 # Analytics Screen — Resume Tailoring Activity

**Status**: ✅ Completed  
**Created**: 2026-02-26  
**Completed**: 2026-02-26  
**Version**: 1.3.0  
**Feature**: Analytics screen showing how many resumes were tailored per date, with summary metrics and a graph.

 ---

 ## 1. Overview

 The Analytics screen gives users a clear view of their resume tailoring activity over time. It surfaces:

 - Counts of successful generations (resumes tailored) grouped by local date.
 - Summary statistics (today, last 7 days, last 30 days, all-time).
 - A simple time-series chart and a tabular breakdown for the selected date range.

 This feature builds on existing generation history data without introducing new database schema.

 ---

 ## 2. Requirements

 ### 2.1 Functional requirements

 - **New Analytics screen**
   - Accessible as a top-level screen (e.g., via navigation alongside Profiles / Generate / History / Settings).
   - Shows user activity in terms of “resumes tailored”, based on successful generations.
 - **Summary metrics**
   - **Today**: number of successful generations whose `created_at` falls on the current local date.
   - **Last 7 days**: count of successful generations in the last 7 full local days (including today).
   - **Last 30 days**: same, for 30 days.
   - **All-time**: total successful generations.
 - **Graph**
   - Displays **per-day counts** of successful generations as a bar chart over a selected date range.
   - X-axis: calendar dates (local).
   - Y-axis: “Resumes tailored”.
   - Hover tooltip: `YYYY-MM-DD: N resumes`.
   - Days with zero activity still appear as 0-count bars (for streak visibility).
 - **Date range controls**
   - Quick filters: `Last 7 days`, `Last 30 days` (default), `Last 90 days`, `All time`.
   - Internally, mapped to `from` / `to` date boundaries in local time.
 - **Tabular breakdown**
   - A table below the chart listing:
     - `Date` (local date)
     - `Resumes tailored` (count for that date)
   - Sorted by date; newest first or oldest first (pick one and keep consistent with chart).
 - **Empty state**
   - If there is no activity for the selected range (or no history at all), show a friendly message:
     - “No resumes tailored yet. Once you generate resumes, your activity will appear here.”

 ### 2.2 Non-functional requirements

 - **Local-time correctness**: All date grouping and “today” logic must use the user’s local timezone (SQLite `localtime` helpers where applicable).
 - **Performance**:
   - Queries must remain fast on realistic local datasets.
   - For “All time”, aggregation is done in the database and returns day-level buckets, not raw rows.
 - **No schema changes**: The feature must work using existing `generations` data; no migrations.
 - **Backward compatible**: Existing flows (Generate, History) must continue to work unchanged.

 ---

 ## 3. Technical Approach

 ### 3.1 Data model and aggregation

 - Source of truth: `generations` table and `Generation` type (`shared/types.ts`).
 - Counting rule:
   - Count only rows where `status = 'success'`.
   - Group by `date(created_at, 'localtime')` when computing counts by day.
 - New DAO helper in `main/db/generationsDao.ts`:

   ```ts
   export type DailyGenerationCount = {
     date: string; // 'YYYY-MM-DD' (local date string)
     count: number;
   };

   export function getDailyGenerationCounts(params: {
     fromDate?: string; // 'YYYY-MM-DD' inclusive, local
     toDate?: string;   // 'YYYY-MM-DD' inclusive, local
   }): DailyGenerationCount[] { ... }
   ```

   - Implementation uses SQLite `date(created_at, 'localtime')` and `GROUP BY` with optional `BETWEEN` filters on the date expression.
   - When no `fromDate` / `toDate` is provided (e.g., “All time”), return all days with at least one successful generation.

 - Summary counts:
   - Reuse existing `getGenerationCounts()` for `total` and `today`.
   - Optionally, add a small helper (or reuse data from `getDailyGenerationCounts`) to derive `last7Days` and `last30Days` on the backend to avoid duplicate date math in the renderer.

 ### 3.2 IPC / API layer

 - New IPC channel (main process, `main/index.ts`):

   ```ts
   ipcMain.handle('analytics:getDailyCounts', (_event, params?: {
     range?: '7d' | '30d' | '90d' | 'all';
     fromDate?: string;
     toDate?: string;
   }) => { ... });
   ```

   - Responsibility:
     - Compute `fromDate` / `toDate` based on `range` if explicit dates not provided.
     - Call `generationsDao.getDailyGenerationCounts(...)`.
     - Return:
       ```ts
       {
         success: boolean;
         error?: string;
         summary?: {
           today: number;
           last7Days: number;
           last30Days: number;
           allTime: number;
         };
         data?: DailyGenerationCount[];
       }
       ```
   - Uses `getGenerationCounts()` for `today` and `allTime` and either:
     - Calculates `last7Days` / `last30Days` via additional SQL, or
     - Derives them by summing `data` over the requested window when appropriate.

 - Preload (`main/preload.ts`) additions:
   - Expose `analyticsGetDailyCounts` on `window.electronAPI`:

     ```ts
     analyticsGetDailyCounts: (params?: {
       range?: '7d' | '30d' | '90d' | 'all';
       fromDate?: string;
       toDate?: string;
     }) => Promise<{
       success: boolean;
       error?: string;
       summary?: { today: number; last7Days: number; last30Days: number; allTime: number };
       data?: DailyGenerationCount[];
     }>;
     ```

 - Renderer type definitions:
   - Update `renderer/types/electron.d.ts` to include `analyticsGetDailyCounts` with the same types.

 ### 3.3 UI / Renderer

 - New screen component: `AnalyticsScreen` in `renderer/screens/AnalyticsScreen.tsx`.
 - Navigation:
   - Add an “Analytics” or “Activity” item to the main navigation (where other screens like `Generate`, `History`, `Settings` are registered).
 - State:
   - `selectedRange: '7d' | '30d' | '90d' | 'all'` (default `'30d'`).
   - `loading: boolean`, `error: string | null`.
   - `summary: { today: number; last7Days: number; last30Days: number; allTime: number } | null`.
   - `dailyCounts: DailyGenerationCount[]`.
 - Behaviour:
   - On mount, call `analyticsGetDailyCounts({ range: '30d' })`.
   - When the user changes range, re-fetch.
 - Layout:
   - **Top row**: summary cards for Today, Last 7 days, Last 30 days, All time.
   - **Middle**: bar chart of `dailyCounts` for the selected range.
     - Use an existing charting library if one is present; otherwise, a lightweight choice (e.g., Recharts) for a simple vertical bar chart.
   - **Bottom**: table with columns:
     - Date (local `YYYY-MM-DD` formatted with `toLocaleDateString`).
     - Resumes tailored (count).
   - Empty/errored states:
     - If `error`, show a message box.
     - If `data` is empty and no error, show an informative “no activity” message.

 ---

 ## 4. Implementation Checklist

1. **DAO**
   - [x] Add `DailyGenerationCount` type and `getDailyGenerationCounts` in `main/db/generationsDao.ts`.
2. **IPC / backend**
   - [x] Add `analytics:getDailyCounts` IPC handler in `main/index.ts`.
   - [x] Wire handler to `getDailyGenerationCounts` and `getGenerationCounts`.
3. **Preload & types**
   - [x] Expose `analyticsGetDailyCounts` in `main/preload.ts`.
   - [x] Add `analyticsGetDailyCounts` to `renderer/types/electron.d.ts`.
4. **Renderer UI**
   - [x] Add `AnalyticsScreen.tsx` with:
     - [x] Range selector.
     - [x] Summary cards.
     - [x] Bar chart.
     - [x] Table view.
     - [x] Empty/error states.
   - [x] Register Analytics in the app routing/navigation.
5. **Styling**
   - [x] Add or reuse CSS classes in `renderer/styles.css` for cards, chart container, and table to match the existing design language.
6. **Documentation**
   - [x] Update `docs/FEATURES.md` to list this Analytics feature under “Planned/In Progress”.
   - [ ] Optionally reference the screen in `README.md` once implemented.

 ---

 ## 5. Database Changes

 - **No schema changes required.**
 - All data is derived from existing `generations` rows.

 ---

 ## 6. API Changes

 - **New IPC channel**: `analytics:getDailyCounts`.
 - **New renderer API**: `window.electronAPI.analyticsGetDailyCounts(...)`.
 - No breaking changes to existing IPC handlers.

 ---

 ## 7. UI Changes

 - New top-level Analytics screen:
   - Added to app navigation.
   - Uses existing typography, spacing, and card/table visual language for consistency.
 - No changes to existing screens’ core flows (Generate, History, Profiles, Settings).

 ---

## 8. Testing Plan

- **Unit tests (main process)**
  - [x] `getDailyGenerationCounts`:
    - Returns correct counts with mixed success/failed generations.
    - Respects `fromDate` / `toDate` filters.
    - Correctly groups by local date boundaries.
  - [x] `analytics:getDailyCounts` handler:
    - Properly maps range presets (`7d`, `30d`, `90d`, `all`) to date filters.
    - Returns expected `summary` values given seeded data.
- **Integration / UI tests (renderer)**
  - [x] Analytics screen:
    - Requests data with default range on mount.
    - Updates when range is changed.
    - Renders summary cards and table rows matching live data.
    - Shows an empty state when there is no data.
    - Shows an error message when backend returns `success: false`.
- **Manual tests**
  - [x] Generate several resumes on different days and verify:
    - History counts and Analytics summary agree (total/today).
    - Daily bars and table rows align with actual history.
  - [x] Verify behaviour with an empty database (no generations).

 ---

 ## 9. Backward Compatibility

 - The Analytics feature is **read-only** on existing data:
   - No migrations.
   - No changes to generation or history flows.
 - If `analytics:getDailyCounts` fails (e.g., DB unavailable), it affects only the Analytics screen:
   - Other screens remain fully functional.
   - The Analytics screen shows a non-fatal error message instead of crashing the app.

