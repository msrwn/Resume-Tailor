import { useState, useEffect, useCallback } from 'react';
import type { Profile, Job, CallAOutput, CallBOutput } from '@shared/types';
import { normalizeJobUrl } from '@shared/jobUrl';

const MAX_TASKS = 10;

type ProgressState = {
  step: string;
  message: string;
  percent: number;
} | null;

type RunResultSingle = {
  kind: 'single';
  jobId: string;
  generationId?: string;
  job: Job | null;
  extraction?: CallAOutput;
  callBOutput?: CallBOutput;
  outputDir?: string;
  resumePdfPath?: string | null;
  coverPdfPath?: string | null;
  jdTxtPath?: string | null;
  qaPdfPath?: string | null;
};

type RunResultMulti = {
  kind: 'multi';
  jobId: string;
  total: number;
  succeeded: number;
};

type RunResult = RunResultSingle | RunResultMulti | null;

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

function getTaskStorageKey(taskIndex: number, field: 'jdText' | 'sourceUrl' | 'questions'): string {
  return `resumeTailor_task_${taskIndex}_${field}`;
}

function initTaskState(): Record<number, TaskState> {
  const state: Record<number, TaskState> = {};
  for (let n = 1; n <= MAX_TASKS; n++) {
    state[n] = {
      jdText: localStorage.getItem(getTaskStorageKey(n, 'jdText')) || '',
      sourceUrl: localStorage.getItem(getTaskStorageKey(n, 'sourceUrl')) || '',
      questions: localStorage.getItem(getTaskStorageKey(n, 'questions')) || '',
      loading: false,
      progress: null,
      result: null,
      error: null,
      errorDetail: null,
    };
  }
  return state;
}

