type TaskBadgeStatus = 'idle' | 'loading' | 'success' | 'error';

type Props = {
  activeTaskIndex: number;
  maxTasks: number;
  getBadgeStatus: (taskIndex: number) => TaskBadgeStatus;
  onSelectTask: (taskIndex: number) => void;
};

export function GenerateTaskTabs({
  activeTaskIndex,
  maxTasks,
  getBadgeStatus,
  onSelectTask,
}: Props) {
  return (
    <div className="generate-task-tabs" role="tablist" aria-label="Tasks">
      {Array.from({ length: maxTasks }, (_, i) => i + 1).map((n) => {
        const badge = getBadgeStatus(n);
        return (
          <button
            key={n}
            type="button"
            role="tab"
            aria-selected={activeTaskIndex === n}
            aria-controls="generate-task-panel"
            id={`generate-task-tab-${n}`}
            className={`generate-task-tab ${activeTaskIndex === n ? 'active' : ''}`}
            onClick={() => onSelectTask(n)}
            title={n === 10 ? 'Task 10 (Ctrl+0)' : `Task ${n} (Ctrl+${n})`}
          >
            <span className="generate-task-tab-label">Task {n}</span>
            {badge === 'loading' && (
              <span
                className="generate-task-badge generate-task-badge-loading"
                aria-hidden
              >
                ...
              </span>
            )}
            {badge === 'success' && (
              <span
                className="generate-task-badge generate-task-badge-success"
                aria-hidden
              >
                ✓
              </span>
            )}
            {badge === 'error' && (
              <span
                className="generate-task-badge generate-task-badge-error"
                aria-hidden
              >
                !
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

