import { useState, useEffect } from 'react';
import type { Job, Generation, Profile } from '@shared/types';
import { useModal } from '../context/ModalContext';

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
        loadHistory(initialQuery);
      } else {
        loadHistory();
      }
    } catch {
      loadHistory();
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
        }
      } catch {
        setProfiles([]);
      }
    })();
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

  const loadHistory = async (query?: {
    keyword?: string;
    company_name?: string;
    job_title?: string;
    profile_id?: string;
    fromDate?: string;
    toDate?: string;
  }) => {
    setLoading(true);
    setError(null);
    try {
      const response = await window.electronAPI.historyList(query);
      if (response.success && response.results) {
        setResults(response.results);
      } else {
        setError(response.error || 'Failed to load history');
      }
    } catch (err) {
      setError('Failed to load history');
      console.error(err);
    } finally {
      setLoading(false);
    }
    loadCounts();
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
    loadHistory(query);
  };

  const handleClear = () => {
    setSearchQuery('');
    setProfileFilterId('');
    setDateRange('all');
    setCustomFrom('');
    setCustomTo('');
    loadHistory();
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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

  return (
    <div className="history-screen">
      <h1>History</h1>
      {counts !== null && (
        <p className="history-stats">
          <span className="history-stat-total">{counts.total} resume{counts.total !== 1 ? 's' : ''} generated in total</span>
          <span className="history-stat-sep"> · </span>
          <span className="history-stat-today">{counts.today} today</span>
        </p>
      )}

      <div className="history-search">
        <input
          type="text"
          placeholder="Search by company, role, or keywords..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
          className="search-input"
        />
        <select
          className="history-profile-filter"
          value={profileFilterId}
          onChange={(e) => { setProfileFilterId(e.target.value); }}
          title="Filter by profile"
        >
          <option value="">All profiles</option>
          {profiles.map((p) => (
            <option key={p.profile_id} value={p.profile_id}>{p.name}</option>
          ))}
        </select>
        <select
          className="history-date-filter"
          value={dateRange}
          onChange={(e) =>
            setDateRange(e.target.value as 'all' | 'today' | '7d' | '30d' | 'custom')
          }
          title="Filter by date"
        >
          <option value="all">All time</option>
          <option value="today">Today</option>
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="custom">Custom range</option>
        </select>
        {dateRange === 'custom' && (
          <div className="history-date-custom-group">
            <input
              type="date"
              className="history-date-custom"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              title="From date"
            />
            <input
              type="date"
              className="history-date-custom"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              title="To date"
            />
          </div>
        )}
        <button onClick={handleSearch} className="button-primary">
          Search
        </button>
        <button onClick={handleClear} className="button-secondary">
          Clear
        </button>
      </div>

      {error && <div className="message message-error">{error}</div>}

      {!loading && results.length > 0 && (
        <div className="history-result-count">
          Showing {results.length} result{results.length !== 1 ? 's' : ''} for current filters
        </div>
      )}

      {loading ? (
        <div className="screen-placeholder">
          <p>Loading history...</p>
        </div>
      ) : results.length === 0 ? (
        <div className="screen-placeholder">
          <h2>No applications found</h2>
          <p>Your application history will appear here after generating resumes.</p>
        </div>
      ) : (
        <div className="history-grid">
          {results.map(({ job, generation, profileName, promptName }) => (
            <div key={generation?.generation_id ?? job.job_id} className="history-item">
              <div className="history-item-header">
                <div className="history-item-title">
                  {editingJobId === job.job_id ? (
                    <>
                      <input
                        type="text"
                        className="history-item-company-input"
                        value={jobDraftCompany}
                        onChange={(e) => setJobDraftCompany(e.target.value)}
                        placeholder="Company name"
                      />
                      <input
                        type="text"
                        className="history-item-role-input"
                        value={jobDraftTitle}
                        onChange={(e) => setJobDraftTitle(e.target.value)}
                        placeholder="Role title"
                      />
                      <div
                        className="history-item-edit-header-actions"
                      >
                        <button
                          type="button"
                          onClick={() => saveJobEdits(job.job_id)}
                          className="button-icon button-icon-save"
                          aria-label="Save header changes"
                        >
                          ✓
                        </button>
                        <button
                          type="button"
                          onClick={cancelEditingJob}
                          className="button-icon button-icon-cancel"
                          aria-label="Cancel header edit"
                        >
                          ✕
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <h3>{job.company_name || 'Unknown Company'}</h3>
                      <span className="history-item-role">{job.job_title || 'Unknown Role'}</span>
                    </>
                  )}
                  {profileName && (
                    <span className="history-item-profile">Profile: {profileName}</span>
                  )}
                  {promptName && (
                    <span className="history-item-prompt">Prompt: {promptName}</span>
                  )}
                </div>
                <div className="history-item-meta">
                  <span className="history-item-date">{formatDate(job.created_at)}</span>
                  {editingJobId !== job.job_id && (
                    <button
                      type="button"
                      onClick={() => startEditingJob(job)}
                      className="button-link history-item-edit-header"
                      aria-label="Edit header"
                    >
                      ✎
                    </button>
                  )}
                  {generation && (
                    <span className={`status-badge status-${generation.status}`}>
                      {generation.status}
                    </span>
                  )}
                </div>
              </div>
              {job.contact_email && (
                <div className="history-item-contact">
                  <strong>Contact:</strong> {job.contact_email}
                  {job.contact_phone && ` | ${job.contact_phone}`}
                </div>
              )}
              {generation && (
                <div className="history-item-notes">
                  {editingNotesId === generation.generation_id ? (
                    <>
                      <label className="history-item-notes-label">Other Info</label>
                      <textarea
                        className="history-item-notes-input"
                        value={notesDraft}
                        onChange={(e) => setNotesDraft(e.target.value)}
                        placeholder="Add notes about this application..."
                        rows={3}
                        autoFocus
                      />
                      <div className="history-item-notes-actions">
                        <button
                          type="button"
                          onClick={() => saveNotes(generation.generation_id)}
                          className="button-primary"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={cancelEditingNotes}
                          className="button-secondary"
                        >
                          Cancel
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      {(generation.notes ?? '').trim() ? (
                        <div className="history-item-notes-text">
                          <span className="history-item-notes-label">Other Info:</span>{' '}
                          {generation.notes}
                        </div>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => startEditingNotes(generation.generation_id, generation.notes)}
                        className="button-link history-item-notes-toggle"
                      >
                        {(generation.notes ?? '').trim() ? 'Edit' : 'Add other info'}
                      </button>
                    </>
                  )}
                </div>
              )}
              {generation && generation.output_dir && (
                <div className="history-item-actions">
                  {job.source_url && (
                    <button
                      onClick={async () => {
                        try {
                          const res = await window.electronAPI.filesOpenUrl(job.source_url!);
                          if (!res.success) await modal.alert(res.error || 'Failed to open link');
                        } catch (err) {
                          console.error('Failed to open URL:', err);
                          await modal.alert('Failed to open link');
                        }
                      }}
                      className="button-link"
                    >
                      Job posting
                    </button>
                  )}
                  <button
                    onClick={async () => {
                      try {
                        await window.electronAPI.filesOpenFolder(generation!.output_dir!);
                      } catch (err) {
                        console.error('Failed to open folder:', err);
                        await modal.alert('Failed to open folder');
                      }
                    }}
                    className="button-link"
                    style={job.source_url ? { marginLeft: '12px' } : undefined}
                  >
                    Folder
                  </button>
                  {generation.resume_pdf_path && (
                    <button
                      onClick={async () => {
                        try {
                          await window.electronAPI.filesOpenFile(generation!.resume_pdf_path!);
                        } catch (err) {
                          console.error('Failed to open file:', err);
                          await modal.alert('Failed to open file');
                        }
                      }}
                      className="button-link"
                      style={{ marginLeft: '12px' }}
                    >
                      Resume PDF
                    </button>
                  )}
                  {generation.cover_pdf_path && (
                    <button
                      onClick={async () => {
                        try {
                          await window.electronAPI.filesOpenFile(generation!.cover_pdf_path!);
                        } catch (err) {
                          console.error('Failed to open file:', err);
                          await modal.alert('Failed to open file');
                        }
                      }}
                      className="button-link"
                      style={{ marginLeft: '12px' }}
                    >
                      Cover PDF
                    </button>
                  )}
                  {generation.qa_pdf_path && (
                    <button
                      onClick={async () => {
                        try {
                          await window.electronAPI.filesOpenFile(generation!.qa_pdf_path!);
                        } catch (err) {
                          console.error('Failed to open file:', err);
                          await modal.alert('Failed to open file');
                        }
                      }}
                      className="button-link"
                      style={{ marginLeft: '12px' }}
                    >
                      QA PDF
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default HistoryScreen;
