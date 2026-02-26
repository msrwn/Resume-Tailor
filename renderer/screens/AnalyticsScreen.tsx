import { useEffect, useMemo, useState } from 'react';

type RangeKey = '7d' | '30d' | '90d' | 'all';

type DailyCount = {
  date: string;
  count: number;
};

type Summary = {
  today: number;
  last7Days: number;
  last30Days: number;
  allTime: number;
};

function formatDateLocal(dateString: string) {
  const d = new Date(dateString + 'T00:00:00');
  return d.toLocaleDateString();
}

function AnalyticsScreen() {
  const [range, setRange] = useState<RangeKey>('30d');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [data, setData] = useState<DailyCount[]>([]);

  const hasData = data.length > 0;

  const filledData = useMemo<DailyCount[]>(() => {
    if (!hasData) {
      return [];
    }
    const sorted = [...data].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    const firstDateStr = sorted[0].date;
    const lastDateStr = sorted[sorted.length - 1].date;
    const [firstYear, firstMonth, firstDay] = firstDateStr.split('-').map((v) => parseInt(v, 10));
    const [lastYear, lastMonth, lastDay] = lastDateStr.split('-').map((v) => parseInt(v, 10));
    const start = new Date(firstYear, firstMonth - 1, firstDay);
    const end = new Date(lastYear, lastMonth - 1, lastDay);

    const byDate = new Map(sorted.map((d) => [d.date, d.count]));
    const result: DailyCount[] = [];

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const key = d.toISOString().slice(0, 10);
      result.push({ date: key, count: byDate.get(key) ?? 0 });
    }

    return result;
  }, [hasData, data]);

  const maxCount = useMemo(
    () => (filledData.length > 0 ? Math.max(...filledData.map((d) => d.count)) : 0),
    [filledData]
  );

  const handleLoad = async (nextRange: RangeKey) => {
    setRange(nextRange);
    setLoading(true);
    setError(null);
    try {
      const res = await window.electronAPI.analyticsGetDailyCounts({ range: nextRange });
      if (!res.success) {
        setError(res.error || 'Failed to load analytics');
        setSummary(null);
        setData([]);
        return;
      }
      setSummary(
        res.summary || {
          today: 0,
          last7Days: 0,
          last30Days: 0,
          allTime: 0,
        }
      );
      setData(res.data || []);
    } catch (err) {
      console.error('Failed to load analytics', err);
      setError('Failed to load analytics');
      setSummary(null);
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    handleLoad('30d');
  }, []);

  return (
    <div className="analytics-screen">
      <h1>Analytics</h1>
      <p className="screen-description">
        See how many resumes you&apos;ve tailored over time.
      </p>

      <div className="analytics-header">
        <div className="analytics-summary-cards">
          <div className="analytics-card">
            <div className="analytics-card-label">Today</div>
            <div className="analytics-card-value">{summary?.today ?? '—'}</div>
          </div>
          <div className="analytics-card">
            <div className="analytics-card-label">Last 7 days</div>
            <div className="analytics-card-value">{summary?.last7Days ?? '—'}</div>
          </div>
          <div className="analytics-card">
            <div className="analytics-card-label">Last 30 days</div>
            <div className="analytics-card-value">{summary?.last30Days ?? '—'}</div>
          </div>
          <div className="analytics-card">
            <div className="analytics-card-label">All time</div>
            <div className="analytics-card-value">{summary?.allTime ?? '—'}</div>
          </div>
        </div>

        <div className="analytics-range-toggle">
          <button
            type="button"
            className={range === '7d' ? 'active' : ''}
            onClick={() => handleLoad('7d')}
            disabled={loading && range === '7d'}
          >
            Last 7 days
          </button>
          <button
            type="button"
            className={range === '30d' ? 'active' : ''}
            onClick={() => handleLoad('30d')}
            disabled={loading && range === '30d'}
          >
            Last 30 days
          </button>
          <button
            type="button"
            className={range === '90d' ? 'active' : ''}
            onClick={() => handleLoad('90d')}
            disabled={loading && range === '90d'}
          >
            Last 90 days
          </button>
          <button
            type="button"
            className={range === 'all' ? 'active' : ''}
            onClick={() => handleLoad('all')}
            disabled={loading && range === 'all'}
          >
            All time
          </button>
        </div>
      </div>

      {error && <div className="message message-error">{error}</div>}

      {loading ? (
        <div className="screen-placeholder">
          <p>Loading analytics...</p>
        </div>
      ) : !hasData ? (
        <div className="screen-placeholder">
          <h2>No activity yet</h2>
          <p>Your analytics will appear here after you generate some resumes.</p>
        </div>
      ) : (
        <>
          <div className="analytics-chart-card">
            <h2>Resumes tailored per day</h2>
              <div className="analytics-chart">
                <div className="analytics-chart-bars">
                  {filledData.map((d) => {
                    const heightPercent =
                      maxCount === 0 ? 0 : (d.count / maxCount) * 100;
                    return (
                      <div key={d.date} className="analytics-chart-bar-wrapper">
                        <div
                          className="analytics-chart-bar"
                          style={{ height: `${heightPercent}%` }}
                          title={`${d.date}: ${d.count} resume${d.count === 1 ? '' : 's'}`}
                        >
                          <span className="analytics-chart-bar-count">{d.count}</span>
                        </div>
                        <div className="analytics-chart-bar-label">
                          {formatDateLocal(d.date)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
          </div>

          <div className="analytics-table-card">
            <h2>Daily breakdown</h2>
            <table className="analytics-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Resumes tailored</th>
                </tr>
              </thead>
              <tbody>
                {filledData
                  .slice()
                  .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
                  .map((row) => (
                    <tr key={row.date}>
                      <td>{formatDateLocal(row.date)}</td>
                      <td>{row.count}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

export default AnalyticsScreen;

