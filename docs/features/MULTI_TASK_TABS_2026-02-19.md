# Multi-Task Tabs on Generate Screen — Specification

**Status**: Final  
**Created**: 2026-02-19  
**Goal**: Support multiple independent “tasks” (Task 1 … Task 10) so users can run several tailored-resume generations in parallel, with profile selection shared at the root and per-task state preserved when switching tabs.

**In scope**: Tab badges, keyboard shortcuts (Ctrl+1…0), all edge-case handling below. **Out of scope**: Migration of legacy localStorage into Task 1.

---

## 1. Requirements Summary

| Requirement | Detail |
|-------------|--------|
| **Tabs** | Task 1, Task 2, … Task 10 on the Generate screen. |
| **Per-tab content** | Same as current Generate screen: URL, JD textarea, questions, Generate button, progress, result, error. |
| **Isolation** | Each task must not break or interrupt others; states preserved when switching tabs. |
| **Profile selection** | **Root-level only** — one profile selection for the whole Generate screen, shared by all tasks. |
| **Tab badges** | Each tab shows status: idle / loading / success / error (agreed). |
| **Keyboard** | Ctrl+1 … Ctrl+0 to switch to Task 1 … Task 10 (agreed). |

---

## 2. State Ownership

### 2.1 Root-level (shared)

- **Profiles** (list + **selectedProfileIds**): Loaded once, selected at the top of the Generate screen. All tasks use this selection when they run.
- **outputPathSet**, **apiKeySet**: From config/secrets; shared.
- **profiles** list: Shared.

### 2.2 Per-task (isolated)

For each task index `taskIndex` (e.g. 1..10):

- **jdText**, **sourceUrl**, **questions** — inputs for that task.
- **loading** — whether this task’s generation is in progress.
- **progress** — step, message, percent for this task only.
- **result** — RunResult (single or multi) for this task.
- **error**, **errorDetail** — error state for this task.

So: **profile selection is shared; JD, URL, questions, and run state are per-task.**

---

## 3. Implementation Approach

### 3.1 UI structure

```
Generate screen
├── [Profile selection block]        ← root (existing Profiles UI)
├── [Task tabs: Task 1 | Task 2 | … | Task 10]
└── [Active task panel]
    ├── Job URL (optional)
    ├── Job description *
    ├── Questions (optional)
    ├── Generate button
    ├── Progress (if this task is loading)
    ├── Error (if this task failed)
    └── Result (if this task succeeded)
```

- Only the **active** task’s panel is rendered (see 4.2; single-panel approach).  
- **Tab badges** (in scope): Each tab shows status — idle, loading (spinner), success (checkmark), or error (exclamation) — so the user sees which tasks are in progress or failed without opening the tab.

### 3.2 Data structure (renderer)

- **activeTaskIndex**: number (1..10), which tab is selected.
- **taskState**: record keyed by task index, e.g.:

```ts
type TaskState = {
  jdText: string;
  sourceUrl: string;
  questions: string;
  loading: boolean;
  progress: ProgressState;
  result: RunResult;
  error: string | null;
  errorDetail: string | null;
};

// e.g. taskState[1] .. taskState[10]
const [taskState, setTaskState] = useState<Record<number, TaskState>>(() => initTaskState());
```

- **Profiles** and **selectedProfileIds** stay at the same level as today; the profile block is rendered once above the tabs.

### 3.3 Progress must be keyed by task (critical)

**Current behaviour**: Main process sends `generation:progress` with `{ step, message, percent }` only. There is no task or job identifier. If two tasks run at once, both streams of progress events go to the same listener and overwrite each other — only one task would show progress, and it would be mixed.

**Required change**:

1. **Renderer** passes a **taskId** (e.g. task index 1..10) when calling `generationRunFull`.
2. **Main** accepts optional `taskId` in the params and includes it in every progress event:  
   `mainWindow?.webContents.send('generation:progress', { taskId, step, message, percent })`.
3. **Preload** keeps forwarding the same payload (with `taskId`) to the renderer.
4. **Renderer** subscribes once to `onGenerationProgress` and dispatches to the correct task:  
   `setTaskState(prev => ({ ...prev, [data.taskId]: { ...prev[data.taskId], progress: { ... } } }))`.  
   Ignore events with missing or invalid `taskId` (e.g. out of 1..MAX_TASKS) so stale or malformed payloads do not corrupt state.

Pipeline code does not need to know about taskId; only the IPC layer in main (and the progress callback it passes) need to add and send `taskId`.

### 3.4 Persistence (localStorage)

- **Current**: `resumeTailor_jdText`, `resumeTailor_sourceUrl`, `resumeTailor_questions`, `resumeTailor_selectedProfileIds`.
- **With tasks**: Keep `resumeTailor_selectedProfileIds` as is (root). For each task, e.g.:
  - `resumeTailor_task_1_jdText`, `resumeTailor_task_1_sourceUrl`, `resumeTailor_task_1_questions`
  - … same for task_2 … task_10.

