import { useState, useEffect } from 'react';

function ChangelogScreen() {
  const [content, setContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    window.electronAPI
      .getChangelog()
      .then((res) => {
        if (cancelled) return;
        if (res.success && res.content != null) {
          setContent(res.content);
          setError(null);
        } else {
          setContent(null);
          setError(res.error ?? 'Could not load changelog.');
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setContent(null);
          setError(err instanceof Error ? err.message : 'Could not load changelog.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="changelog-screen">
      <h1>Changelog</h1>
      <p className="screen-description">Release history and notable changes.</p>
      {loading && <p className="changelog-loading">Loading…</p>}
      {error && (
        <div className="message message-error changelog-error">
          {error}
        </div>
      )}
      {!loading && !error && content != null && (
        <div className="changelog-content">
          <pre className="changelog-text">{content}</pre>
        </div>
      )}
    </div>
  );
}

export default ChangelogScreen;
