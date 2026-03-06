import { useEffect, useMemo, useState } from 'react';
import type { DailyGenerationCountByProfile } from '../../main/db/generationsDao';
import type { Profile } from '@shared/types';

type RangeKey = '7d' | '30d' | '90d' | 'all';

type Summary = {
  today: number;
  last7Days: number;
  last30Days: number;
  allTime: number;
};

const PROFILE_COLORS = [
  '#5c9ead',
  '#326789',
  '#e65c4f',
  '#f2a74b',
  '#8fbc8f',
  '#b8860b',
  '#9370db',
  '#708090',
];

function formatDateLocal(dateString: string) {
  const d = new Date(dateString + 'T00:00:00');
  return d.toLocaleDateString();
}

function AnalyticsScreen() {
  const [range, setRange] = useState<RangeKey>('30d');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [data, setData] = useState<DailyGenerationCountByProfile[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [segmentTooltip, setSegmentTooltip] = useState<{ text: string; x: number; y: number } | null>(null);

  const hasData = data.length > 0;

  const profileNameMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of profiles) {
      m.set(p.profile_id, p.name);
    }
    return m;
  }, [profiles]);

  const legendOrder = useMemo(() => {
    const ids = new Set<string>();
    for (const day of data) {
      for (const seg of day.byProfile) {
        ids.add(seg.profile_id);
      }
    }
    for (const p of profiles) {
      ids.add(p.profile_id);
    }
    return Array.from(ids).sort((a, b) => {
      const na = profileNameMap.get(a) ?? 'Unknown profile';
      const nb = profileNameMap.get(b) ?? 'Unknown profile';
      return na.localeCompare(nb);
    });
  }, [data, profiles, profileNameMap]);

  const profileColorMap = useMemo(() => {
    const m = new Map<string, string>();
    legendOrder.forEach((id, i) => {
      m.set(id, PROFILE_COLORS[i % PROFILE_COLORS.length]);
    });
    return m;
  }, [legendOrder]);

  const filledData = useMemo<DailyGenerationCountByProfile[]>(() => {
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

    const byDate = new Map(data.map((d) => [d.date, d]));
    const result: DailyGenerationCountByProfile[] = [];

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const key = d.toISOString().slice(0, 10);
      const day = byDate.get(key);
      result.push(
        day ?? { date: key, total: 0, byProfile: [] }
      );
    }

    return result;
  }, [hasData, data]);

  const maxCount = useMemo(
    () => (filledData.length > 0 ? Math.max(...filledData.map((d) => d.total)) : 0),
    [filledData]
  );

  const getProfileCount = (day: DailyGenerationCountByProfile, profileId: string) => {
    const seg = day.byProfile.find((s) => s.profile_id === profileId);
    return seg?.count ?? 0;
  };

  const handleLoad = async (nextRange: RangeKey) => {
    setRange(nextRange);
    setLoading(true);
    setError(null);
    try {
      const [res, listRes] = await Promise.all([
        window.electronAPI.analyticsGetDailyCounts({ range: nextRange }),
        window.electronAPI.profilesList(),
      ]);
      if (!res.success) {
        setError(res.error || 'Failed to load analytics');
        setSummary(null);
        setData([]);
        return;
      }
      setSummary(
        res.summary ?? {
          today: 0,
          last7Days: 0,
          last30Days: 0,
          allTime: 0,
        }
      );
      setData(res.data ?? []);
      if (listRes.success && listRes.profiles) {
        setProfiles(listRes.profiles);
      }
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
            {legendOrder.length > 0 && (
              <div className="analytics-chart-legend">
                {legendOrder.map((profileId) => (
                  <div key={profileId} className="analytics-chart-legend-item">
                    <span
                      className="analytics-chart-legend-swatch"
                      style={{ background: profileColorMap.get(profileId) ?? '#888' }}
                    />
                    <span className="analytics-chart-legend-label">
                      {profileNameMap.get(profileId) ?? 'Unknown profile'}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {segmentTooltip && (
              <div
                className="analytics-segment-tooltip"
                style={{
                  left: segmentTooltip.x,
                  top: segmentTooltip.y,
                }}
                role="tooltip"
              >
                {segmentTooltip.text}
              </div>
            )}
            <div className="analytics-chart">
              <div className="analytics-chart-bars">
                {filledData.map((d) => {
                  const heightPercent =
                    maxCount === 0 ? 0 : (d.total / maxCount) * 100;
                  return (
                    <div key={d.date} className="analytics-chart-bar-wrapper">
                      <div
                        className="analytics-chart-bar analytics-chart-bar-stacked"
                        style={{ height: `${heightPercent}%` }}
                      >
                        <span className="analytics-chart-bar-count">{d.total}</span>
                        {legendOrder.map((profileId) => {
                          const count = getProfileCount(d, profileId);
                          const pct = d.total === 0 ? 0 : (count / d.total) * 100;
                          const name = profileNameMap.get(profileId) ?? 'Unknown profile';
                          if (pct === 0) return null;
                          const tooltipText = `${name}: ${count} resume${count === 1 ? '' : 's'}`;
                          return (
                            <div
                              key={profileId}
                              className="analytics-chart-bar-segment"
                              style={{
                                height: `${pct}%`,
                                background: profileColorMap.get(profileId) ?? '#888',
                              }}
                              title={tooltipText}
                              onMouseEnter={(e) =>
                                setSegmentTooltip({
                                  text: tooltipText,
                                  x: e.clientX,
                                  y: e.clientY,
                                })
                              }
                              onMouseMove={(e) =>
                                setSegmentTooltip((prev) =>
                                  prev ? { ...prev, x: e.clientX, y: e.clientY } : null
                                )
                              }
                              onMouseLeave={() => setSegmentTooltip(null)}
                            />
                          );
                        })}
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
                  <th>Total</th>
                  {legendOrder.map((profileId) => (
                    <th key={profileId}>
                      {profileNameMap.get(profileId) ?? 'Unknown profile'}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filledData
                  .slice()
                  .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
                  .map((row) => (
                    <tr key={row.date}>
                      <td>{formatDateLocal(row.date)}</td>
                      <td>{row.total}</td>
                      {legendOrder.map((profileId) => {
                        const count = getProfileCount(row, profileId);
                        const pct = row.total === 0 ? 0 : Math.round((count / row.total) * 100);
                        return (
                          <td key={profileId}>
                            {count === 0 ? '—' : `${count} (${pct}%)`}
                          </td>
                        );
                      })}
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
