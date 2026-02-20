# Features Directory

This directory contains implementation plans and documentation for individual features and enhancements.

## File Naming Convention

- Use `FEATURE_NAME_YYYY-MM-DD.md` format (uppercase with underscores, date appended)
- Format: `{FEATURE_NAME}_{CREATION_DATE}.md`
- Date format: `YYYY-MM-DD` (e.g., `2026-02-16`)
- Examples: 
  - `QA_FEATURE_2026-02-16.md`
  - `BULK_GENERATION_2026-03-01.md`
  - `TEMPLATE_EDITOR_2026-04-15.md`

## Document Structure

Each feature document should follow this structure:

1. **Header** - Feature name, status, dates
2. **Overview** - What the feature does
3. **Requirements** - Functional requirements
4. **Technical Approach** - Implementation details
5. **Implementation Checklist** - Step-by-step tasks
6. **Database Changes** - Schema migrations
7. **API Changes** - IPC/type definitions
8. **UI Changes** - Frontend modifications
9. **Testing Plan** - Verification steps
10. **Backward Compatibility** - Impact analysis

## Status Icons

- 📋 **Planned** - Documented but not started
- 🚧 **In Progress** - Currently being implemented
- ✅ **Completed** - Implemented and tested
- 🔄 **On Hold** - Implementation paused

## Related Documentation

- Main app documentation: `../PRD.md`, `../TRD.md`, `../IMPLEMENTATION.md`
- Feature index: `../FEATURES.md`
