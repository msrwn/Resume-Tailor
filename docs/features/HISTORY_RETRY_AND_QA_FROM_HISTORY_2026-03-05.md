# History Retry & QA from History

**Status**: ✅ Completed  
**Created**: 2026-03-05  
**Version**: 1.7.0

---

## 1. Overview

This feature adds two related capabilities to the History screen:

- **Retry / Regenerate from history card**: rerun the tailoring pipeline for an existing application using the same job description, profile (base resume + rules), and prompt that were used originally, and update the history card with the new result.
- **Questions & answers from history card**: from an existing history card, let the user provide questions (like on the Generate screen) and generate tailored answers using the same JD and profile/resume context, producing/refreshing a QA PDF.

Both features **reuse the existing generation pipeline** (`generation:runFull` + `generation:progress`) and are implemented in a way that is **backward compatible**:

- No breaking changes to existing IPC contracts.
- No database schema changes.
- Existing flows from the Generate screen remain unchanged.

---

## 2. Requirements

### 2.1 Retry / Regenerate from history card

- Each history card that has a `generation` must offer a way to **rerun** the generation for that application.
- The retry must:
  - Reuse the **original JD text** and **job posting URL** from the stored `Job`.
  - Reuse the same **profile** (`Generation.profile_id`) and thereby the same **base resume** and **rules**.
  - Reuse the same **prompt** (`Generation.prompt_id`) when present.
- The user should see:
  - An explicit **Retry / Regenerate** action on the history card.
  - **Inline progress** (step + percentage) for the retry.
  - Clear **success / failure** feedback on the card.
- On success:
  - The history card should behave as if the **old result has been replaced**:
    - Status badge updated from `failed` → `success` when applicable.
    - Links/buttons (Folder, Resume PDF, Cover PDF, QA PDF) should open the **newly generated** outputs.
  - Under the hood, implementation must not break existing assumptions:
    - It is acceptable for a new `generation` row to be created, as long as the UI treats the latest one as the “current” result for that card.
- On failure:
  - The card should show a short error message.
  - Existing resume/cover/QA PDFs remain available and unchanged.

### 2.2 Questions & answers from history card

- For any history card with a **successful `generation`**, the user can:
  - Click an action such as **“Answer questions for this job”**.
  - Enter questions in a textarea (same parsing rules as Generate screen).
  - Click a **“Generate answers”** button to run the QA pipeline.
- Behaviour:
  - Questions are parsed into an array of strings (one per question).
  - The existing full generation pipeline is called with the same:
    - JD text (`job.jd_text`) and job URL (`job.source_url`).
    - Profile / base resume (`generation.profile_id`).
    - Prompt (`generation.prompt_id`, when present).
    - Plus the **questions array**.
  - The LLM uses the tailored resume and JD context to generate answers and a QA PDF, exactly as on the Generate screen.
- UX:
  - Inline **progress** (step + percent) while answers are being generated.
  - A clear **success message** when answers are ready.
  - A **QA PDF** button on the card opens the latest QA PDF.
  - If QA generation fails, the card shows a concise error and keeps previous outputs.

### 2.3 Non‑goals / Out of scope (for this iteration)

- No new database columns or migrations.
- No change to how the Generate screen works or how questions are passed from Generate.
- No new IPC channel unless absolutely necessary (MVP reuses `generation:runFull`).
- No UI for editing or viewing raw Q&A inline beyond lightweight, optional preview.

---

## 3. Technical Approach

### 3.1 Reuse existing pipeline for retry & QA

- Backend:
  - **Do not modify** the existing public signatures of:
    - `runFullGeneration` in `main/generation/pipeline.ts`.
    - `generation:runFull` IPC handler in `main/index.ts`.
    - `generationRunFull` and `onGenerationProgress` in `main/preload.ts` and `renderer/types/electron.d.ts`.
  - Retry and QA-from-history **call the same pipeline** that the Generate screen uses:
    - `generationRunFull({ jdText, sourceUrl, profileId, promptId, questions?, taskId })`
    - Progress events are consumed via `onGenerationProgress`, keyed by a **taskId** reserved for History.
