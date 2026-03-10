import { useState, useEffect } from 'react';
import type { Job, Generation, Profile } from '@shared/types';
import { useModal } from '../context/ModalContext';
import { HistorySearchBar } from '../components/HistorySearchBar';
import { HistoryResults } from '../components/HistoryResults';

type HistoryResult = {
  job: Job;
  generation: Generation | null;
  profileName: string | null;
  promptName: string | null;
};

function HistoryScreen() {
  const modal = useModal();
  const [results, setResults] = useState<HistoryResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [profileFilterId, setProfileFilterId] = useState<string>('');
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [dateRange, setDateRange] = useState<'all' | 'today' | '7d' | '30d' | 'custom'>('all');
  const [customFrom, setCustomFrom] = useState<string>('');
  const [customTo, setCustomTo] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [counts, setCounts] = useState<{ total: number; today: number } | null>(null);
  const [editingNotesId, setEditingNotesId] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState('');
  const [editingJobId, setEditingJobId] = useState<string | null>(null);
  const [jobDraftCompany, setJobDraftCompany] = useState('');
  const [jobDraftTitle, setJobDraftTitle] = useState('');

  // Retry / regenerate state (one active retry at a time for MVP).
  const [retryingGenerationId, setRetryingGenerationId] = useState<string | null>(null);
  const [retryProgress, setRetryProgress] = useState<{
    step: string;
    message: string;
    percent: number;
  } | null>(null);
  const [retryError, setRetryError] = useState<string | null>(null);

  // Questions & answers from history (one active QA generation at a time for MVP).
  const [qaEditingGenerationId, setQaEditingGenerationId] = useState<string | null>(null);
  const [qaQuestionsDraft, setQaQuestionsDraft] = useState('');
  const [qaLoadingGenerationId, setQaLoadingGenerationId] = useState<string | null>(null);
  const [qaProgress, setQaProgress] = useState<{
    step: string;
    message: string;
    percent: number;
  } | null>(null);
  const [qaError, setQaError] = useState<string | null>(null);

  // Pagination state for history results.
  const PAGE_SIZE = 50;
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [currentQuery, setCurrentQuery] = useState<
    | {
        keyword?: string;
        profile_id?: string;
        fromDate?: string;
        toDate?: string;
      }
    | undefined
  >(undefined);
  const [nextOffset, setNextOffset] = useState(0);

  // Task IDs reserved for history flows so we don't collide with GenerateScreen's 1..10.
  const HISTORY_RETRY_TASK_ID = 101;
  const HISTORY_QA_TASK_ID = 102;

  useEffect(() => {
    // Restore last-used search options from localStorage so filters persist across navigation.
    try {
      const raw = window.localStorage.getItem('historySearchState_v1');
      if (raw) {
        const saved = JSON.parse(raw) as {
          searchQuery?: string;
          profileFilterId?: string;
          dateRange?: 'all' | 'today' | '7d' | '30d' | 'custom';
          customFrom?: string;
          customTo?: string;
        };
        if (saved.searchQuery) setSearchQuery(saved.searchQuery);
        if (saved.profileFilterId) setProfileFilterId(saved.profileFilterId);
        if (saved.dateRange) setDateRange(saved.dateRange);
        if (saved.customFrom) setCustomFrom(saved.customFrom);
        if (saved.customTo) setCustomTo(saved.customTo);
        const initialQuery = buildSearchQuery(
          saved.searchQuery ?? '',
          saved.profileFilterId ?? '',
          saved.dateRange ?? 'all',
          saved.customFrom ?? '',
          saved.customTo ?? ''
        );
        loadHistory(initialQuery, saved.searchQuery ?? '');
      } else {
        loadHistory(undefined, '');
      }
    } catch {
      loadHistory(undefined, '');
    }
    loadCounts();
  }, []);

  useEffect(() => {
    // Persist current search options so they survive tab navigation and restarts.
    const state = {
      searchQuery,
      profileFilterId,
      dateRange,
      customFrom,
      customTo,
    };
    try {
      window.localStorage.setItem('historySearchState_v1', JSON.stringify(state));
    } catch {
      // ignore storage errors
    }
  }, [searchQuery, profileFilterId, dateRange, customFrom, customTo]);

  useEffect(() => {
    (async () => {
      try {
        const listResponse = await window.electronAPI.profilesList();
        if (listResponse.success && listResponse.profiles) {
          setProfiles(listResponse.profiles);

          // If a previously selected profile filter no longer exists in the DB
          // (for example after swapping databases), clear the filter so it
          // doesn't hide all history results.
          if (profileFilterId) {
            const stillExists = listResponse.profiles.some(
              (p) => p.profile_id === profileFilterId
            );
            if (!stillExists) {
              setProfileFilterId('');
              const query = buildSearchQuery(
                searchQuery,
                '',
                dateRange,
                customFrom,
                customTo
              );
              loadHistory(query, searchQuery);
            }
          }
        }
      } catch {
        setProfiles([]);
      }
    })();
  }, []);

  // Listen for generation progress events and route history-specific taskIds
  // to local retry / QA progress state.
  useEffect(() => {
    const unsubscribe = window.electronAPI.onGenerationProgress((data) => {
      if (data.taskId === HISTORY_RETRY_TASK_ID) {
        setRetryProgress({
          step: data.step,
          message: data.message,
          percent: data.percent,
        });
      } else if (data.taskId === HISTORY_QA_TASK_ID) {
        setQaProgress({
          step: data.step,
          message: data.message,
          percent: data.percent,
        });
      }
    });
    return unsubscribe;
  }, []);

  const loadCounts = async () => {
    try {
      const res = await window.electronAPI.historyGetCounts();
      if (res.success && res.total !== undefined && res.today !== undefined) {
        setCounts({ total: res.total, today: res.today });
      }
    } catch {
      setCounts(null);
    }
  };

  const loadHistory = async (
    query?: {
      keyword?: string;
      profile_id?: string;
      fromDate?: string;
      toDate?: string;
    },
    keywordFilter?: string
  ) => {
    // Initial load for a given filter set (reset results and offset).
    const effectiveQuery = query ?? currentQuery;
    setCurrentQuery(effectiveQuery);
    setLoading(true);
    setIsLoadingMore(false);
    setError(null);
    setNextOffset(0);
    try {
      const response = await window.electronAPI.historyList({
        ...(effectiveQuery ?? {}),
        limit: PAGE_SIZE,
        offset: 0,
      });
      if (response.success && response.results) {
        let nextResults = response.results;

        // Extra client-side keyword filter as a safety net in case the
        // backend keyword filter isn't applied for some combinations.
        const trimmed = (keywordFilter ?? '').trim().toLowerCase();
        if (trimmed) {
          nextResults = nextResults.filter(({ job, generation, profileName, promptName }) => {
            const haystacks: string[] = [];
            if (job.company_name) haystacks.push(job.company_name);
            if (job.job_title) haystacks.push(job.job_title);
            if (job.jd_text) haystacks.push(job.jd_text);
            if (job.job_description_clean) haystacks.push(job.job_description_clean);
            if (job.contact_email) haystacks.push(job.contact_email);
            if (job.contact_phone) haystacks.push(job.contact_phone);
            if (job.source_url) haystacks.push(job.source_url);
            if (generation?.role_folder) haystacks.push(generation.role_folder);
            if (generation?.company_folder) haystacks.push(generation.company_folder);
            if (generation?.profile_folder) haystacks.push(generation.profile_folder);
            if (generation?.notes) haystacks.push(generation.notes);
            if (profileName) haystacks.push(profileName);
            if (promptName) haystacks.push(promptName);
            return haystacks.some((text) => text.toLowerCase().includes(trimmed));
          });
        }

        setResults(nextResults);
        setHasMore(Boolean(response.hasMore));
        setNextOffset(PAGE_SIZE);
      } else {
        setError(response.error || 'Failed to load history');
        setResults([]);
        setHasMore(false);
        setNextOffset(0);
      }
    } catch (err) {
      setError('Failed to load history');
      setResults([]);
      setHasMore(false);
      setNextOffset(0);
      console.error(err);
    } finally {
      setLoading(false);
    }
    loadCounts();
  };

  const loadMoreHistory = async () => {
    if (!hasMore || isLoadingMore) return;
    setIsLoadingMore(true);
    setError(null);
    try {
      const response = await window.electronAPI.historyList({
        ...(currentQuery ?? {}),
        limit: PAGE_SIZE,
        offset: nextOffset,
      });
      if (response.success && response.results) {
        const appended = [...results, ...response.results];

        const trimmed = searchQuery.trim().toLowerCase();
        const filtered = trimmed
          ? appended.filter(({ job, generation, profileName, promptName }) => {
              const haystacks: string[] = [];
              if (job.company_name) haystacks.push(job.company_name);
              if (job.job_title) haystacks.push(job.job_title);
              if (job.jd_text) haystacks.push(job.jd_text);
              if (job.job_description_clean) haystacks.push(job.job_description_clean);
              if (job.contact_email) haystacks.push(job.contact_email);
              if (job.contact_phone) haystacks.push(job.contact_phone);
              if (job.source_url) haystacks.push(job.source_url);
              if (generation?.role_folder) haystacks.push(generation.role_folder);
              if (generation?.company_folder) haystacks.push(generation.company_folder);
              if (generation?.profile_folder) haystacks.push(generation.profile_folder);
              if (generation?.notes) haystacks.push(generation.notes);
              if (profileName) haystacks.push(profileName);
              if (promptName) haystacks.push(promptName);
              return haystacks.some((text) => text.toLowerCase().includes(trimmed));
            })
          : appended;

        setResults(filtered);
        setHasMore(Boolean(response.hasMore));
        setNextOffset(nextOffset + PAGE_SIZE);
      } else if (response.error) {
        setError(response.error);
        setHasMore(false);
      } else {
        setHasMore(false);
      }
    } catch (err) {
      console.error(err);
      setError('Failed to load history');
      setHasMore(false);
    } finally {
      setIsLoadingMore(false);
    }
  };

  const buildSearchQuery = (
    keywordValue: string,
    profileIdValue: string,
    dateRangeValue: 'all' | 'today' | '7d' | '30d' | 'custom',
    customFromValue: string,
    customToValue: string
  ):
    | {
        keyword?: string;
        profile_id?: string;
        fromDate?: string;
        toDate?: string;
      }
    | undefined => {
    const query: {
      keyword?: string;
      profile_id?: string;
      fromDate?: string;
      toDate?: string;
    } = keywordValue.trim()
      ? { keyword: keywordValue.trim() }
      : {};
    if (profileIdValue) query.profile_id = profileIdValue;

    if (dateRangeValue === 'today' || dateRangeValue === '7d' || dateRangeValue === '30d') {
      const now = new Date();
      let from: Date | null = null;
      if (dateRangeValue === 'today') {
        from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      } else if (dateRangeValue === '7d') {
        from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      } else if (dateRangeValue === '30d') {
        from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      }
      if (from) {
        query.fromDate = from.toISOString();
      }
    } else if (dateRangeValue === 'custom') {
      if (customFromValue) {
        const from = new Date(`${customFromValue}T00:00:00`);
        query.fromDate = from.toISOString();
      }
      if (customToValue) {
        const to = new Date(`${customToValue}T23:59:59.999`);
        query.toDate = to.toISOString();
      }
    }

    return Object.keys(query).length ? query : undefined;
  };

  const handleSearch = () => {
    const query = buildSearchQuery(searchQuery, profileFilterId, dateRange, customFrom, customTo);
    // When no filters are active (e.g. "All time" with empty search/profile),
    // explicitly pass an empty query object so we clear any stale filters
    // instead of reusing the last query.
    loadHistory(query ?? {}, searchQuery);
  };

  const handleClear = () => {
    setSearchQuery('');
    setProfileFilterId('');
    setDateRange('all');
    setCustomFrom('');
    setCustomTo('');
    // Force a fully unfiltered reload rather than reusing the previous query.
    loadHistory({}, '');
  };

  const startEditingNotes = (generationId: string, currentNotes: string | null) => {
    setEditingNotesId(generationId);
    setNotesDraft(currentNotes ?? '');
  };

  const cancelEditingNotes = () => {
    setEditingNotesId(null);
    setNotesDraft('');
  };

  const saveNotes = async (generationId: string) => {
    try {
      const res = await window.electronAPI.generationUpdateNotes(generationId, notesDraft.trim() || null);
      if (res.success && res.generation != null) {
        setResults((prev) =>
          prev.map((r) =>
            r.generation?.generation_id === generationId
              ? { ...r, generation: res.generation ?? r.generation }
              : r
          )
        );
        setEditingNotesId(null);
        setNotesDraft('');
      } else {
        await modal.alert(res.error || 'Failed to save notes');
      }
    } catch (err) {
      console.error('Failed to save notes:', err);
      await modal.alert('Failed to save notes');
    }
  };

  const startEditingJob = (job: Job) => {
    setEditingJobId(job.job_id);
    setJobDraftCompany(job.company_name ?? '');
    setJobDraftTitle(job.job_title ?? '');
  };

  const cancelEditingJob = () => {
    setEditingJobId(null);
    setJobDraftCompany('');
    setJobDraftTitle('');
  };

  const saveJobEdits = async (jobId: string) => {
    try {
      const payload = {
        company_name: jobDraftCompany.trim() || null,
        job_title: jobDraftTitle.trim() || null,
      };
      const res = await window.electronAPI.jobsUpdate(jobId, payload);
      if (res.success && res.job) {
        setResults((prev) =>
          prev.map((r) =>
            r.job.job_id === jobId
              ? { ...r, job: res.job! }
              : r
          )
        );
        setEditingJobId(null);
      } else {
        await modal.alert(res.error || 'Failed to save changes');
      }
    } catch (err) {
      console.error('Failed to save job edits:', err);
      await modal.alert('Failed to save changes');
    }
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

  const handleRetry = async (job: Job, generation: Generation) => {
    if (!job.source_url || !job.source_url.trim()) {
      await modal.alert('Cannot retry: job posting URL is missing for this history item.');
      return;
    }

    setRetryingGenerationId(generation.generation_id);
    setRetryProgress({ step: 'saving_job', message: 'Starting retry…', percent: 0 });
    setRetryError(null);

    try {
      const res = await window.electronAPI.generationRunFull({
        jdText: job.jd_text,
        sourceUrl: job.source_url || undefined,
        profileId: generation.profile_id,
        promptId: generation.prompt_id || undefined,
        taskId: HISTORY_RETRY_TASK_ID,
      });

      setRetryProgress(null);

      if (!res.success || !res.generationId) {
        setRetryError(res.error || 'Retry failed');
        return;
      }

      const genRes = await window.electronAPI.generationGet(res.generationId);
      if (!genRes.success || !genRes.generation) {
        setRetryError(genRes.error || 'Retry succeeded but failed to load updated result');
        return;
      }

      const updatedGeneration = genRes.generation;
      setResults((prev) =>
        prev.map((r) =>
          r.generation && r.generation.generation_id === generation.generation_id
            ? { ...r, generation: updatedGeneration }
            : r
        )
      );
      setRetryingGenerationId(null);
      setRetryError(null);
    } catch (err) {
      console.error('Retry from history failed:', err);
      setRetryProgress(null);
      setRetryError('Retry failed');
    }
  };

  const handleGenerateAnswers = async (generation: Generation) => {
    const questions = parseQuestions(qaQuestionsDraft);
    if (questions.length === 0) {
      setQaError('Please enter at least one question.');
      return;
    }

    setQaLoadingGenerationId(generation.generation_id);
    setQaProgress({ step: 'generating_payload', message: 'Generating answers…', percent: 0 });
    setQaError(null);

    try {
      const res = await window.electronAPI.generationRunQa({
        generationId: generation.generation_id,
        questions,
        taskId: HISTORY_QA_TASK_ID,
      });

      setQaProgress(null);

      if (!res.success || !res.generationId) {
        setQaError(res.error || 'Failed to generate answers');
        return;
      }

      const genRes = await window.electronAPI.generationGet(res.generationId);
      if (!genRes.success || !genRes.generation) {
        setQaError(genRes.error || 'Answers generated but failed to load updated result');
        return;
      }

      const updatedGeneration = genRes.generation;
      setResults((prev) =>
        prev.map((r) =>
          r.generation && r.generation.generation_id === generation.generation_id
            ? { ...r, generation: updatedGeneration }
            : r
        )
      );

      setQaEditingGenerationId(null);
      setQaQuestionsDraft('');
      setQaLoadingGenerationId(null);
      setQaError(null);
    } catch (err) {
      console.error('Generate answers from history failed:', err);
      setQaProgress(null);
      setQaError('Failed to generate answers');
    }
  };
  return (
    <div className="history-screen">
      <h1>History</h1>

      <HistorySearchBar
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        profileFilterId={profileFilterId}
        onProfileFilterChange={setProfileFilterId}
        profiles={profiles}
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        customFrom={customFrom}
        onCustomFromChange={setCustomFrom}
        customTo={customTo}
        onCustomToChange={setCustomTo}
        onSearch={handleSearch}
        onClear={handleClear}
      />

      <HistoryResults
        results={results}
        loading={loading}
        error={error}
        counts={counts}
        hasMore={hasMore}
        isLoadingMore={isLoadingMore}
        onLoadMore={loadMoreHistory}
        editingNotesId={editingNotesId}
        notesDraft={notesDraft}
        onStartEditingNotes={startEditingNotes}
        onCancelEditingNotes={cancelEditingNotes}
        onSaveNotes={saveNotes}
        editingJobId={editingJobId}
        jobDraftCompany={jobDraftCompany}
        jobDraftTitle={jobDraftTitle}
        onStartEditingJob={startEditingJob}
        onCancelEditingJob={cancelEditingJob}
        onSaveJobEdits={saveJobEdits}
        retryingGenerationId={retryingGenerationId}
        retryProgress={retryProgress}
        retryError={retryError}
        onRetry={handleRetry}
        qaEditingGenerationId={qaEditingGenerationId}
        qaQuestionsDraft={qaQuestionsDraft}
        qaLoadingGenerationId={qaLoadingGenerationId}
        qaProgress={qaProgress}
        qaError={qaError}
        onQaQuestionsDraftChange={setQaQuestionsDraft}
        onStartQaEditing={(generationId) => {
          setQaEditingGenerationId(generationId);
          setQaQuestionsDraft('');
          setQaError(null);
        }}
        onCancelQaEditing={() => {
          setQaEditingGenerationId(null);
          setQaQuestionsDraft('');
          setQaError(null);
        }}
        onGenerateAnswers={handleGenerateAnswers}
        parseQuestions={parseQuestions}
      />
    </div>
  );
}

export default HistoryScreen;
