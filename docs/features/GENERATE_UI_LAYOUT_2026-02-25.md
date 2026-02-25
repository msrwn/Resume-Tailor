# Generate Screen & App Layout Improvements

**Status**: ✅ Completed  
**Created**: 2026-02-25  
**Version**: 1.1.0  

---

## 1. Overview

This feature improves the Generate screen and app-wide layout so that key UI elements stretch to use available width when the window is full size, and improves the Prompt dropdown and primary action button. It also documents naming for the overall process.

### 1.1 What do we call this process?

- **Resume tailoring** – The product and user goal: tailoring a resume (and cover letter) to a specific job description. Use this when describing the app or the outcome (“I’m tailoring my resume to this JD”).
- **Generation** / **generate flow** – The technical pipeline: paste JD → (optional) select prompt → run → Call A (extract) → Call B (resume + cover) → PDFs. Use this in docs and code (“generation pipeline”, “run generation”, “generate screen”).
- **This batch of work** – “Generate screen and layout improvements” or “UI/layout polish (v1.1.0)”: custom Prompt dropdown, full-width layouts, and Generate button styling.

---

## 2. Changes Delivered

### 2.1 Custom Prompt (optional) dropdown

- Replaced the native `<select>` with a **custom dropdown** (button + list) so option height and width are controllable.
- **Option height**: Comfortable tap targets (e.g. 44px min-height, 12px 14px padding); no longer limited by native `<option>` styling.
- **Width**: Dropdown and options stretch with the form (no fixed max-width).
- **Behaviour**: Click outside closes the list; accessibility via listbox/option and aria-selected.
- **Note**: Stale compiled `.js` files in `renderer/` were removed so Vite bundles the `.tsx` implementation (Vite resolves `.js` before `.tsx`).

### 2.2 Full-width layout (Generate, History, Settings, Changelog)

- **Generate screen**: Removed `max-width: 1100px`; content uses full width. Task tabs (Task 1–10) use `flex: 1` so they share the row. Prompt dropdown and URL input stretch.
- **History screen**: Removed `max-width: 1200px`; layout stretches.
- **Settings screen**: Removed `max-width: 800px`; layout stretches.
- **Changelog screen**: Removed `max-width: 800px`; layout stretches.

### 2.3 Generate button

- **Full width**: Primary “Generate resume & cover letter” button spans the full form width.
- **Height**: Increased size (e.g. min-height 48px, padding 14px 24px, font-size 15px) for better visibility and clickability.

### 2.4 Earlier related UX (referenced for context)

- **Modals**: Custom modal context (alert/confirm) instead of native `alert`/`confirm`; Profile save success uses an inline banner so focus stays in the form.
- **Profiles screen**: Prompts tab first, prompt list item layout (name + “Updated: …”), plus icon for “New prompt”.

---

## 3. Technical Summary

| Area | Detail |
|------|--------|
| **Components** | `PromptSelect` in `GenerateScreen.tsx` (custom dropdown); no new shared components. |
| **Styles** | `renderer/styles.css`: `.generate-prompt-select-wrap`, `.generate-prompt-select-trigger`, `.generate-prompt-select-list`, `.generate-prompt-select-option`; `.generate-screen`, `.history-screen`, `.settings-screen`, `.changelog-screen` (width / max-width); `.generate-task-tab` (flex: 1); `.generate-profile-button-group` and button sizing. |
| **Build** | Removed stale `renderer/**/*.js` (e.g. `GenerateScreen.js`, `App.js`) so Vite uses `.tsx` sources. |
| **Breaking** | None. |

---

## 4. Files Touched (for this round)

- `renderer/screens/GenerateScreen.tsx` – PromptSelect, full-width form usage.
- `renderer/styles.css` – All layout and dropdown/button styles above.
- Stale `renderer/**/*.js` – Deleted so build reflects TSX.

---

## 5. Verification

- Generate screen: One profile selected with prompts → custom Prompt dropdown; options have taller height; dropdown and URL input stretch; task tabs share width; Generate button full width and taller.
- History, Settings, Changelog: Content stretches when window is enlarged.
- Build: `npm run build` and `npm start` show the new UI (no old native select).
