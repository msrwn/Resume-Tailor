# Prompt Traceability & History Metadata

**Status**: ✅ Completed  
**Created**: 2026-02-26  
**Version**: 1.4.1  

---

## 1. Overview

This feature makes it easier to understand **how** each resume was tailored by:

- Persisting the **selected profile prompt** across app navigation.
- Recording which **prompt** was used for each generation in the database.
- Surfacing the **prompt name on History cards** so users can see, at a glance, which prompt shaped a given resume.

---

## 2. Requirements

- Selected prompt on the **Generate** screen should not reset when navigating between screens or restarting the app (as long as the prompt still exists for the profile).
- Each **generation record** should store the `prompt_id` (nullable when no prompt is used).
- The **History** screen should show the prompt name for each generation when a prompt was used.
- Changes must be **backward compatible** with existing databases and generations.

---

## 3. Technical Approach

- Persist `selectedPromptId` in `localStorage` and restore it when `GenerateScreen` mounts.
- When loading prompts for a profile:
  - If the persisted `prompt_id` exists in the profile’s prompt list, keep it.
  - Otherwise, fall back to the first prompt (when available) or clear the selection.
- Add a nullable `prompt_id` column to `generations` via **Migration 4**.
- Extend the generation pipeline so every single-profile generation passes `prompt_id` into `createGeneration`.
- Update the History IPC handler to resolve `prompt_id` to a `promptName` using `profilePromptsDao.getPrompt`.
- Render the `promptName` on History cards under the profile name.

---

## 4. Implementation Checklist

- [x] Persist `selectedPromptId` to `localStorage` and restore it on load.
- [x] Validate the stored prompt against the current profile’s prompts; fall back safely.
- [x] Add `prompt_id` column to `generations` (Migration 4).
- [x] Extend `Generation` type and `CreateGenerationParams` with `prompt_id`.
- [x] Pass `prompt_id` into all `createGeneration` calls in the **single-profile** pipeline path.
- [x] Update `history:list` IPC to attach `promptName` per generation.
- [x] Show **“Prompt: &lt;name&gt;”** on History cards when present.

---

## 5. Database Changes

- **Migration 4** (`migration4_addGenerationPromptId`):
  - Adds a nullable `prompt_id TEXT` column to the `generations` table.
  - Leaves existing rows with `prompt_id = NULL` (older generations without prompt tracking).
- `Generation` type extended with:
  - `prompt_id: string | null`

---

## 6. API / IPC Changes

- No new IPC channels.
- `history:list` response payload extended:
  - Previously: `{ job, generation, profileName }`
  - Now: `{ job, generation, profileName, promptName }`
- Renderer typings updated in `renderer/types/electron.d.ts` to include `promptName`.

---

## 7. UI Changes

- **Generate screen**
  - Selected prompt is restored when returning to the Generate tab.
  - When prompts are loaded for a profile:
    - If the stored `prompt_id` is present in the prompt list, it remains selected.
    - Otherwise, the first available prompt is selected (or none if no prompts).

- **History screen**
  - Each card now optionally shows:
    - `Profile: {profileName}`
    - `Prompt: {promptName}` (only when a prompt was used).
  - Styling follows the existing subtle metadata pattern (`.history-item-prompt` mirrors `.history-item-profile`).

---

## 8. Testing Plan

- **Prompt persistence**
  - Select a profile and prompt on the Generate screen.
  - Navigate to other screens (Profiles, History, Settings) and back:
    - Confirm the same prompt remains selected.
  - Quit and relaunch the app:
    - Confirm the prompt is still selected when the profile and prompt still exist.
  - Archive or delete the selected prompt and reload:
    - Confirm the app falls back to another valid prompt or clears the selection without errors.

- **Prompt traceability in History**
  - Run a generation with a selected prompt.
  - Open the History screen:
    - Confirm the corresponding card shows `Prompt: {promptName}`.
  - Run another generation without a prompt (if supported):
    - Confirm that **no prompt line** is shown on that card.

- **Backward compatibility**
  - Open an existing database created before Migration 4:
    - Confirm migrations run without errors.
    - Confirm old history entries still display correctly (no prompt line for older generations).

---

## 9. Backward Compatibility

- Migration 4 is **additive only** (new nullable column).
- Older generations remain valid and display as before (no prompt metadata).
- New prompt traceability is only visible for generations created after this change.

