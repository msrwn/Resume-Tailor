# Changelog

All notable changes to Resume Tailor will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

- **Patch** (x.y.Z): Bug fixes, styling tweaks, docs. No new features or breaking changes.
- **Minor** (x.Y.0): New features (e.g. QA, multi-profile). Backward compatible.
- **Major** (X.0.0): Breaking API or data changes.

## [1.1.0] - 2026-02-25

### Added
- **Generate screen & app layout improvements**
  - **Custom Prompt (optional) dropdown**: Replaced native `<select>` with a custom dropdown so option height and width are controllable; options use comfortable tap height and stretch with the form.
  - **Full-width layouts**: Generate, History, Settings, and Changelog screens now stretch to use available width when the app is full size (removed fixed max-widths). Task tabs (Task 1–10) share the row with `flex: 1`.
  - **Generate button**: Full-width primary button with increased height (min-height 48px, larger padding and font) for better visibility and clickability.

### Changed
- **Build**: Removed stale compiled `.js` files in `renderer/` (e.g. `GenerateScreen.js`, `App.js`) so Vite bundles the `.tsx` sources; previously the prompt dropdown and other TSX changes did not appear in the built app because Vite resolved `.js` before `.tsx`.

### Documentation
- Feature doc: `docs/features/GENERATE_UI_LAYOUT_2026-02-25.md` (includes naming: “resume tailoring” for the product, “generation” / “generate flow” for the pipeline).

## [1.2.0] - 2026-02-25

### Added
- **History screen improvements**
  - **Grid layout**: History cards displayed in a responsive grid so more cards fit on one screen (`minmax(340px, 1fr)`).
  - **Filter by profile**: Search bar includes a profile dropdown ("All profiles" or a specific profile); results are filtered by selected profile when searching.
  - **Open job posting**: When a job has a source URL, a "Job posting" link opens it in the default browser (new IPC `files:openUrl` / `shell.openExternal`).

### Changed
- **History screen**
  - Job title (role) is now **black and bold** for better visibility.
  - Action button labels shortened: "Open Folder" → "Folder", "Open Resume PDF" → "Resume PDF", "Open Cover PDF" → "Cover PDF", "Open QA PDF" → "QA PDF".

### Documentation
- Feature doc: `docs/features/HISTORY_SCREEN_IMPROVEMENTS_2026-02-25.md`.

---

## [1.0.0] - 2026-02-24

### Changed
- **Breaking**: Profiles now store a **Base Resume (plain text)** as the source of truth for the candidate instead of relying solely on prompt text.
- **Breaking**: DB schema bumped to migration **3**:
  - Added `base_resume_text` column to `profiles`.
  - Added `profile_prompts` table to store multiple prompts per profile.

### Added
- **Base Resume + Multi-Prompt flow**:
  - Profiles screen:
    - New **Base Resume** tab with a large textarea for the full resume (plain text).
    - New **Prompts** tab to create/edit/archive prompts per profile.
  - Generate screen:
    - When exactly one profile is selected and it has prompts, a **Prompt dropdown** appears to select which prompt to use for that run.
  - Pipeline & LLM:
    - Call B now receives base resume text + (optional) selected prompt text + rules + JD + Call A + questions for every generation.
    - Structured `resume` JSON is still merged into the HTML template as before; QA behaviour is unchanged.

### Notes
- Multi-profile generation continues to work; prompts are applied only in the single-profile path for this release.
- Existing databases are migrated in-place; historical generations remain valid and visible in History.

## [0.3.0] - 2026-02-19

### Added
- **Multi-task tabs on Generate screen**
  - Task 1 … Task 10 tabs; each tab has its own JD, URL, questions, and run state (progress, result, error)
  - Profile selection is at the root of the Generate screen (shared across all tasks)
  - Per-task state is preserved when switching tabs; tasks do not interrupt each other
  - Progress is keyed by task so multiple generations can run in parallel with correct progress per tab
  - Tab badges: idle / loading (…) / success (✓) / error (!) on each tab
  - Keyboard shortcuts: Ctrl+1 … Ctrl+9 for Task 1–9, Ctrl+0 for Task 10
  - Per-task localStorage: `resumeTailor_task_N_jdText`, `resumeTailor_task_N_sourceUrl`, `resumeTailor_task_N_questions`
  - After success, only that task’s inputs are cleared; result stays visible until next run or edit
  - Accessibility: tablist/tab/tabpanel roles, aria-selected, aria-controls, aria-labelledby