- Frontend:
  - All new UI/state is localized to `renderer/screens/HistoryScreen.tsx`.
  - The History screen will:
    - Subscribe to `onGenerationProgress`.
    - Filter events by **History-specific task IDs** that do not conflict with Generate’s `1..10`.
    - Manage per-card state for retry and QA progress/errors.

### 3.2 Task IDs and progress routing

- Generate screen currently uses `taskId` values in the range `1..10` (one per task tab).
- History will use **distinct task IDs** to avoid collisions, e.g.:
  - `HISTORY_RETRY_TASK_ID = 101`
  - `HISTORY_QA_TASK_ID = 102`
- Progress handler in `HistoryScreen`:
  - Subscribes once in `useEffect`.
  - When `data.taskId === HISTORY_RETRY_TASK_ID` → update retry progress state.
  - When `data.taskId === HISTORY_QA_TASK_ID` → update QA progress state.

### 3.3 Retry / Regenerate flow (History)

1. **UI entry point**
   - In each history card’s actions row (where Job posting / Folder / Resume PDF / Cover PDF / QA PDF are shown), add:
     - A `Retry` button, visible when:
       - `generation` exists, and
       - `job.source_url` is non-empty (pipeline requires job URL).
   - When clicked, call `handleRetry(job, generation)`.

2. **State in `HistoryScreen.tsx`**
   - New local state:
     - `retryingGenerationId: string | null`
     - `retryProgress: { step: string; message: string; percent: number } | null`
     - `retryError: string | null`
   - At most one retry is processed at a time (MVP simplification).

3. **Calling the pipeline**
   - `handleRetry(job, generation)`:
     - Validates `job.source_url` (if missing, shows a modal/alert and returns).
     - Sets `retryingGenerationId` to `generation.generation_id`.
     - Clears `retryProgress` and `retryError`.
     - Calls:
       ```ts
       window.electronAPI.generationRunFull({
         jdText: job.jd_text,
         sourceUrl: job.source_url || undefined,
         profileId: generation.profile_id,
         promptId: generation.prompt_id || undefined,
         taskId: HISTORY_RETRY_TASK_ID,
       });
       ```

4. **Progress handling**
   - `onGenerationProgress` handler:
     - When `taskId === HISTORY_RETRY_TASK_ID`, update `retryProgress` (step, message, percent).
   - On the card:
     - While `retryingGenerationId === generation.generation_id` and `retryProgress` is non-null:
       - Show a compact progress bar + message.
       - Disable the Retry button for that card.

5. **Result handling & “replace” semantics**
   - When `generationRunFull` resolves:
     - If `res.success` is false:
       - Clear `retryProgress`.
       - Set `retryError` from `res.error` or a default message.
       - Keep `retryingGenerationId` until user navigates or retries.
     - If `res.success` is true (single-profile shape):
       - Use `res.generationId` to fetch the latest `Generation`:
         - `window.electronAPI.generationGet(res.generationId!)`.
       - Update the local `results` state:
         - For the card whose `generation?.generation_id` matches the original generation, replace its `generation` with the newly fetched one.
       - Clear `retryProgress`, `retryError`, and `retryingGenerationId`.
   - This makes the visible card behave as if it has been **updated in place**:
     - Status badge and paths (resume/cover/QA) now reflect the latest generation.
   - **Backend note**:
     - The pipeline may create a new `generation` row under the hood, but this is an **additive** change that does not break consumers.
     - The History UI simply chooses to show the **latest** generation for that job/profile/prompt combination.

### 3.4 Questions & answers flow (History)

1. **UI entry point**
   - On each card where:
     - `generation` exists, and
     - `generation.status === 'success'`,
   - Add a **Questions & answers** section under the notes (Other Info) block:
     - Default state: a button like **“Answer questions for this job”**.
     - When clicked:
       - Show a textarea for questions and actions:
         - Primary: **“Generate answers”**
         - Secondary: **“Cancel”**

