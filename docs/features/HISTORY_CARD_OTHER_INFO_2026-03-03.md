# History Card Other Info (Manual Notes)

**Status**: ✅ Completed  
**Created**: 2026-03-03  
**Version**: 1.5.2  

---

## 1. Overview

Users can add **manual notes** (labeled **Other Info**) to each history card. This lets them record follow-up dates, contact notes, or any other information per application without leaving the app.

---

## 2. Requirements

- Each history card (per generation) has an **Other Info** section.
- When empty: show an **Add other info** control to open an editor.
- When filled: show the note text and an **Edit** control.
- Notes are stored per generation and persist across app restarts.
- Editing is inline (textarea + Save / Cancel) on the card.

---

## 3. Technical Approach

- Add a nullable **`notes`** column to the `generations` table (Migration 5).
- Extend `Generation` type and DAO with `notes`; add `updateGenerationNotes(generationId, notes)`.
- Expose IPC `generation:updateNotes` and preload API `generationUpdateNotes`.
- On the History screen, each card with a generation shows the Other Info block: view mode (text + “Edit”) or edit mode (textarea + Save/Cancel). Save calls the API and updates local state.

---

## 4. Implementation Checklist

- [x] Migration 5: add `notes TEXT NULL` to `generations`; safety check so column is added if missing.
- [x] `Generation` type and DAO: `notes`, `updateGenerationNotes`.
- [x] IPC and preload: `generation:updateNotes`, `generationUpdateNotes`.
- [x] History card UI: Other Info section, Add other info / Edit, inline textarea, Save/Cancel.
- [x] Styles for `.history-item-notes`, label, text, textarea, actions.

---

## 5. Database Changes

- **Migration 5** (`migration5_addGenerationNotes`): `ALTER TABLE generations ADD COLUMN notes TEXT NULL`.
- A post-migration safety check ensures the column exists whenever migrations run (handles stale builds).

---

## 6. API Changes

- **IPC**: `generation:updateNotes` `(generationId, notes)` → `{ success, generation?, error? }`.
- **Preload**: `generationUpdateNotes(generationId, notes)`.
- **Types**: `Generation.notes: string | null`.

---

## 7. UI Changes

- **History screen**: Each history item with a generation shows an **Other Info** block below contact (when present) and above actions.
- Label: **Other Info** (edit) / **Other Info:** (view).
- Empty state: **Add other info** link. Filled state: note text + **Edit** link.
- Edit mode: textarea, **Save** (primary), **Cancel** (secondary). Save persists via API and closes editor.

---

## 8. Testing Plan

- Add a note on a history card, save; reload and confirm it persists.
- Edit an existing note, save; confirm update.
- Clear the note (empty text + Save) and confirm it is stored as empty.
- Cancel during edit and confirm no change is persisted.

---

## 9. Backward Compatibility

- New column is nullable; existing generations have `notes = null`.
- Full app restart (or fresh open) runs migrations and adds the column; safety check ensures it exists even if migration 5 was previously skipped.