function GenerateScreen() {
  const [taskState, setTaskState] = useState<Record<number, TaskState>>(initTaskState);
  const [activeTaskIndex, setActiveTaskIndex] = useState(1);

  // Root-level: profile selection and config
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedProfileIds, setSelectedProfileIds] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem('resumeTailor_selectedProfileIds');
      if (raw) {
        const parsed = JSON.parse(raw) as string[];
        return Array.isArray(parsed) ? parsed : [];
      }
    } catch {
      const one = localStorage.getItem('resumeTailor_selectedProfileId');
      return one ? [one] : [];
    }
    return [];
  });
  const [outputPathSet, setOutputPathSet] = useState(false);
  const [apiKeySet, setApiKeySet] = useState(false);

  // Persist per-task fields to localStorage when they change
  useEffect(() => {
    for (let n = 1; n <= MAX_TASKS; n++) {
      const t = taskState[n];
      if (!t) continue;
      localStorage.setItem(getTaskStorageKey(n, 'jdText'), t.jdText);
      localStorage.setItem(getTaskStorageKey(n, 'sourceUrl'), t.sourceUrl);
      localStorage.setItem(getTaskStorageKey(n, 'questions'), t.questions);
    }
  }, [taskState]);

  useEffect(() => {
    localStorage.setItem('resumeTailor_selectedProfileIds', JSON.stringify(selectedProfileIds));
  }, [selectedProfileIds]);

  const loadProfilesAndConfig = useCallback(async () => {
    try {
      const [profRes, defaultRes, configRes, keyRes] = await Promise.all([
        window.electronAPI.profilesList(),
        window.electronAPI.profilesGetDefault(),
        window.electronAPI.configGet(),
        window.electronAPI.secretsHasKey(),
      ]);
      if (profRes.success && profRes.profiles) {
        const availableProfiles = profRes.profiles.filter((p) => !p.archived_at);
        setProfiles(availableProfiles);
        setSelectedProfileIds((prev) => {
          const valid = prev.filter((id) => availableProfiles.some((p) => p.profile_id === id));
          if (valid.length > 0) return valid;
          if (defaultRes.success && defaultRes.profile) {
            return [defaultRes.profile.profile_id];
          }
          if (availableProfiles.length > 0) {
            return [availableProfiles[0].profile_id];
          }
          return [];
        });
      }
      setOutputPathSet(Boolean(configRes?.outputRootPath?.trim()));
      setApiKeySet(keyRes.success && keyRes.exists);
    } catch (e) {
      console.error('Load config/profiles', e);
    }
  }, []);

  useEffect(() => {
    loadProfilesAndConfig();
  }, [loadProfilesAndConfig]);

  // Progress: dispatch by taskId; ignore invalid taskId
  useEffect(() => {
    const unsubscribe = window.electronAPI.onGenerationProgress((data) => {
      const taskId = data.taskId;
      if (taskId == null || taskId < 1 || taskId > MAX_TASKS) return;
      setTaskState((prev) => ({
        ...prev,
        [taskId]: {
          ...prev[taskId],
          progress: { step: data.step, message: data.message, percent: data.percent },
        },
      }));
    });
    return unsubscribe;
  }, []);

  const updateTaskState = useCallback((taskIndex: number, update: Partial<TaskState>) => {
    setTaskState((prev) => ({
      ...prev,
      [taskIndex]: { ...prev[taskIndex], ...update },
    }));
  }, []);

  const activeTask = taskState[activeTaskIndex] ?? taskState[1];
  const hasValidJobUrl = (url: string) => normalizeJobUrl(url?.trim()).normalizedUrl !== null;
  const canGenerate =
    activeTask &&
    activeTask.jdText.trim().length > 0 &&
    activeTask.sourceUrl.trim().length > 0 &&
    hasValidJobUrl(activeTask.sourceUrl) &&
    selectedProfileIds.length > 0 &&
    outputPathSet &&
    apiKeySet &&
    !activeTask.loading;

  const toggleProfile = (profileId: string) => {
    setSelectedProfileIds((prev) =>
      prev.includes(profileId) ? prev.filter((id) => id !== profileId) : [...prev, profileId]
    );
  };
  const selectAllProfiles = () => {
    setSelectedProfileIds(profiles.map((p) => p.profile_id));
  };
  const deselectAllProfiles = () => {
    setSelectedProfileIds([]);
  };

  const parseQuestions = (text: string): string[] => {
    if (!text.trim()) return [];
    return text
      .split('\n')
      .map((line) =>
        line
          .replace(/^\d+\.\s*/, '')
          .replace(/^[-•*]\s*/, '')
          .trim()
      )
      .filter((q) => q.length > 0);
  };

  const handleGenerate = async () => {
    if (!canGenerate || !activeTask) return;
    const taskIndex = activeTaskIndex;

    updateTaskState(taskIndex, {
      loading: true,
      error: null,
      errorDetail: null,
      result: null,
      progress: { step: 'saving_job', message: 'Starting...', percent: 0 },
    });

    try {
      const parsedQuestions = parseQuestions(activeTask.questions);
      const res = await window.electronAPI.generationRunFull({
        jdText: activeTask.jdText.trim(),
        sourceUrl: activeTask.sourceUrl.trim() || undefined,
        profileIds: selectedProfileIds,
        questions: parsedQuestions.length > 0 ? parsedQuestions : undefined,
        taskId: taskIndex,
      });

      setTaskState((prev) => ({
        ...prev,
        [taskIndex]: { ...prev[taskIndex], progress: null },
      }));

      if (res.success && res.jobId) {
        if (res.results && res.results.length > 1) {
          const succeeded = res.results.filter((r) => !r.error).length;
          updateTaskState(taskIndex, {
            result: {
              kind: 'multi',
              jobId: res.jobId!,
              total: res.results.length,
              succeeded,
            },
            jdText: '',
            sourceUrl: '',
            questions: '',
          });
        } else if (res.results && res.results.length === 1) {
          const r = res.results[0];
          if (r.error) {
            updateTaskState(taskIndex, { result: null, error: r.error });
          } else {
            updateTaskState(taskIndex, {
              result: {
                kind: 'single',
                jobId: res.jobId!,
                generationId: r.generationId,
                job: res.job ?? null,
                extraction: res.extraction,
                callBOutput: undefined,
                outputDir: r.outputDir,
                resumePdfPath: r.resumePdfPath,
                coverPdfPath: r.coverPdfPath,
                jdTxtPath: undefined,
                qaPdfPath: r.qaPdfPath,
              },
              jdText: '',
              sourceUrl: '',
              questions: '',
            });
          }
        } else {
          updateTaskState(taskIndex, {
            result: {
              kind: 'single',
              jobId: res.jobId!,
              generationId: res.generationId,
              job: res.job ?? null,
              extraction: res.extraction,
              callBOutput: res.callBOutput,
              outputDir: res.outputDir,
              resumePdfPath: res.resumePdfPath,
              coverPdfPath: res.coverPdfPath,
              jdTxtPath: res.jdTxtPath,
              qaPdfPath: res.qaPdfPath,
            },
            jdText: '',
            sourceUrl: '',
            questions: '',
          });
        }
        // Clear this task's persisted inputs (state already updated above)
        localStorage.removeItem(getTaskStorageKey(taskIndex, 'jdText'));
        localStorage.removeItem(getTaskStorageKey(taskIndex, 'sourceUrl'));
        localStorage.removeItem(getTaskStorageKey(taskIndex, 'questions'));
      } else {
        updateTaskState(taskIndex, {
          error: res.error || 'Generation failed',
          errorDetail: res.rawResponse ?? res.validationErrors?.join('\n') ?? null,
        });
      }
    } catch (e) {
      setTaskState((prev) => ({
        ...prev,
        [taskIndex]: {
          ...prev[taskIndex],
          progress: null,
          error: e instanceof Error ? e.message : 'Generation failed',
        },
      }));
    } finally {
      setTaskState((prev) => ({
        ...prev,
        [taskIndex]: { ...prev[taskIndex], loading: false },
      }));
    }
  };

  const display = (value: string | null | undefined) =>
    value != null && value.trim() !== '' ? value.trim() : '—';

  // Tab badge status: idle | loading | success | error
  const getTaskBadgeStatus = (n: number): 'idle' | 'loading' | 'success' | 'error' => {
    const t = taskState[n];
    if (!t) return 'idle';
    if (t.loading) return 'loading';
    if (t.error) return 'error';
    if (t.result) return 'success';
    return 'idle';
  };

  // Keyboard: Ctrl+1..9 -> Task 1..9, Ctrl+0 -> Task 10
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!e.ctrlKey) return;
      const digit = e.key === '0' ? 10 : parseInt(e.key, 10);
      if (digit >= 1 && digit <= 10) {
        setActiveTaskIndex(digit);
        e.preventDefault();
        // Move focus to the selected tab after re-render
        const tabId = `generate-task-tab-${digit}`;
        setTimeout(() => document.getElementById(tabId)?.focus(), 0);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <div className="generate-screen">
      <h1>Generate</h1>
      <p className="screen-description">Paste a job description to extract details and prepare a tailored resume.</p>

      {/* Root-level profile selection */}
      <div className="generate-form generate-form-root">
        <label>Profiles</label>
        <div className="generate-profiles-list">
          <div className="generate-profiles-actions">
            <button type="button" className="button-secondary button-small" onClick={selectAllProfiles}>
              Select all
            </button>
            <button type="button" className="button-secondary button-small" onClick={deselectAllProfiles}>
              Deselect all
            </button>
          </div>
          <ul className="generate-profile-checkboxes">
            {profiles.map((p) => (
              <li key={p.profile_id}>
                <label className="generate-profile-checkbox-label">
                  <input
                    type="checkbox"
                    checked={selectedProfileIds.includes(p.profile_id)}
                    onChange={() => toggleProfile(p.profile_id)}
                  />
                  <span>{p.name} {p.is_default ? '(default)' : ''}</span>
                </label>
              </li>
            ))}
          </ul>
          {selectedProfileIds.length > 0 && (
            <p className="generate-profiles-hint">
              {selectedProfileIds.length} profile{selectedProfileIds.length !== 1 ? 's' : ''} selected
            </p>
          )}
        </div>
        {(!outputPathSet || !apiKeySet) && (
          <div className="message message-warning">
            {!outputPathSet && 'Set the output folder in Settings. '}
            {!apiKeySet && 'Add your API key in Settings.'}
          </div>
        )}
      </div>

      {/* Task tabs */}
      <div className="generate-task-tabs" role="tablist" aria-label="Tasks">
        {Array.from({ length: MAX_TASKS }, (_, i) => i + 1).map((n) => {
          const badge = getTaskBadgeStatus(n);
          return (
            <button
              key={n}
              type="button"
              role="tab"
              aria-selected={activeTaskIndex === n}
              aria-controls="generate-task-panel"
              id={`generate-task-tab-${n}`}
              className={`generate-task-tab ${activeTaskIndex === n ? 'active' : ''}`}
              onClick={() => setActiveTaskIndex(n)}
              title={n === 10 ? 'Task 10 (Ctrl+0)' : `Task ${n} (Ctrl+${n})`}
            >
              <span className="generate-task-tab-label">Task {n}</span>
              {badge === 'loading' && <span className="generate-task-badge generate-task-badge-loading" aria-hidden>...</span>}
              {badge === 'success' && <span className="generate-task-badge generate-task-badge-success" aria-hidden>✓</span>}
              {badge === 'error' && <span className="generate-task-badge generate-task-badge-error" aria-hidden>!</span>}
            </button>
          );
        })}
      </div>

      {/* Active task panel only */}
      <div
        id="generate-task-panel"
        role="tabpanel"
        aria-labelledby={`generate-task-tab-${activeTaskIndex}`}
        className="generate-task-panel"
      >
        {activeTask && (
          <div className="generate-form">
            <label>Job posting URL <span className="required">*</span></label>
            <input
              type="url"
              className="generate-url-input"
              placeholder="https://..."
              value={activeTask.sourceUrl}
              onChange={(e) => updateTaskState(activeTaskIndex, { sourceUrl: e.target.value })}
              disabled={activeTask.loading}
            />
            {activeTask.sourceUrl.trim() === '' && (
              <p className="generate-url-hint message message-warning">Job URL is required for generation.</p>
            )}
            {activeTask.sourceUrl.trim() !== '' && !hasValidJobUrl(activeTask.sourceUrl) && (
              <p className="generate-url-hint message message-error">Please enter a valid http(s) URL.</p>
            )}

            <label>
              Job description <span className="required">*</span>
            </label>
            <textarea
              className="generate-jd-input"
              placeholder="Paste the full job description here..."
              value={activeTask.jdText}
              onChange={(e) => updateTaskState(activeTaskIndex, { jdText: e.target.value })}
              rows={10}
              disabled={activeTask.loading}
            />

            <label>Questions (optional)</label>
            <textarea
              className="generate-questions-input"
              placeholder="Enter questions (one per line or separated by newlines)..."
              value={activeTask.questions}
              onChange={(e) => updateTaskState(activeTaskIndex, { questions: e.target.value })}
              rows={5}
              disabled={activeTask.loading}
            />
            {activeTask.questions.trim() && (
              <div className="questions-preview">
                {parseQuestions(activeTask.questions).length > 0 ? (
                  <span className="questions-count">
                    {parseQuestions(activeTask.questions).length} question
                    {parseQuestions(activeTask.questions).length !== 1 ? 's' : ''} entered
                  </span>
                ) : (
                  <span className="questions-warning">No valid questions detected</span>
                )}
              </div>
            )}

            <div className="generate-profile-button-group">
              <button
                type="button"
                className="button-primary"
                onClick={handleGenerate}
                disabled={!canGenerate}
              >
                {activeTask.loading
                  ? 'Generating…'
                  : selectedProfileIds.length > 1
                    ? `Generate resume & cover letter (${selectedProfileIds.length} profiles)`
                    : 'Generate resume & cover letter'}
              </button>
            </div>
          </div>
        )}

        {activeTask?.progress && (
          <div className="generate-progress">
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${activeTask.progress.percent}%` }} />
            </div>
            <p className="progress-message">{activeTask.progress.message}</p>
          </div>
        )}

        {activeTask?.error && (
          <div className="generate-error">
            <div className="message message-error">{activeTask.error}</div>
            {activeTask.errorDetail && (
              <details className="error-details">
                <summary>Technical details</summary>
                <pre className="error-detail-text">{activeTask.errorDetail}</pre>
              </details>
            )}
          </div>
        )}

        {activeTask?.result && !activeTask.loading && (
          <div className="generate-result">
            {activeTask.result.kind === 'multi' ? (
              <>
                <h2>Generation complete</h2>
                <p className="result-summary">
                  {activeTask.result.succeeded === activeTask.result.total
                    ? `Generated ${activeTask.result.succeeded} resume${activeTask.result.succeeded !== 1 ? 's' : ''}.`
                    : `Generated ${activeTask.result.succeeded} of ${activeTask.result.total}; ${activeTask.result.total - activeTask.result.succeeded} failed.`}
                </p>
                <p className="result-hint">View and open PDFs from the History screen.</p>
              </>
            ) : (
              (() => {
                const single = activeTask.result as RunResultSingle;
                return (
                  <>
                    <h2>Generation complete</h2>
                    <p className="result-summary">
                      Resume and cover letter PDFs and JD.txt have been saved to the output folder.
                    </p>
                    {(single.outputDir || single.resumePdfPath) && (
                      <div className="result-actions">
                        {single.outputDir && (
                          <button
                            type="button"
                            className="button-secondary"
                            onClick={() => window.electronAPI.filesOpenFolder(single.outputDir!)}
                          >
                            Open folder
                          </button>
                        )}
                        {single.resumePdfPath && (
                          <button
                            type="button"
                            className="button-secondary"
                            onClick={() => window.electronAPI.filesOpenFile(single.resumePdfPath!)}
                          >
                            Open resume PDF
                          </button>
                        )}
                        {single.coverPdfPath && (
                          <button
                            type="button"
                            className="button-secondary"
                            onClick={() => window.electronAPI.filesOpenFile(single.coverPdfPath!)}
                          >
                            Open cover letter PDF
                          </button>
                        )}
                        {single.qaPdfPath && (
                          <button
                            type="button"
                            className="button-secondary"
                            onClick={() => window.electronAPI.filesOpenFile(single.qaPdfPath!)}
                          >
                            Open QA PDF
                          </button>
                        )}
                      </div>
                    )}
                    <h3>Extracted details</h3>
                    <dl className="extracted-fields">
                      <dt>Company</dt>
                      <dd>{display(single.job?.company_name ?? single.extraction?.company_name)}</dd>
                      <dt>Job title</dt>
                      <dd>{display(single.job?.job_title ?? single.extraction?.job_title)}</dd>
                      <dt>Job type</dt>
                      <dd>{display(single.job?.job_type ?? single.extraction?.job_type)}</dd>
                      <dt>Contact email</dt>
                      <dd>{display(single.job?.contact_email ?? single.extraction?.contact?.email)}</dd>
                      <dt>Contact phone</dt>
                      <dd>{display(single.job?.contact_phone ?? single.extraction?.contact?.phone)}</dd>
                      {single.extraction?.contact?.follow_up_links?.length ? (
                        <>
                          <dt>Follow-up links</dt>
                          <dd>
                            <ul>
                              {(single.extraction?.contact?.follow_up_links ?? []).slice(0, 5).map((link, i) => (
                                <li key={i}>
                                  <a href={link} target="_blank" rel="noopener noreferrer">
                                    {link}
                                  </a>
                                </li>
                              ))}
                            </ul>
                          </dd>
                        </>
                      ) : null}
                    </dl>
                    {single.callBOutput?.cover_letter_text && (
                      <>
                        <h3>Cover letter</h3>
                        <div className="cover-letter-preview">{single.callBOutput.cover_letter_text}</div>
                      </>
                    )}
                  </>
                );
              })() ) }
          </div>
        )}
      </div>
    </div>
  );
}

export default GenerateScreen;