On load, initialize `taskState[n]` from these keys (or defaults). On change, write back. Optional: only persist when the user leaves a tab or on a short debounce to avoid excessive writes.

### 3.5 Generate button and “can generate”

- **Per-task** “can generate”:  
  `jdText.trim().length > 0 && selectedProfileIds.length > 0 && outputPathSet && apiKeySet && !taskState[activeTaskIndex].loading`
- Each task has its own Generate button; clicking it starts generation for that task only, using **root** `selectedProfileIds` and that task’s jdText, sourceUrl, questions.

### 3.6 Clearing after success

- **Decided**: Clear **only that task’s** inputs (JD, URL, questions) after a successful run. Result stays visible until the user edits or runs again. This lets the user refill and run again in the same slot without losing other tasks’ state.
- When **starting a new run** for a task, clear that task’s result, error, and errorDetail so the UI shows fresh progress and outcome for that run.

### 3.7 Tab badges (in scope)

- **Idle**: No icon or neutral state.
- **Loading**: Spinner or “…” so the user sees which tab is generating.
- **Success**: Checkmark or success icon after generation completes.
- **Error**: Exclamation or error icon when that task’s run failed.
- Badge is visual only; no need to change tab focus. Improves at-a-glance status when multiple tasks run in parallel.

### 3.8 Keyboard shortcuts (in scope)

- **Ctrl+1** … **Ctrl+9**: Switch to Task 1 … Task 9.
- **Ctrl+0**: Switch to Task 10 (consistent with browser tab convention).
- Attach listener in Generate screen (or root app) when the Generate screen is active; remove on unmount or route change. Prevent default when handled so browser doesn’t switch its own tabs.

---

## 4. Edge Cases & Improvements

### 4.1 Progress without taskId

- **Issue**: With multiple tasks running, progress without a taskId would be ambiguous.
- **Fix**: Add `taskId` to the generation API and progress payload as in 3.3.

### 4.2 Unmounting vs hiding task panels

- **Decided (Option A)**: Single panel; only render the active task’s form. State lives in `taskState[activeTaskIndex]`; switching tabs only changes `activeTaskIndex`. No unmount, so no loss of state and minimal DOM (scalable if task count ever increases).
- Alternative (Option B): Render all 10 panels and hide non-active with CSS; state still in parent. Use only if product needs “all panels in DOM” for a specific reason.
- **Avoid**: Unmounting a task when switching away and remounting when coming back without keeping state in the parent — that would lose state.

### 4.3 Profile change while a task is running

- User selects profiles at root and starts Task 1. While Task 1 is generating, user changes profile selection and opens Task 2.
- **Correct behaviour**: Task 1 continues with the profile set **at the time its Generate was clicked**. Task 2’s next run will use the **new** selection. No need to change anything; just use `selectedProfileIds` at invoke time for each run.

### 4.4 Multiple tasks generating at once

- User starts Task 1, then switches to Task 2 and starts it. Both run in parallel.
- **Backend**: `ipcMain.handle('generation:runFull', ...)` is invoked per call; Node is single-threaded but each run is async, so multiple runs can be in flight. No change needed for concurrency.
- **Renderer**: Each run is a separate `generationRunFull` call; progress must be keyed by taskId so each task’s progress bar and message stay correct.

### 4.5 Tab badges

- **In scope**: See 3.7. Each tab shows idle / loading / success / error so the user can see “Task 1 is still generating” and “Task 3 failed” without opening the tab.

### 4.6 Empty / never-used tasks

- All 10 tabs are always visible (Task 1 … Task 10). Empty tasks have default state (empty strings, no progress/result/error). No need to “add” or “remove” tasks.

### 4.7 API key / output path missing

- Warning (“Set output folder in Settings”, “Add API key”) is already root-level. Show it once above or below the profile block; no need to duplicate per task.

### 4.8 Can Generate when no profile selected

- `canGenerate` already requires `selectedProfileIds.length > 0`. With profile at root, all tasks share this; if no profile is selected, no task can generate. Good.

### 4.9 Persistence key collisions

- Use a clear naming scheme: `resumeTailor_task_${n}_jdText` etc., with `n` in 1..10. Legacy keys (`resumeTailor_jdText`, etc.) are **not** migrated into Task 1 (migration out of scope); new users and existing users both get fresh per-task keys. No collision as long as `n` is from a fixed set (e.g. 1..10).

### 4.10 History and multi-task

- History screen is unchanged; it lists jobs/generations. Each task’s run creates its own job (and generations). So History will show entries from all tasks; no need to tag “from Task 3” unless you want that for UX (optional).

---

## 5. Summary of Code Touches

