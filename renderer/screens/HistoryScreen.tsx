import { useState, useEffect } from 'react';
import type { Job, Generation, Profile } from '@shared/types';
import { useModal } from '../context/ModalContext';

type HistoryResult = {
  job: Job;
  generation: Generation | null;
  profileName: string | null;
};

function HistoryScreen() {
  const modal = useModal();
  const [results, setResults] = useState<HistoryResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [profileFilterId, setProfileFilterId] = useState<string>('');
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [dateRange, setDateRange] = useState<'all' | 'today' | '7d' | '30d'>('all');
  const [error, setError] = useState<string | null>(null);
  const [counts, setCounts] = useState<{ total: number; today: number } | null>(null);

  useEffect(() => {
    loadHistory();
    loadCounts();
  }, []);

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

  const handleSearch = () => {
    const query: {
      keyword?: string;
      profile_id?: string;
      fromDate?: string;
      toDate?: string;
    } = searchQuery.trim()
      ? { keyword: searchQuery.trim() }
      : {};
    if (profileFilterId) query.profile_id = profileFilterId;

    if (dateRange !== 'all') {
      const now = new Date();
      let from: Date | null = null;
      if (dateRange === 'today') {
        from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      } else if (dateRange === '7d') {
        from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      } else if (dateRange === '30d') {
        from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      }
      if (from) {
        query.fromDate = from.toISOString();
      }
    }

    loadHistory(Object.keys(query).length ? query : undefined);
  };

  const handleClear = () => {
    setSearchQuery('');
    setProfileFilterId('');
    setDateRange('all');
    loadHistory();
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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
          onChange={(e) => setDateRange(e.target.value as 'all' | 'today' | '7d' | '30d')}
          title="Filter by date"
        >
          <option value="all">All time</option>
          <option value="today">Today</option>
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
        </select>
        <button onClick={handleSearch} className="button-primary">
          Search
        </button>
        <button onClick={handleClear} className="button-secondary">
          Clear
        </button>
      </div>

      {error && <div className="message message-error">{error}</div>}

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
          {results.map(({ job, generation, profileName }) => (
            <div key={generation?.generation_id ?? job.job_id} className="history-item">
              <div className="history-item-header">
                <div className="history-item-title">
                  <h3>{job.company_name || 'Unknown Company'}</h3>
                  <span className="history-item-role">{job.job_title || 'Unknown Role'}</span>
                  {profileName && (
                    <span className="history-item-profile">Profile: {profileName}</span>
                  )}
                </div>
                <div className="history-item-meta">
                  <span className="history-item-date">{formatDate(job.created_at)}</span>
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
