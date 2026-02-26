# Feature Documentation Index

This directory contains documentation for individual features and enhancements to the Resume Tailor app.

## Structure

Feature documentation is organized by feature name in the `features/` subdirectory. Each feature should have its own implementation plan document.

## Current Features

### Implemented Features
- **Core MVP** - See `PRD.md`, `TRD.md`, and `IMPLEMENTATION.md` for the main application features

### Completed Features
- **[Generate & History Usability Tweaks](./features/GENERATE_HISTORY_USABILITY_2026-02-26.md)** ✅ - Generate toolbar + required job URL, History date filter and role styling adjustment (v1.4.0)
- **[Analytics Screen](./features/ANALYTICS_SCREEN_2026-02-26.md)** ✅ - View resumes tailored per date with summary metrics and graph (v1.3.0)
- **[History Screen Improvements](./features/HISTORY_SCREEN_IMPROVEMENTS_2026-02-25.md)** ✅ - Grid layout, profile filter, job title styling, open job posting link, shortened button labels (v1.2.0)
- **[Generate Screen & App Layout Improvements](./features/GENERATE_UI_LAYOUT_2026-02-25.md)** ✅ - Custom Prompt dropdown, full-width layouts (Generate, History, Settings, Changelog), full-width taller Generate button (v1.1.0)
- **[QA Feature](./features/QA_FEATURE_2026-02-16.md)** ✅ - Questions & Answers PDF generation (v0.2.0)

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

Last updated: 2026-02-26 (v1.4.0 – Generate & History usability tweaks)
