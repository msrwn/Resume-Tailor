## Header

- **Feature**: JD Work Arrangement Warning on Generate
- **Status**: ✅ Completed
- **Version**: 1.8.1
- **Date**: 2026-03-10

## Overview

When pasting a job description on the Generate screen, the app now detects if the role is explicitly described as hybrid or on-site/office-based and shows a confirmation warning before running the tailoring pipeline. This helps avoid accidentally tailoring for non-remote roles when the user prefers remote work.

## Requirements

- Detect when a job description clearly indicates a hybrid or on-site/office-based role.
- Show a clear confirmation warning before starting generation in those cases.
- Allow the user to cancel generation from that warning.
- Do **not** show a confirmation for:
  - Roles that are clearly remote-only.
  - Job descriptions where the work arrangement is not specified or ambiguous.
- Keep all backend APIs, IPC handlers, and database schema unchanged.

## Technical Approach

- Implement lightweight keyword-based detection on the Generate screen’s JD textarea content.
  - Normalize text to lowercase and search for hybrid/on-site/office-based phrases.
  - Include a small list of variants (e.g. `on-site`, `onsite`, `office-based`, `in-office`, `hybrid`).
- Reuse the existing `ModalContext` confirm dialog for the warning UX.
- Insert the detection + optional confirmation into the `handleGenerate` function in `GenerateScreen` before calling `generationRunFull`.
- Do not modify the main process, pipeline, or database; the check is purely a frontend guard.

## Implementation Checklist

- [x] Add a `detectWorkArrangement(jdText)` helper in `renderer/screens/GenerateScreen.tsx` that:
  - [x] Returns `'hybrid_or_onsite'` when JD contains hybrid/on-site/office-based keywords.
  - [x] Returns `'remote'` when JD contains remote-related keywords.
  - [x] Returns `'unclear'` otherwise (used only internally; no UI branch).
- [x] Import `useModal` from `renderer/context/ModalContext` and access `confirm()` in `GenerateScreen`.
- [x] In `handleGenerate`, before setting loading state or calling `generationRunFull`:
  - [x] Call `detectWorkArrangement(activeTask.jdText)`.
  - [x] If result is `'hybrid_or_onsite'`, show a confirm dialog with a clear warning message.
  - [x] Abort generation if the user selects **Cancel**.
  - [x] For `'remote'` or `'unclear'`, proceed with generation without any extra dialog.
- [x] Keep the existing generation pipeline behavior unchanged for all other flows.
- [x] Verify that keyboard shortcuts, progress reporting, and per-task state are unaffected.

## Database Changes

- None.
- No new columns, tables, or migrations.
- All behavior changes are limited to the React renderer.

## API Changes

- None.
- No changes to:
  - IPC handlers in `main/index.ts`.
  - Preload bindings in `main/preload.ts`.
  - Shared types in `shared/types.ts`.

## UI Changes

- **Generate screen**
  - When clicking **Generate resume & cover letter** and the JD clearly indicates hybrid/on-site/office-based work:
    - Show a modal confirm dialog:
      - Message: “Warning: This job description mentions hybrid or office-based/on-site work. Do you still want to continue tailoring for this position?”
      - **OK** → continue generation as before.
      - **Cancel** → close the dialog and do not start generation.
  - When the JD is silent or ambiguous about work arrangement, or clearly remote-only:
    - No additional dialog is shown.
    - Generate behavior remains unchanged.

## Testing Plan

- **Hybrid/On-site JD**
  - Paste a JD containing phrases like “on-site”, “onsite”, “office-based”, “in-office”, or “hybrid work”.
  - Click **Generate resume & cover letter**.
  - Confirm that a warning modal appears.
  - Click **Cancel** → generation should not start (no progress, no history entry).
  - Click **Generate** again, accept the warning → generation should proceed and a history entry should be created.
- **Remote JD**
  - Paste a JD containing phrases like “remote”, “fully remote”, “100% remote”, or “work from home”.
  - Click **Generate**.
  - Confirm that **no** warning modal appears and generation proceeds normally.
- **Unspecified/ambiguous JD**
  - Paste a JD with no explicit remote/hybrid/on-site wording.
  - Click **Generate**.
  - Confirm that **no** warning modal appears and generation proceeds normally.
- **Regression checks**
  - Verify that multiple tasks (Task 1–10) still work with independent state.
  - Verify progress events and history entries are unaffected.

## Backward Compatibility

- Fully backward compatible:
  - No schema, IPC, or type changes.
  - Existing saved jobs, generations, and history entries remain valid.
  - The new behavior is additive and only introduces a confirm dialog in clearly hybrid/on-site cases.

