import type { Job, Generation } from '@shared/types';
import { useModal } from '../context/ModalContext';

type HistoryResult = {
  job: Job;
  generation: Generation | null;
  profileName: string | null;
  promptName: string | null;
};

type Progress = {
  step: string;
  message: string;
  percent: number;
};

type Counts = { total: number; today: number } | null;

type Props = {
  results: HistoryResult[];
  loading: boolean;
  error: string | null;
  counts: Counts;
  hasMore: boolean;
  isLoadingMore: boolean;
  onLoadMore: () => void;

  editingNotesId: string | null;
  notesDraft: string;
  onStartEditingNotes: (generationId: string, currentNotes: string | null) => void;
  onCancelEditingNotes: () => void;
  onSaveNotes: (generationId: string) => void;

  editingJobId: string | null;
  jobDraftCompany: string;
  jobDraftTitle: string;
  onStartEditingJob: (job: Job) => void;
  onCancelEditingJob: () => void;
  onSaveJobEdits: (jobId: string) => void;

  retryingGenerationId: string | null;
  retryProgress: Progress | null;
  retryError: string | null;
  onRetry: (job: Job, generation: Generation) => void;

  qaEditingGenerationId: string | null;
  qaQuestionsDraft: string;
  qaLoadingGenerationId: string | null;
  qaProgress: Progress | null;
  qaError: string | null;
  onQaQuestionsDraftChange: (value: string) => void;
  onStartQaEditing: (generationId: string) => void;
  onCancelQaEditing: () => void;
  onGenerateAnswers: (generation: Generation) => void;
  parseQuestions: (text: string) => string[];
};

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return (
    date.toLocaleDateString() +
    ' ' +
    date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  );
};