### Technical Details
- Backend: optional `taskId` in `generation:runFull` params and in every `generation:progress` payload (main, preload, electron.d.ts)
- Generate screen: `MAX_TASKS = 10`, per-task state, single active panel, progress dispatch by taskId
- Spec: `docs/features/MULTI_TASK_TABS_2026-02-19.md`

## [0.2.1] - 2026-02-16

### Added
- **Multi-profile generation**
  - Select multiple profiles on the Generate screen (checkbox list) and generate one tailored resume per profile for the same job
  - One job and one Call A (JD extraction); one Call B per selected profile; each profile gets its own output folder and generation record
  - Progress shows “Generating for [Profile Name] (i/N)”
  - After run: success message “Generated N resumes.” or “Generated X of N; Y failed.”; open PDFs from History
  - History lists one card per generation (same job can have multiple cards, one per profile), with profile name and Open folder / Resume / Cover / QA PDF links per card
  - Select all / Deselect all for profiles; selection persisted in localStorage
  - Single-profile flow unchanged (same API shape and UI when one profile selected)

### Fixed
- Generate screen: Profile checkbox and profile name now align vertically (consistent alignment and spacing).

### Changed
- Changelog: Documented versioning policy (patch = fixes/styling, minor = features, major = breaking).

## [0.2.0] - 2026-02-16

### Added
- **QA Feature**: Questions & Answers PDF generation
  - Optional questions input on Generate screen
  - Questions are appended to LLM API call when provided
  - QA array in CallBOutput JSON structure: `qa: [{question: string, answer: string}]`
  - Conditional QA PDF generation (only when questions provided)
  - QA PDF button on History screen (only when QA PDF exists)
  - Questions textarea with localStorage persistence
  - Question parsing supports multiple formats (newlines, numbered lists, bullets)
  - Question counter/preview display
  - Database migration 2: Added `qa_pdf_path` column to `generations` table

### Changed
- Updated database schema version to 2
- Generate screen now clears all input fields (JD, URL, Questions) after successful generation

### Technical Details
- New file: `main/pdf/qaHtml.ts` - QA PDF HTML builder
- Updated types: Added `qa` field to `CallBOutput`, `qa_pdf_path` to `Generation`
- Updated LLM integration: `buildCallBMessages()` and `runResumePayload()` now accept questions parameter
- Updated validation: Checks QA array when questions are provided
- Backward compatible: All QA features are optional, existing functionality preserved

## [0.1.0] - Initial Release

### Added
- Core resume generation functionality
- Job description extraction (Call A)
- Resume and cover letter generation (Call B)
- PDF generation for resume and cover letter
- Profile management (Rules + HTML Template)
- History screen with search functionality
- Settings screen for output path and API key configuration
- Local-first architecture with SQLite database
- Collision-proof folder structure
- Version tracking and traceability

---

## Version History Summary

- **1.2.0** (2026-02-25): History screen improvements – grid layout, filter by profile, job title black/bold, open job posting link, shortened button labels (Folder, Resume PDF, etc.).
- **1.1.0** (2026-02-25): Generate screen & app layout improvements – custom Prompt dropdown, full-width screens (Generate, History, Settings, Changelog), full-width taller Generate button; removed stale renderer `.js` so build uses TSX.
- **1.0.0** (2026-02-24): Base Resume + Multi-Prompt refactor (breaking: new DB fields, Call B now grounded in base resume and optional prompt per profile).
- **0.3.0** (2026-02-19): Multi-task tabs on Generate screen (Task 1–10, per-task state, tab badges, Ctrl+1…0)
- **0.2.1** (2026-02-16): Multi-profile generation; UI fix – profile checkbox alignment; versioning policy documented
- **0.2.0** (2026-02-16): QA Feature – Questions & Answers PDF generation
- **0.1.0**: Initial release with core functionality
