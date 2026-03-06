# Analytics: Stacked Bar Chart by Profile

**Status**: Implemented  
**Created**: 2026-03-06  
**Feature**: Replace the current single-color "resumes per day" bar chart with a **stacked bar chart** that shows contribution by profile per day, plus daily breakdown table with per-profile counts and percentages.

---

## 1. Overview

The Analytics screen currently shows one bar per day with a single color and a total count. This change updates the chart so that:

- **One bar per day** (unchanged).
- Each bar is **stacked by profile**: multiple segments with **different background colors**, one segment per profile that had activity that day.
- **Label on top of each bar**: total number of resumes created on that day (e.g. "100").
- **Hover on a segment**: tooltip shows how many resumes were generated for that profile for that day (e.g. "Profile A: 10", "Profile B: 20", "Profile C: 70").

**Example**: 100 resumes on a day — 10 for Profile A, 20 for Profile B, 70 for Profile C → one bar with three colored segments; hovering "Profile A" part shows "Profile A: 10 resumes" (or similar).

---

## 2. Requirements (finalized after clarity)

### 2.1 Visual

- **One bar per day** for the selected date range (same as today).
- **Stacked bar**: each bar is divided into segments; each segment = one profile's count for that day, with a **distinct background color**.
- **Total on top**: above each bar, display the **total number of resumes** created on that day.
- **Hover**: when the user hovers a segment, show a tooltip with **profile name** and **count** for that profile that day (e.g. "Profile A: 10 resumes").

### 2.2 Data

- Backend already exposes `getDailyGenerationCountsByProfile()` returning `{ date, total, byProfile: [{ profile_id, count }] }`.
- API will be extended (or response shape changed) so the frontend receives **daily data with per-profile breakdown** for the selected range.
- Profile **names** for tooltips (and legend): resolved in the renderer using existing `profilesList()`; map `profile_id` → `name`. If a profile was deleted, show a fallback (e.g. "Unknown profile" or "Deleted profile").

### 2.3 Behaviour

- Date range controls (7d / 30d / 90d / All time) and summary cards unchanged.
- Days with zero activity: can remain as an empty bar or no bar, consistent with current behaviour.

### 2.4 Daily breakdown table

- Show **total generated** per day (as now).
- For each day, also show **each profile's generated resume count and percentage** (per profile for that day).
- Table columns: **Date** | **Total** | then one column per profile (in the same fixed "legend" order) showing that profile's count and percentage for that day (e.g. "10 (10%)", "20 (20%)", "70 (70%)"). Profiles with zero that day show "—". Deleted/unknown profiles appear as "Unknown profile" with count and %.

---

## 3. Decisions (confirmed)

1. **Segment order in the stack**: **Fixed "legend" order** — same order every day for consistency (e.g. by profile name or stable API order).
2. **Legend**: **Yes** — show a legend (profile name + color swatch) so users know which color is which profile.
3. **Deleted or missing profiles**: **Yes** — show "Unknown profile" (or "Deleted profile") in tooltip/table and use a neutral/gray color for the segment.
4. **Color palette**: **Yes** — fixed set of colors; assign by stable order so the same profile always has the same color across days.

---

## 4. Technical approach (high level)

- **Backend**: Use existing `getDailyGenerationCountsByProfile()` for the selected range; extend `analytics:getDailyCounts` response to include **by-profile data** (e.g. `data` as `DailyGenerationCountByProfile[]`), or add a separate payload field. Summary and table can still use `total` per day.
- **Preload / types**: Expose the new response shape (e.g. `DailyGenerationCountByProfile[]`) to the renderer.
- **Renderer**:
  - Fetch analytics data (with by-profile breakdown) and optionally `profilesList()` for names.
  - Build one bar per day; each bar is a stack of `<div>`s (or similar) with height % = (segment count / day total) * 100, and distinct background colors.
  - Total label on top of bar; hover on segment shows profile name + count.
  - Render a legend (profile name + color) in the same fixed order used for segments.
- **Daily breakdown table**: Columns = Date | Total | [Profile 1: count (%)] | [Profile 2: count (%)] | … in legend order. Use same profile-name resolution (unknown/deleted → "Unknown profile").
- **CSS**: Reuse existing chart container; add styles for segment stacking, tooltip, and legend.

---

## 5. Out of scope (for this doc)

- Changing summary cards or date range logic.
- Any schema or migration (data already exists in `generations` with `profile_id`).

---

## 6. Implementation checklist

- [x] Backend: Return by-profile daily data from analytics IPC (use `getDailyGenerationCountsByProfile`).
- [x] Preload & types: Update `analyticsGetDailyCounts` response type to include per-profile breakdown.
- [x] Renderer: Load profiles for name resolution; build stacked bars with segments (fixed legend order), colors, and total label.
- [x] Renderer: Segment hover tooltip (profile name + count).
- [x] Renderer: Legend (profile name + color swatch).
- [x] Renderer: Daily breakdown table with Date | Total | per-profile columns (count and % per day; zero shows "—").
- [x] CSS: Stacked segment styles, tooltip, legend.
