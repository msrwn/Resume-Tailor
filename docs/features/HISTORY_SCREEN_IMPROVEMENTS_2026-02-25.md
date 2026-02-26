# History Screen Improvements

**Status**: ✅ Completed  
**Created**: 2026-02-25  
**Version**: 1.2.0  

---

## 1. Overview

This feature improves the History screen so more application cards are visible at once, search can be filtered by profile, job titles stand out, job postings can be opened when a URL is available, and action button labels are shortened (remove "Open" prefix).

---

## 2. Changes Delivered

### 2.1 Grid layout

- Replaced the single-column list with a **responsive grid** (`.history-grid`).
- Cards use `grid-template-columns: repeat(auto-fill, minmax(340px, 1fr))` so multiple cards fit on one screen; columns adapt to window width.

### 2.2 Search with filter by profile

- Added a **profile filter** dropdown ("All profiles" or a specific profile) next to the search input.
- Search applies both the text query (company, role, keywords) and the selected profile.
- Clear resets both search text and profile filter.
- Backend: `history:list` accepts optional `profile_id` and returns only generations for that profile when set.

### 2.3 Job title styling

- Job title (role) is now **black** and **bold** (`.history-item-role`) so it stands out from the company name and metadata.

### 2.4 Open job posting

- When a job has a **source URL** (`job.source_url`), a **"Job posting"** link is shown on the card.
- Clicking it opens the URL in the default browser via a new IPC handler `files:openUrl` (uses Electron `shell.openExternal`).

### 2.5 Button label shortening

- "Open Folder" → **Folder**
- "Open Resume PDF" → **Resume PDF**
- "Open Cover PDF" → **Cover PDF**
- "Open QA PDF" → **QA PDF**

---

## 3. Technical Summary

| Area | Detail |
|------|--------|
| **Components** | `HistoryScreen.tsx`: profile filter state, profiles list from `profilesList`, grid container, job link button, shortened button labels. |
| **Styles** | `renderer/styles.css`: `.history-grid` (grid layout), `.history-profile-filter` (dropdown), `.history-item-role` (color #000, font-weight bold). |
| **API** | `history:list` query accepts optional `profile_id`; main filters `byGeneration` by `generation.profile_id` when provided. |
| **IPC** | New `files:openUrl` (main) / `filesOpenUrl` (preload, electron.d.ts) to open URLs in the default browser. |
| **Breaking** | None. |

---

## 4. Files Touched

- `renderer/screens/HistoryScreen.tsx`
- `renderer/styles.css`
- `main/index.ts` (history handler, `files:openUrl`)
- `main/preload.ts` (`historyList` profile_id, `filesOpenUrl`)
- `renderer/types/electron.d.ts`