2. **State in `HistoryScreen.tsx`**
   - New local state:
     - `qaEditingGenerationId: string | null`
     - `qaQuestionsDraft: string`
     - `qaLoadingGenerationId: string | null`
     - `qaProgress: { step: string; message: string; percent: number } | null`
     - `qaError: string | null`
   - At most one QA generation at a time (MVP).

3. **Question parsing**
   - Reuse the same parsing logic as `GenerateScreen`:
     - Split by newline.
     - Strip leading numbers (`1.`, `2.`) or bullets (`-`, `•`, `*`).
     - Trim and filter out empty lines.
   - Show a simple “N questions entered” count below the textarea (optional but recommended).

4. **Calling the pipeline**
   - `handleGenerateAnswers(job, generation)`:
     - Parses questions.
     - If no valid questions, show a local validation error and abort.
     - Sets `qaLoadingGenerationId`, clears `qaProgress` and `qaError`.
     - Calls:
       ```ts
       window.electronAPI.generationRunFull({
         jdText: job.jd_text,
         sourceUrl: job.source_url || undefined,
         profileId: generation.profile_id,
         promptId: generation.prompt_id || undefined,
         questions: parsedQuestions,
         taskId: HISTORY_QA_TASK_ID,
       });
       ```

5. **Progress handling**
   - `onGenerationProgress` handler:
     - When `taskId === HISTORY_QA_TASK_ID`, update `qaProgress`.
   - On the card:
     - While `qaLoadingGenerationId === generation.generation_id` and `qaProgress` is non-null:
       - Show a compact progress bar + status message.
       - Disable the “Generate answers” button.

6. **Result handling**
   - When `generationRunFull` resolves:
     - If `res.success` is false:
       - Clear `qaProgress`.
       - Set `qaError` from `res.error` or a default message.
     - If `res.success` is true:
       - Fetch the new `Generation` via `generationGet(res.generationId!)`.
       - Update the matching card’s `generation` in `results` to the new one:
         - Ensures `qa_pdf_path` and any updated resume/cover paths are reflected.
       - Clear `qaProgress`, `qaError`, `qaEditingGenerationId`, and `qaLoadingGenerationId`.
   - The QA PDF button on the card (already present in History when `qa_pdf_path` is non-null) will now open the latest QA PDF.
   - Optional enhancement:
     - Use `res.callBOutput?.qa` (when available) to render a **short inline preview** of Q&A under the card, without persisting additional structures.

---

## 4. Implementation Checklist

### 4.1 Foundation

- [ ] Create this feature doc (`HISTORY_RETRY_AND_QA_FROM_HISTORY_2026-03-05.md`).
- [ ] Confirm existing QA implementation (Call B + QA PDF) is wired and working end-to-end from Generate screen.

### 4.2 Backend (reuse existing)

- [ ] Verify `runFullGeneration` already accepts `questions?: string[]` and writes `qa_pdf_path` when provided.
- [ ] Verify `generation:runFull` IPC handler forwards `questions` and returns `qaPdfPath`.
- [ ] Verify `generationRunFull` and `onGenerationProgress` are correctly typed in `main/preload.ts` and `renderer/types/electron.d.ts`.
- [ ] **No changes** required to pipeline or IPC for this feature (reuse only).

### 4.3 Frontend – History retry

- [ ] Add History-specific task ID constants in `HistoryScreen.tsx`.
- [ ] Add retry state (`retryingGenerationId`, `retryProgress`, `retryError`).
- [ ] Subscribe to `onGenerationProgress` and route to retry state when `taskId === HISTORY_RETRY_TASK_ID`.
- [ ] Implement `handleRetry(job, generation)` to call `generationRunFull` with original JD, URL, profileId, promptId, and the History retry task ID.
- [ ] After success:
  - [ ] Call `generationGet` to fetch the new `Generation`.
  - [ ] Update the matching history card’s `generation` in local state.
- [ ] Render:
  - [ ] Retry button in card actions.
  - [ ] Inline progress bar + message while retry is running.
  - [ ] Inline error message if retry fails.

### 4.4 Frontend – Questions & answers from History

