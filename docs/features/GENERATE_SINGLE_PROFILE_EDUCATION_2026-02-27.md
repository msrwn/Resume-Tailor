## Generate Screen Single-Profile & Education Rendering

**Status**: ✅ Completed  
**Created**: 2026-02-27  
**Version**: 1.5.0

### Overview

- Lock Generate screen to a **single active profile** at a time and keep the **Prompt (optional)** selector stable when navigating between screens.
- Fix **Education** rendering so it:
  - De-duplicates repeated education entries.
  - Replaces template stub lists with a generated `<ul>`.
  - Uses `institution | dates` formatting instead of `institution — dates`.

### Requirements

- Generate screen:
  - User can only select **one profile** at a time.
  - Selected profile is persisted across app restarts.
  - Prompt dropdown is always shown (when prompts exist) for the current profile, even after navigating away and back.
- Education:
  - Uses the structured `resume.education[]` array from Call B output.
  - Outputs a single `<ul>` block with one `<li>` per unique education line.
  - Template stub list under `<h2>Education</h2>` is fully replaced by the generated HTML.

### Technical Approach

#### Single-profile Generate behaviour

- Replace multi-select profile checkboxes with a **radio group**:
  - `GenerateProfilesSelector` now accepts `selectedProfileId: string | null` and `onSelectProfile(profileId: string)`.
  - Exactly one profile can be selected; hint text always shows “1 profile selected” when a profile is active.
- Generate screen state:
  - `selectedProfileId: string | null` persisted to `localStorage` key `resumeTailor_selectedProfileId`.
  - On load:
    - If stored profile exists in `profiles`, use it.
    - Else fall back to default profile, or first available profile.
- Prompt handling:
  - `prompts: ProfilePrompt[]` is stored for the **active** profile.
  - When `selectedProfileId` changes, `profilePromptsList(selectedProfileId)` is called and `prompts` updated.
  - `PromptSelect` is rendered when `selectedProfileId` is non-null and `prompts.length > 0`.
  - Selected prompt id is persisted as before (`resumeTailor_selectedPromptId`), but validated against the current profile’s prompts.
- Generation call:
  - Renderer calls `generationRunFull` with `profileId: selectedProfileId` (no multi-profile array).
  - For compatibility with the multi-profile backend shape, the result handling reads the **first** entry from `results` when present and maps it to the single-task `RunResult`.

#### Education rendering

- `buildMergePayloadFromStructuredResume` in `main/pdf/templateMerge.ts`:
  - Formats each education entry with `toEducationLine(e: CallBEducationEntry)`:
    - Prefer `degree — institution | dates` when all are present.
    - Fallbacks:
      - `degree — institution`
      - `institution | dates`
      - `degree | dates`
      - Or any single non-empty part.
  - De-duplicates education lines using a `Set` of trimmed strings.
  - Builds `educationText` as:
    - `<ul>\n<li>{line}</li>\n...</ul>` when there is at least one unique line.
    - Empty string when there are no lines.
  - Keeps backward compatibility when `resume.education` is a string.
- `mergeResumeTemplate`:
  - Reads `educationHtml = get('education')`.
  - Replaces any stub `<ul>` immediately following `<h2>Education</h2>` with the generated HTML:
    - `(<h2...>Education</h2>\s*)<ul>...</ul>` → `<h2>Education</h2>{educationHtml}`.

### Implementation Checklist

- [x] Convert Generate screen profile selection to a single radio-based `selectedProfileId`.
- [x] Persist `selectedProfileId` and restore it on load (fallback to default/first profile).
- [x] Load prompts for the active profile and keep Prompt dropdown visible across navigation.
- [x] Update `generationRunFull` call to use `profileId` and adapt result handling to single-profile shape.
- [x] Update Education payload builder to output a deduplicated `<ul>` with `degree — institution | dates` formatting.
- [x] Replace stub Education `<ul>` in templates with the generated `education` HTML block.
- [x] Run Jest tests for `templateMerge` and build main/renderer bundles.

### Testing Plan

- Generate screen:
  - Start app, open Generate:
    - Verify only one profile can be selected at a time.
    - Verify “1 profile selected” hint appears.
    - Select a profile that has prompts; verify Prompt dropdown appears.
  - Navigate to History/Profiles/Settings and back:
    - Verify the same profile remains selected.
    - Verify Prompt dropdown is still present and populated.
  - Run a generation and confirm:
    - Resume and cover PDFs are created.
    - History entry shows a single generation tied to the selected profile.
- Education:
  - Use a Call B output with the sample `education` array:
    - Verify Education section renders a single `<ul>` with three `<li>` items, no duplicates.
    - Confirm institution and dates are separated by `|`, e.g. `Maharishi International University | Jan 2018 – Jun 2020`.
    - Confirm any stub list in the template under `<h2>Education</h2>` is not visible in the final PDF.

