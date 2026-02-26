import { useState, useEffect, useCallback, useRef } from 'react';
import type { Profile, ProfilePrompt, Job, CallAOutput, CallBOutput } from '@shared/types';
import { GenerateProfilesSelector } from '../components/GenerateProfilesSelector';
import { GenerateTaskTabs } from '../components/GenerateTaskTabs';

/** Custom dropdown for prompt selection so we can control option height and styling. */
function PromptSelect({
  prompts,
  value,
  onChange,
  disabled,
  id,
}: {
  prompts: ProfilePrompt[];
  value: string | undefined;
  onChange: (promptId: string | undefined) => void;
  disabled?: boolean;
  id?: string;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const displayLabel =
    value === undefined || value === ''
      ? '(Use profile rules + base resume only)'
      : prompts.find((p) => p.prompt_id === value)?.name ?? '(Use profile rules + base resume only)';

  useEffect(() => {
    if (!open) return;
    const handle = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open]);

  return (
    <div className="generate-prompt-field" ref={containerRef}>
      <label htmlFor={id}>Prompt (optional)</label>
      <div className="generate-prompt-select-wrap">
        <button
          id={id}
          type="button"
          className="generate-prompt-select-trigger"
          onClick={() => !disabled && setOpen((o) => !o)}
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label="Prompt (optional)"
        >
          <span className="generate-prompt-select-trigger-text">{displayLabel}</span>
          <span className="generate-prompt-select-chevron" aria-hidden>
            ▼
          </span>
        </button>
        {open && (
          <ul
            className="generate-prompt-select-list"
            role="listbox"
            aria-label="Prompt (optional)"
          >
            <li
              role="option"
              aria-selected={value === undefined || value === ''}
              className="generate-prompt-select-option"
              onClick={() => {
                onChange(undefined);
                setOpen(false);
              }}
            >
              (Use profile rules + base resume only)
            </li>
            {prompts.map((p) => (
              <li
                key={p.prompt_id}
                role="option"
                aria-selected={value === p.prompt_id}
                className="generate-prompt-select-option"
                onClick={() => {
                  onChange(p.prompt_id);
                  setOpen(false);
                }}
              >
                {p.name}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

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
  // Future: use per-profile mapping; current MVP uses a single promptId applied to all selected profiles.
  const [promptsByProfile, setPromptsByProfile] = useState<Record<string, ProfilePrompt[]>>({});
  const [selectedPromptId, setSelectedPromptId] = useState<string | undefined>(undefined);
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
        // Load prompts for the first selected profile (for prompt dropdown)
        const primaryProfileId =
          (defaultRes.success && defaultRes.profile && defaultRes.profile.profile_id) ||
          (availableProfiles[0] && availableProfiles[0].profile_id);
        if (primaryProfileId) {
          try {
            const resPrompts = await window.electronAPI.profilePromptsList(primaryProfileId);
            if (resPrompts.success && resPrompts.prompts) {
              setPromptsByProfile((prev) => ({ ...prev, [primaryProfileId]: resPrompts.prompts! }));
              if (!selectedPromptId && resPrompts.prompts.length > 0) {
                setSelectedPromptId(resPrompts.prompts[0].prompt_id);
              }
            }
          } catch (e) {
            console.error('Failed to load prompts for default profile', e);
          }
        }
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
  const canGenerate =
    activeTask &&
    activeTask.sourceUrl.trim().length > 0 &&
    activeTask.jdText.trim().length > 0 &&
    selectedProfileIds.length > 0 &&
    outputPathSet &&
    apiKeySet &&
    !activeTask.loading;

  const toggleProfile = (profileId: string) => {
    setSelectedProfileIds((prev) => {
      const next = prev.includes(profileId)
        ? prev.filter((id) => id !== profileId)
        : [...prev, profileId];
      // When a single profile is selected, load its prompts for the dropdown
      if (next.length === 1) {
        const pid = next[0];
        window.electronAPI
          .profilePromptsList(pid)
          .then((res) => {
            if (res.success && res.prompts) {
              setPromptsByProfile((prevPrompts) => ({ ...prevPrompts, [pid]: res.prompts! }));
              if (!selectedPromptId && res.prompts.length > 0) {
                setSelectedPromptId(res.prompts[0].prompt_id);
              }
            }
          })
          .catch((e) => console.error('Failed to load prompts for profile', pid, e));
      }
      return next;
    });
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
        // MVP: one promptId applied to all selected profiles; if none, backend falls back to rules/base resume only.
        promptId: selectedPromptId,
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
      <GenerateProfilesSelector
        profiles={profiles}
        selectedProfileIds={selectedProfileIds}
        onToggleProfile={toggleProfile}
        outputPathSet={outputPathSet}
        apiKeySet={apiKeySet}
      />

      {/* Task tabs */}
      <GenerateTaskTabs
        activeTaskIndex={activeTaskIndex}
        maxTasks={MAX_TASKS}
        getBadgeStatus={getTaskBadgeStatus}
        onSelectTask={setActiveTaskIndex}
      />

      {/* Active task panel only */}
      <div
        id="generate-task-panel"
        role="tabpanel"
        aria-labelledby={`generate-task-tab-${activeTaskIndex}`}
        className="generate-task-panel"
      >
        {activeTask && (
          <div className="generate-form">
            <div className="generate-toolbar">
              {/* Prompt selection (only when exactly one profile is selected and prompts exist) */}
              {selectedProfileIds.length === 1 && (() => {
                const pid = selectedProfileIds[0];
                const prompts = promptsByProfile[pid] || [];
                if (!prompts.length) return null;
                return (
                  <div className="generate-toolbar-prompt">
                    <PromptSelect
                      id="generate-prompt-select"
                      prompts={prompts}
                      value={selectedPromptId}
                      onChange={setSelectedPromptId}
                      disabled={activeTask.loading}
                    />
                  </div>
                );
              })()}
              <div className="generate-toolbar-actions">
                <button
                  type="button"
                  className="button-primary generate-toolbar-button"
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

            <label>
              Job posting URL <span className="required">*</span>
            </label>
            <input
              type="url"
              className="generate-url-input"
              placeholder="https://..."
              value={activeTask.sourceUrl}
              onChange={(e) => updateTaskState(activeTaskIndex, { sourceUrl: e.target.value })}
              disabled={activeTask.loading}
            />

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
              <>
                <h2>Generation complete</h2>
                <p className="result-summary">
                  Resume and cover letter were generated for the selected profile.
                </p>
                <p className="result-hint">View and open PDFs from the History screen.</p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default GenerateScreen;
