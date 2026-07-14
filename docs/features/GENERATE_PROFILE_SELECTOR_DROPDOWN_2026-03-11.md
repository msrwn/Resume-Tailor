## Generate profile selector dropdown

- **Status**: ✅ Completed
- **Created**: 2026-03-11
- **Version**: 1.8.5

### Overview

On the Generate screen, the single-profile selector is now a compact dropdown instead of a vertical list of radio buttons. This reduces vertical space usage while keeping the same single-profile behavior.

### Requirements

- Keep generation **single-profile** (one active profile at a time).
- Make profile selection more compact to reduce layout height.
- Improve accessibility by associating the label with the control.

### Technical Approach

- Replace the radio-list UI in `renderer/components/GenerateProfilesSelector.tsx` with a `<select>` bound to `selectedProfileId`.
- Add `htmlFor`/`id` wiring for label ↔ control association.

### Implementation Checklist

- [x] Replace radio list with a dropdown selector
- [x] Add a disabled placeholder option when nothing is selected
- [x] Keep existing warnings for missing output path / API key

### Database Changes

- None.

### API Changes

- None.

### UI Changes

- Generate screen profile selector uses a dropdown.

### Testing Plan

- Open Generate screen with 2+ profiles and confirm:
  - Selecting a profile updates the active profile.
  - Default profile is still annotated with “(default)”.
  - Warnings for missing Settings values still appear.

### Backward Compatibility

- No backend or schema changes; existing generations and profiles are unaffected.