export function HistoryResults({
  results,
  loading,
  error,
  counts,
  hasMore,
  isLoadingMore,
  onLoadMore,
  editingNotesId,
  notesDraft,
  onStartEditingNotes,
  onCancelEditingNotes,
  onSaveNotes,
  editingJobId,
  jobDraftCompany,
  jobDraftTitle,
  onStartEditingJob,
  onCancelEditingJob,
  onSaveJobEdits,
  retryingGenerationId,
  retryProgress,
  retryError,
  onRetry,
  qaEditingGenerationId,
  qaQuestionsDraft,
  qaLoadingGenerationId,
  qaProgress,
  qaError,
  onQaQuestionsDraftChange,
  onStartQaEditing,
  onCancelQaEditing,
  onGenerateAnswers,
  parseQuestions,
}: Props) {
  const modal = useModal();

  return (
    <>
      {counts !== null && (
        <p className="history-stats">
          <span className="history-stat-total">
            {counts.total} resume{counts.total !== 1 ? 's' : ''} generated in total
          </span>
          <span className="history-stat-sep"> · </span>
          <span className="history-stat-today">{counts.today} today</span>
        </p>
      )}

      {error && <div className="message message-error">{error}</div>}

      {!loading && results.length > 0 && (
        <div className="history-result-count">
          Showing {results.length} result{results.length !== 1 ? 's' : ''} for current filters
        </div>
      )}

      {loading && (
        <div className="screen-placeholder">
          <p>Loading history...</p>
        </div>
      )}

      {!loading && results.length === 0 && (
        <div className="screen-placeholder">
          <h2>No applications found</h2>
          <p>Your application history will appear here after generating resumes.</p>
        </div>
      )}

      {!loading && results.length > 0 && (
        <div className="history-results">
          <div className="history-grid">
            {results.map(({ job, generation, profileName, promptName }) => (
              <div
                key={generation?.generation_id ?? job.job_id}
                className="history-item"
              >
                <div className="history-item-header">
                  <div className="history-item-title">
                    {editingJobId === job.job_id ? (
                      <>
                        <input
                          type="text"
                          className="history-item-company-input"
                          value={jobDraftCompany}
                          onChange={(e) => onStartEditingJob({ ...job, company_name: e.target.value })}
                          placeholder="Company name"
                        />
                        <input
                          type="text"
                          className="history-item-role-input"
                          value={jobDraftTitle}
                          onChange={(e) =>
                            onStartEditingJob({ ...job, job_title: e.target.value })
                          }
                          placeholder="Role title"
                        />
                        <div className="history-item-edit-header-actions">
                          <button
                            type="button"
                            onClick={() => onSaveJobEdits(job.job_id)}
                            className="button-icon button-icon-save"
                            aria-label="Save header changes"
                          >
                            ✓
                          </button>
                          <button
                            type="button"
                            onClick={onCancelEditingJob}
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
                        <span className="history-item-role">
                          {job.job_title || 'Unknown Role'}
                        </span>
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
                        onClick={() => onStartEditingJob(job)}
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
                          onChange={(e) =>
                            onStartEditingNotes(generation.generation_id, e.target.value)
                          }
                          placeholder="Add notes about this application..."
                          rows={3}
                          autoFocus
                        />
                        <div className="history-item-notes-actions">
                          <button
                            type="button"
                            onClick={() => onSaveNotes(generation.generation_id)}
                            className="button-primary"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={onCancelEditingNotes}
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
                          onClick={() =>
                            onStartEditingNotes(generation.generation_id, generation.notes)
                          }
                          className="button-link history-item-notes-toggle"
                        >
                          {(generation.notes ?? '').trim() ? 'Edit' : 'Other Info'}
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
                            if (!res.success) {
                              await modal.alert(res.error || 'Failed to open link');
                            }
                          } catch (err) {
                            // eslint-disable-next-line no-console
                            console.error('Failed to open URL:', err);
                            await modal.alert('Failed to open link');
                          }
                        }}
                        className="button-link"
                        aria-label="Open job posting"
                      >
                        🔗
                      </button>
                    )}
                    <button
                      onClick={async () => {
                        try {
                          await window.electronAPI.filesOpenFolder(generation.output_dir!);
                        } catch (err) {
                          // eslint-disable-next-line no-console
                          console.error('Failed to open folder:', err);
                          await modal.alert('Failed to open folder');
                        }
                      }}
                      className="button-link"
                      style={job.source_url ? { marginLeft: '12px' } : undefined}
                    >
                      📁
                    </button>
                    {generation.resume_pdf_path && (
                      <button
                        onClick={async () => {
                          try {
                            await window.electronAPI.filesOpenFile(generation.resume_pdf_path!);
                          } catch (err) {
                            // eslint-disable-next-line no-console
                            console.error('Failed to open file:', err);
                            await modal.alert('Failed to open file');
                          }
                        }}
                        className="button-link"
                        style={{ marginLeft: '12px' }}
                      >
                        📄
                      </button>
                    )}
                    {generation.cover_pdf_path && (
                      <button
                        onClick={async () => {
                          try {
                            await window.electronAPI.filesOpenFile(generation.cover_pdf_path!);
                          } catch (err) {
                            // eslint-disable-next-line no-console
                            console.error('Failed to open file:', err);
                            await modal.alert('Failed to open file');
                          }
                        }}
                        className="button-link"
                        style={{ marginLeft: '12px' }}
                      >
                        ✉
                      </button>
                    )}
                    {generation.qa_pdf_path && (
                      <button
                        onClick={async () => {
                          try {
                            await window.electronAPI.filesOpenFile(generation.qa_pdf_path!);
                          } catch (err) {
                            // eslint-disable-next-line no-console
                            console.error('Failed to open file:', err);
                            await modal.alert('Failed to open file');
                          }
                        }}
                        className="button-link"
                        style={{ marginLeft: '12px' }}
                        aria-label="Open answers PDF"
                      >
                        💡
                      </button>
                    )}
                    {generation && (
                      <button
                        onClick={() => onRetry(job, generation)}
                        className="button-link"
                        style={{ marginLeft: '12px' }}
                        disabled={retryingGenerationId === generation.generation_id}
                        aria-label="Retry generation"
                      >
                        ⟳
                      </button>
                    )}
                    {generation && generation.status === 'success' && (
                      <button
                        type="button"
                        onClick={() => onStartQaEditing(generation.generation_id)}
                        className="button-link history-item-qa-toggle"
                        style={{ marginLeft: '12px' }}
                        aria-label="Answer the questions"
                      >
                        ❓
                      </button>
                    )}
                  </div>
                )}
                {generation && generation.status === 'success' && (
                  <div className="history-item-qa">
                    {qaEditingGenerationId === generation.generation_id && (
                      <>
                        <label className="history-item-qa-label">
                          Questions for this job
                        </label>
                        <textarea
                          className="history-item-qa-input"
                          value={qaQuestionsDraft}
                          onChange={(e) => onQaQuestionsDraftChange(e.target.value)}
                          placeholder="Enter questions (one per line or as a numbered/bulleted list)..."
                          rows={8}
                        />
                        {qaQuestionsDraft.trim() && (
                          <div className="history-item-qa-count">
                            {parseQuestions(qaQuestionsDraft).length} question
                            {parseQuestions(qaQuestionsDraft).length !== 1 ? 's' : ''} entered
                          </div>
                        )}
                        {qaError && (
                          <div
                            className="message message-error"
                            style={{ marginTop: '8px' }}
                          >
                            {qaError}
                          </div>
                        )}
                        <div className="history-item-qa-actions">
                          <button
                            type="button"
                            onClick={() => generation && onGenerateAnswers(generation)}
                            className="button-primary"
                            disabled={qaLoadingGenerationId === generation.generation_id}
                          >
                            {qaLoadingGenerationId === generation.generation_id
                              ? 'Generating…'
                              : 'Generate'}
                          </button>
                          <button
                            type="button"
                            onClick={onCancelQaEditing}
                            className="button-secondary"
                          >
                            Cancel
                          </button>
                        </div>
                      </>
                    )}
                    {qaLoadingGenerationId === generation.generation_id &&
                      qaProgress && (
                        <div className="history-item-qa-progress">
                          <div className="progress-bar">
                            <div
                              className="progress-fill"
                              style={{ width: `${qaProgress.percent}%` }}
                            />
                          </div>
                          <p className="progress-message">{qaProgress.message}</p>
                        </div>
                      )}
                  </div>
                )}
                {retryingGenerationId === generation?.generation_id && retryProgress && (
                  <div className="history-item-retry-progress">
                    <div className="progress-bar">
                      <div
                        className="progress-fill"
                        style={{ width: `${retryProgress.percent}%` }}
                      />
                    </div>
                    <p className="progress-message">{retryProgress.message}</p>
                    {retryError && (
                      <div
                        className="message message-error"
                        style={{ marginTop: '8px' }}
                      >
                        {retryError}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
          {hasMore && (
            <div className="history-load-more">
              <button
                type="button"
                onClick={onLoadMore}
                className="button-secondary"
                disabled={isLoadingMore}
              >
                {isLoadingMore ? 'Loading more…' : 'Load more'}
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}