- [ ] Add QA state (`qaEditingGenerationId`, `qaQuestionsDraft`, `qaLoadingGenerationId`, `qaProgress`, `qaError`).
- [ ] Reuse `parseQuestions` logic from `GenerateScreen` (copy or extract into a shared helper).
- [ ] Subscribe to `onGenerationProgress` and route to QA state when `taskId === HISTORY_QA_TASK_ID`.
- [ ] Implement `handleGenerateAnswers(job, generation)`:
  - [ ] Parse questions and validate non-empty.
  - [ ] Call `generationRunFull` with questions and QA task ID.
- [ ] After success:
  - [ ] Call `generationGet` and update the matching card’s `generation`.
  - [ ] Clear QA editor state and show success hint (e.g., “Answers generated; open QA PDF”).
- [ ] Render on each card:
  - [ ] “Answer questions for this job” entry point.
  - [ ] Questions textarea + “Generate answers” / “Cancel” when in edit mode.
  - [ ] Progress UI and inline error message when relevant.

### 4.5 UI & UX polish

- [ ] Ensure Retry and QA actions are visually consistent with existing History actions (button-link style, spacing).
- [ ] Ensure progress elements are compact and do not push cards to excessive height.
- [ ] Ensure keyboard accessibility:
  - [ ] Buttons have proper `aria-label`s.
  - [ ] Textareas and buttons can be reached via Tab order.

---

## 5. Database Changes

- **None.**
- No new tables, columns, or migrations are required.
- Existing `Generation` schema (including `qa_pdf_path`) is sufficient.

---

## 6. API / IPC Changes

- **No breaking changes.**

Reused existing contracts:

- `generation:runFull` (main/index.ts)
- `generationRunFull` (preload and renderer types)
- `onGenerationProgress` (preload and renderer types)
- `generation:get` / `generationGet`
- `history:list` / `historyList`

---

## 7. UI Changes

- **History screen (`HistoryScreen.tsx`)**
  - **Retry / Regenerate:**
    - New “Retry” action on cards with a generation and job URL.
    - Inline progress and error handling while retry is running.
    - Card contents updated to reflect the latest generation on success.
  - **Questions & answers:**
    - New “Answer questions for this job” entry point.
    - Inline questions textarea + buttons to generate answers or cancel.
    - Progress indicator for QA generation.
    - QA PDF button continues to appear only when `qa_pdf_path` is non-null (now updated when QA is generated from History).

---

## 8. Testing Plan

### 8.1 Retry from History

- Generate several applications via Generate screen (success and failure cases).
- On History screen:
  - For a **failed** generation:
    - Click Retry.
    - Confirm:
      - Progress appears and updates.
      - On success, status badge becomes `success`.
      - Resume/Cover/QA links (when present) open the **new** PDFs.
  - For a **successful** generation:
    - Retry again.
    - Confirm:
      - No errors if JD and URL are valid.
      - A new call-b response and PDFs are written (manual verification via Folder).

### 8.2 Questions & answers from History

- Take a successful generation in History.
- Click “Answer questions for this job”.
- Enter multiple questions (lines, numbered, bulleted) and click “Generate answers”.
- Confirm:
  - Progress bar and messages show until completion.
  - After success, QA PDF button opens a document with Q&A pairs.
  - Resume and cover PDFs are still valid and updated if the pipeline regenerates them.

### 8.3 Regression / Backward compatibility

- Generate screen:
  - Ensure normal generation (with and without questions) still works.
  - Ensure task tabs and progress behave as before.
- History screen:
  - Existing cards (with and without QA) still show correctly.
  - Retry/QA actions are hidden when prerequisites (generation, job URL, success status) are missing.
  - No duplicate or broken IPC calls when History and Generate are open in the same session.

---

## 9. Backward Compatibility

- **No schema changes**; all database structures remain valid.
- **No breaking IPC changes**; all existing handlers keep their signatures and semantics.
- Retry and QA-from-history are purely **additive**, using existing generation infrastructure.
- If the new History UI is not used, app behaviour is unchanged.