| Area | Change |
|------|--------|
| **Main (index.ts)** | Add optional `taskId` to params for `generation:runFull`; include `taskId` in every `generation:progress` payload. |
| **Preload** | Pass through `taskId` in invoke and in progress listener. |
| **electron.d.ts** | Extend `generationRunFull` params and `onGenerationProgress` callback payload with optional `taskId`. |
| **GenerateScreen** | Task tabs (1..10), root profile block, per-task state (`taskState`), single active panel. Use `taskId` when calling run and when handling progress. Persist per-task fields to localStorage. Tab badges on each tab. Keyboard: Ctrl+1…0 to switch tasks. Clear only active task’s inputs after success. |

---

## 6. Scalability & Maintainability

### 6.1 Task count

- **Constant**: Define `MAX_TASKS = 10` (e.g. in a shared constants file or at top of GenerateScreen). Use it for tab list, `taskState` keys, localStorage keys, and keyboard shortcut range. Changing to 5 or 15 later is a single change.

### 6.2 Performance

- **Single active panel** (4.2): Only one task’s form is in the DOM at a time. No impact if `MAX_TASKS` increases. No need to lazy-load; 10 slots of lightweight state are fine.
- **Progress**: One global progress listener; dispatch by `taskId`. No N listeners for N tasks.
- **localStorage**: Write on change (or debounced). Keys are O(MAX_TASKS); no unbounded growth.

### 6.3 Extensibility

- If later you add “add/remove task” or dynamic count: `taskState` can stay as `Record<number, TaskState>`; tab list and `taskId` would derive from a list of task ids instead of 1..10. Progress and IPC already key by `taskId`, so no backend change.
- If you add “duplicate task”: copy `taskState[src]` (jdText, sourceUrl, questions) into another slot; no API change.

### 6.4 Accessibility

- **Tabs**: Use semantic tab pattern (e.g. `role="tablist"`, `role="tab"`, `role="tabpanel"`), `aria-selected`, `aria-controls`, and `id` links so screen readers and keyboard nav work. Ensure focus moves to the active panel when switching tabs (or document that focus stays on the tab bar).
- **Keyboard**: Ctrl+1…0 are in addition to normal tab/focus order; document in UI (e.g. tooltip or short help) so users discover them.

### 6.5 Out of scope (confirmed)

- **Migration**: No automatic copy of legacy `resumeTailor_jdText` / `resumeTailor_sourceUrl` / `resumeTailor_questions` into Task 1. Existing users start with empty task slots unless we add migration in a later change.

---

## 7. Checklist Before Implementation

- [ ] `MAX_TASKS` constant introduced and used everywhere (tabs, state, storage, shortcuts).
- [ ] Main/preload/electron.d.ts: `taskId` in runFull params and progress payload.
- [ ] GenerateScreen: root profile block; task tabs with badges; single active panel; `taskState`; progress dispatch by `taskId`; per-task localStorage; clear-on-success for active task only.
- [ ] Tab badges: idle / loading / success / error per tab.
- [ ] Keyboard: Ctrl+1…0 bound when Generate screen is active, Ctrl+0 → Task 10.
- [ ] Tab and panel markup and attributes for accessibility (tablist/tab/tabpanel, aria-*, focus).
- [ ] Progress handler ignores events with missing or invalid `taskId`.
- [ ] No migration of legacy localStorage keys.

---

## 8. Implementation Order: Phased vs One-Go

**Recommendation: implement in multiple steps** to reduce risk and make failures easier to isolate.

### Option A — Phased (recommended)

| Step | Scope | Why this order |
|------|--------|-----------------|
| **1. Backend only** | Main: add optional `taskId` to `generation:runFull` params and to every `generation:progress` payload. Preload + `electron.d.ts`: pass through `taskId`. | No UI change. Existing Generate screen keeps working (call with `taskId: 1` or omit; main sends `taskId` in progress so future UI can dispatch). You can run one generation and confirm progress still works. |
| **2. Frontend core** | GenerateScreen: `MAX_TASKS`, tabs (Task 1…10), root profile block, per-task state, single active panel, pass `taskId` when calling run, progress handler dispatches by `taskId`, per-task localStorage, clear-on-success for that task. **No badges or keyboard yet.** | Validates the full flow (tabs, state, progress per task, parallel runs) with minimal UI surface. If something breaks, it’s in this refactor. |
| **3. Polish** | Tab badges (idle / loading / success / error), keyboard Ctrl+1…0, accessibility (tablist/tab/tabpanel, aria-*, focus). | Additive only; low risk. |

After each step: run the app, run a generation (single and, in step 2+, multiple tasks), switch tabs, and confirm state and progress behave as specified.

### Option B — One-go

- Implement all of Section 5 (and checklist) in a single change. Faster to ship but harder to debug if something goes wrong (e.g. progress wrong task, state lost, or localStorage key bug). Prefer only if the codebase is small and you are comfortable reverting or bisecting a large commit.

### Summary

- **Phased**: fewer unexpected errors, easier to pinpoint regressions, same final result.
- **One-go**: one PR and one test pass, but higher risk of subtle bugs (progress, state, keys) that are harder to trace.
