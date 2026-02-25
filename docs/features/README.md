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

## Release documentation (release doc workflow)

**Release documentation** is the process of recording a shipped change and bumping the version. Use this when you’ve finished a feature or fix and want to document it and cut a version.

**When someone says “run the release doc workflow”** — perform the four steps below (feature doc, features index, changelog, version bump).

1. **Feature doc** – Create or update a feature doc in `docs/features/` (e.g. `FEATURE_NAME_YYYY-MM-DD.md`) with overview, changes, and technical summary.
2. **Features index** – Update `docs/FEATURES.md` (add to Completed/Planned, link to the feature doc).
3. **Changelog** – Add a new version section to `CHANGELOG.md` (Added/Changed/Fixed) and update the Version History Summary.
4. **Version bump** – Update `version` in `package.json` (patch/minor/major per [Semantic Versioning](https://semver.org/) and the policy in `CHANGELOG.md`).

You can call this process **“release documentation”**, **“release doc workflow”**, or **“doing the release docs”**.

---

## Related Documentation

- Main app documentation: `../PRD.md`, `../TRD.md`, `../IMPLEMENTATION.md`
- Feature index: `../FEATURES.md`
