# Feature Documentation Index

This directory contains documentation for individual features and enhancements to the Resume Tailor app.

## Structure

Feature documentation is organized by feature name in the `features/` subdirectory. Each feature should have its own implementation plan document.

## Current Features

### Implemented Features
- **Core MVP** - See `PRD.md`, `TRD.md`, and `IMPLEMENTATION.md` for the main application features

### Completed Features
- **[Analytics Stacked Bar by Profile](./features/ANALYTICS_STACKED_BAR_BY_PROFILE_2026-03-06.md)** ✅ - Per-day bar chart stacked by profile with legend, segment tooltips, and daily breakdown table with per-profile count/percentage (v1.8.0)
- **[Gia Profile & History Enhancements](./features/GIA_PROFILE_AND_HISTORY_ENHANCEMENTS_2026-03-05.md)** ✅ - Gia resume header/languages fixes, improved History search/editing, and cleaner Generate profile row (v1.6.0)
- **[History Retry & QA from History](./features/HISTORY_RETRY_AND_QA_FROM_HISTORY_2026-03-05.md)** ✅ - Retry/regenerate from history cards and QA-only answers using existing tailored resume + JD (v1.7.0)
- **[History Card Other Info](./features/HISTORY_CARD_OTHER_INFO_2026-03-03.md)** ✅ - Manual notes per history card (Other Info): add, edit, persist (v1.5.2)
- **[Generate Single-Profile & Education Rendering](./features/GENERATE_SINGLE_PROFILE_EDUCATION_2026-02-27.md)** ✅ - Single-profile Generate behaviour, stable Prompt dropdown, and improved Education section rendering (v1.5.0)
- **[Prompt Traceability & History Metadata](./features/PROMPT_TRACEABILITY_2026-02-26.md)** ✅ - Persist selected prompt, track `prompt_id` per generation, and show prompt name on History cards (v1.4.1)
- **[Generate & History Usability Tweaks](./features/GENERATE_HISTORY_USABILITY_2026-02-26.md)** ✅ - Generate toolbar + required job URL, History date filter and role styling adjustment (v1.4.0)
- **[Analytics Screen](./features/ANALYTICS_SCREEN_2026-02-26.md)** ✅ - View resumes tailored per date with summary metrics and graph; 1.5.1 patch makes the bar chart horizontally scrollable for long ranges (v1.3.0, 1.5.1)
- **[History Screen Improvements](./features/HISTORY_SCREEN_IMPROVEMENTS_2026-02-25.md)** ✅ - Grid layout, profile filter, job title styling, open job posting link, shortened button labels (v1.2.0)
- **[Generate Screen & App Layout Improvements](./features/GENERATE_UI_LAYOUT_2026-02-25.md)** ✅ - Custom Prompt dropdown, full-width layouts (Generate, History, Settings, Changelog), full-width taller Generate button (v1.1.0)
- **[QA Feature](./features/QA_FEATURE_2026-02-16.md)** ✅ - Questions & Answers PDF generation (v0.2.0)
- **[JD Work Arrangement Warning](./features/JD_WORK_ARRANGEMENT_WARNING_2026-03-10.md)** ✅ - Confirm before tailoring when JD explicitly states hybrid/on-site/office-based work; no prompt when work arrangement is unclear or remote-only (v1.8.1)
- **[History Search Folder Fields](./features/HISTORY_SEARCH_FOLDER_FIELDS_2026-03-10.md)** ✅ - History keyword search also scans generation folder fields (role, company, profile) to better align with DB queries and output folder names (v1.8.2)
- **[History Search Date Range Fix](./features/HISTORY_SEARCH_DATE_RANGE_FIX_2026-03-10.md)** ✅ - Fix History keyword search so All time / 7d / 30d ranges correctly honour the keyword on first search by pushing filtering into the paged DB query (v1.8.3)
- **[Release 1.8.4](./features/RELEASE_1_8_4_2026-03-11.md)** ✅ - Placeholder; update feature doc with actual changes (v1.8.4)
- **[Generate profile selector dropdown](./features/GENERATE_PROFILE_SELECTOR_DROPDOWN_2026-03-11.md)** ✅ - Generate screen profile selector uses a compact dropdown instead of a radio list (v1.8.5)

### Planned/In Progress Features
- **[Multi-Profile Generation](./features/MULTI_PROFILE_GENERATION_2026-02-16.md)** 📋 - Select multiple profiles and generate one tailored resume per profile

## Adding New Features

When planning a new feature:

1. Create a new markdown file in `docs/features/` directory
2. Use naming convention: `FEATURE_NAME_YYYY-MM-DD.md` (e.g., `QA_FEATURE_2026-02-16.md`, `BULK_GENERATION_2026-03-01.md`)
   - Include the creation date in `YYYY-MM-DD` format for easy tracking
3. Follow the template structure (see below)
4. Update this index file to include the new feature

## Feature Document Template

Each feature document should include:

1. **Overview** - Brief description of the feature
2. **Requirements** - What the feature should do
3. **Technical Approach** - How it will be implemented
4. **Implementation Checklist** - Step-by-step tasks
5. **Database Changes** - Schema migrations if needed
6. **API Changes** - IPC/type changes
7. **UI Changes** - Frontend modifications
8. **Testing Plan** - How to verify the feature works
9. **Backward Compatibility** - Impact on existing functionality

## Feature Status

- 📋 **Planned** - Feature is documented but not started
- 🚧 **In Progress** - Feature is being implemented
- ✅ **Completed** - Feature is implemented and tested
- 🔄 **On Hold** - Feature implementation is paused

---

Last updated: 2026-03-11 (v1.8.5 – release doc workflow)
