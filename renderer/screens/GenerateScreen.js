import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect, useCallback } from 'react';
import { GenerateProfilesSelector } from '../components/GenerateProfilesSelector';
import { GenerateTaskTabs } from '../components/GenerateTaskTabs';
const MAX_TASKS = 10;
function getTaskStorageKey(taskIndex, field) {
    return `resumeTailor_task_${taskIndex}_${field}`;
}
function initTaskState() {
    const state = {};
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
    const [taskState, setTaskState] = useState(initTaskState);
    const [activeTaskIndex, setActiveTaskIndex] = useState(1);
    // Root-level: profile selection and config
    const [profiles, setProfiles] = useState([]);
    // Future: use per-profile mapping; current MVP uses a single promptId applied to all selected profiles.
    const [promptsByProfile, setPromptsByProfile] = useState({});
    const [selectedPromptId, setSelectedPromptId] = useState(undefined);
    const [selectedProfileIds, setSelectedProfileIds] = useState(() => {
        try {
            const raw = localStorage.getItem('resumeTailor_selectedProfileIds');
            if (raw) {
                const parsed = JSON.parse(raw);
                return Array.isArray(parsed) ? parsed : [];
            }
        }
        catch {
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
            if (!t)
                continue;
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
                    if (valid.length > 0)
                        return valid;
                    if (defaultRes.success && defaultRes.profile) {
                        return [defaultRes.profile.profile_id];
                    }
                    if (availableProfiles.length > 0) {
                        return [availableProfiles[0].profile_id];
                    }
                    return [];
                });
                // Load prompts for the first selected profile (for prompt dropdown)
                const primaryProfileId = (defaultRes.success && defaultRes.profile && defaultRes.profile.profile_id) ||
                    (availableProfiles[0] && availableProfiles[0].profile_id);
                if (primaryProfileId) {
                    try {
                        const resPrompts = await window.electronAPI.profilePromptsList(primaryProfileId);
                        if (resPrompts.success && resPrompts.prompts) {
                            setPromptsByProfile((prev) => ({ ...prev, [primaryProfileId]: resPrompts.prompts }));
                            if (!selectedPromptId && resPrompts.prompts.length > 0) {
                                setSelectedPromptId(resPrompts.prompts[0].prompt_id);
                            }
                        }
                    }
                    catch (e) {
                        console.error('Failed to load prompts for default profile', e);
                    }
                }
            }
            setOutputPathSet(Boolean(configRes?.outputRootPath?.trim()));
            setApiKeySet(keyRes.success && keyRes.exists);
        }
        catch (e) {
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
            if (taskId == null || taskId < 1 || taskId > MAX_TASKS)
                return;
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
    const updateTaskState = useCallback((taskIndex, update) => {
        setTaskState((prev) => ({
            ...prev,
            [taskIndex]: { ...prev[taskIndex], ...update },
        }));
    }, []);
    const activeTask = taskState[activeTaskIndex] ?? taskState[1];
    const canGenerate = activeTask &&
        activeTask.jdText.trim().length > 0 &&
        selectedProfileIds.length > 0 &&
        outputPathSet &&
        apiKeySet &&
        !activeTask.loading;
    const toggleProfile = (profileId) => {
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
                        setPromptsByProfile((prevPrompts) => ({ ...prevPrompts, [pid]: res.prompts }));
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
    const selectAllProfiles = () => {
        setSelectedProfileIds(profiles.map((p) => p.profile_id));
        setSelectedPromptId(undefined);
    };
    const deselectAllProfiles = () => {
        setSelectedProfileIds([]);
        setSelectedPromptId(undefined);
    };
    const parseQuestions = (text) => {
        if (!text.trim())
            return [];
        return text
            .split('\n')
            .map((line) => line
            .replace(/^\d+\.\s*/, '')
            .replace(/^[-•*]\s*/, '')
            .trim())
            .filter((q) => q.length > 0);
    };
    const handleGenerate = async () => {
        if (!canGenerate || !activeTask)
            return;
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
                            jobId: res.jobId,
                            total: res.results.length,
                            succeeded,
                        },
                        jdText: '',
                        sourceUrl: '',
                        questions: '',
                    });
                }
                else if (res.results && res.results.length === 1) {
                    const r = res.results[0];
                    if (r.error) {
                        updateTaskState(taskIndex, { result: null, error: r.error });
                    }
                    else {
                        updateTaskState(taskIndex, {
                            result: {
                                kind: 'single',
                                jobId: res.jobId,
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
                }
                else {
                    updateTaskState(taskIndex, {
                        result: {
                            kind: 'single',
                            jobId: res.jobId,
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
            }
            else {
                updateTaskState(taskIndex, {
                    error: res.error || 'Generation failed',
                    errorDetail: res.rawResponse ?? res.validationErrors?.join('\n') ?? null,
                });
            }
        }
        catch (e) {
            setTaskState((prev) => ({
                ...prev,
                [taskIndex]: {
                    ...prev[taskIndex],
                    progress: null,
                    error: e instanceof Error ? e.message : 'Generation failed',
                },
            }));
        }
        finally {
            setTaskState((prev) => ({
                ...prev,
                [taskIndex]: { ...prev[taskIndex], loading: false },
            }));
        }
    };
    // Tab badge status: idle | loading | success | error
    const getTaskBadgeStatus = (n) => {
        const t = taskState[n];
        if (!t)
            return 'idle';
        if (t.loading)
            return 'loading';
        if (t.error)
            return 'error';
        if (t.result)
            return 'success';
        return 'idle';
    };
    // Keyboard: Ctrl+1..9 -> Task 1..9, Ctrl+0 -> Task 10
    useEffect(() => {
        const onKeyDown = (e) => {
            if (!e.ctrlKey)
                return;
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
    return (_jsxs("div", { className: "generate-screen", children: [_jsx("h1", { children: "Generate" }), _jsx("p", { className: "screen-description", children: "Paste a job description to extract details and prepare a tailored resume." }), _jsx(GenerateProfilesSelector, { profiles: profiles, selectedProfileIds: selectedProfileIds, onToggleProfile: toggleProfile, onSelectAll: selectAllProfiles, onDeselectAll: deselectAllProfiles, outputPathSet: outputPathSet, apiKeySet: apiKeySet }), _jsx(GenerateTaskTabs, { activeTaskIndex: activeTaskIndex, maxTasks: MAX_TASKS, getBadgeStatus: getTaskBadgeStatus, onSelectTask: setActiveTaskIndex }), _jsxs("div", { id: "generate-task-panel", role: "tabpanel", "aria-labelledby": `generate-task-tab-${activeTaskIndex}`, className: "generate-task-panel", children: [activeTask && (_jsxs("div", { className: "generate-form", children: [selectedProfileIds.length === 1 && ((() => {
                                const pid = selectedProfileIds[0];
                                const prompts = promptsByProfile[pid] || [];
                                if (!prompts.length)
                                    return null;
                                return (_jsxs(_Fragment, { children: [_jsx("label", { children: "Prompt (optional)" }), _jsxs("select", { className: "generate-prompt-select", value: selectedPromptId ?? '', onChange: (e) => setSelectedPromptId(e.target.value || undefined), disabled: activeTask.loading, children: [_jsx("option", { value: "", children: "(Use profile rules + base resume only)" }), prompts.map((p) => (_jsx("option", { value: p.prompt_id, children: p.name }, p.prompt_id)))] })] }));
                            })()), _jsx("label", { children: "Job posting URL (optional)" }), _jsx("input", { type: "url", className: "generate-url-input", placeholder: "https://...", value: activeTask.sourceUrl, onChange: (e) => updateTaskState(activeTaskIndex, { sourceUrl: e.target.value }), disabled: activeTask.loading }), _jsxs("label", { children: ["Job description ", _jsx("span", { className: "required", children: "*" })] }), _jsx("textarea", { className: "generate-jd-input", placeholder: "Paste the full job description here...", value: activeTask.jdText, onChange: (e) => updateTaskState(activeTaskIndex, { jdText: e.target.value }), rows: 10, disabled: activeTask.loading }), _jsx("label", { children: "Questions (optional)" }), _jsx("textarea", { className: "generate-questions-input", placeholder: "Enter questions (one per line or separated by newlines)...", value: activeTask.questions, onChange: (e) => updateTaskState(activeTaskIndex, { questions: e.target.value }), rows: 5, disabled: activeTask.loading }), activeTask.questions.trim() && (_jsx("div", { className: "questions-preview", children: parseQuestions(activeTask.questions).length > 0 ? (_jsxs("span", { className: "questions-count", children: [parseQuestions(activeTask.questions).length, " question", parseQuestions(activeTask.questions).length !== 1 ? 's' : '', " entered"] })) : (_jsx("span", { className: "questions-warning", children: "No valid questions detected" })) })), _jsx("div", { className: "generate-profile-button-group", children: _jsx("button", { type: "button", className: "button-primary", onClick: handleGenerate, disabled: !canGenerate, children: activeTask.loading
                                        ? 'Generating…'
                                        : selectedProfileIds.length > 1
                                            ? `Generate resume & cover letter (${selectedProfileIds.length} profiles)`
                                            : 'Generate resume & cover letter' }) })] })), activeTask?.progress && (_jsxs("div", { className: "generate-progress", children: [_jsx("div", { className: "progress-bar", children: _jsx("div", { className: "progress-fill", style: { width: `${activeTask.progress.percent}%` } }) }), _jsx("p", { className: "progress-message", children: activeTask.progress.message })] })), activeTask?.error && (_jsxs("div", { className: "generate-error", children: [_jsx("div", { className: "message message-error", children: activeTask.error }), activeTask.errorDetail && (_jsxs("details", { className: "error-details", children: [_jsx("summary", { children: "Technical details" }), _jsx("pre", { className: "error-detail-text", children: activeTask.errorDetail })] }))] })), activeTask?.result && !activeTask.loading && (_jsx("div", { className: "generate-result", children: activeTask.result.kind === 'multi' ? (_jsxs(_Fragment, { children: [_jsx("h2", { children: "Generation complete" }), _jsx("p", { className: "result-summary", children: activeTask.result.succeeded === activeTask.result.total
                                        ? `Generated ${activeTask.result.succeeded} resume${activeTask.result.succeeded !== 1 ? 's' : ''}.`
                                        : `Generated ${activeTask.result.succeeded} of ${activeTask.result.total}; ${activeTask.result.total - activeTask.result.succeeded} failed.` }), _jsx("p", { className: "result-hint", children: "View and open PDFs from the History screen." })] })) : (_jsxs(_Fragment, { children: [_jsx("h2", { children: "Generation complete" }), _jsx("p", { className: "result-summary", children: "Resume and cover letter were generated for the selected profile." }), _jsx("p", { className: "result-hint", children: "View and open PDFs from the History screen." })] })) }))] })] }));
}
export default GenerateScreen;
