import { useMemo } from 'react';
import { useProjectOverview } from '../../hooks/useProjectOverview';
import { useProjectRouteSync } from '../../hooks/useProjectRouteSync';
import ProjectTabs from './ProjectTabs';

function normalizeMetricLabel(raw) {
  return String(raw || 'unknown').replace(/_/g, ' ').trim();
}

function toTitleCase(raw) {
  return normalizeMetricLabel(raw)
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function metricTone(key) {
  const normalized = normalizeMetricLabel(key).toLowerCase();
  if (normalized === 'completed') return 'tone-completed';
  if (normalized === 'todo') return 'tone-todo';
  if (normalized === 'in progress' || normalized === 'in review') return 'tone-progress';
  if (normalized === 'critical') return 'tone-critical';
  if (normalized === 'high') return 'tone-high';
  if (normalized === 'low') return 'tone-low';
  return 'tone-default';
}

function metricKindLabel(kind) {
  return kind === 'priority' ? 'Priority' : 'Status';
}

function ProjectOverviewPage() {
  const projectId = useProjectRouteSync();
  const { overview, loading, error } = useProjectOverview(projectId);

  const taskBreakdown = useMemo(
    () => {
      const raw = overview?.taskBreakdown;
      if (Array.isArray(raw)) return raw;
      const byStatus = raw?.byStatus || {};
      const byPriority = raw?.byPriority || {};
      return [
        ...Object.entries(byStatus).map(([key, count]) => ({ kind: 'status', key, count })),
        ...Object.entries(byPriority).map(([key, count]) => ({ kind: 'priority', key, count })),
      ];
    },
    [overview],
  );
  const teamWorkload = useMemo(
    () => {
      const raw = overview?.teamWorkload;
      if (Array.isArray(raw)) return raw;
      if (Array.isArray(raw?.rows)) return raw.rows;
      return [];
    },
    [overview],
  );
  const recentActivity = useMemo(
    () => overview?.recentActivity || [],
    [overview],
  );

  return (
    <main className="sv-overview-page">
      <ProjectTabs projectId={projectId} />
      <div className="sv-overview-stack">
        <section className="sv-card sv-overview-header">
          <div>
            <h1 className="sv-overview-title">Project Overview</h1>
            <p className="sv-overview-subtitle">Live snapshot of delivery health and team activity</p>
          </div>
          <p className="sv-overview-metric-count">{taskBreakdown.length} metrics</p>
        </section>

        {loading ? <p className="sv-overview-message">Loading overview...</p> : null}
        {error ? <p className="sv-overview-message is-error">{error}</p> : null}

        <section className="sv-overview-metrics">
          {taskBreakdown.map((item) => (
            <article
              key={`${item.kind || 'metric'}:${item.key || item.status || item.priority}`}
              className={`sv-card sv-overview-metric-card is-${item.kind || 'metric'} ${metricTone(item.key || item.status || item.priority)}`}
            >
              <div className="sv-overview-metric-top">
                <p className="sv-overview-metric-label">{toTitleCase(item.key || item.status || item.priority)}</p>
                <span className="sv-overview-metric-kind">{metricKindLabel(item.kind)}</span>
              </div>
              <p className="sv-overview-metric-value">{item.count || 0}</p>
            </article>
          ))}
          {!taskBreakdown.length && !loading ? <p className="sv-overview-message">No overview metrics found.</p> : null}
        </section>

        <section className="sv-overview-body-grid">
          <article className="sv-card sv-overview-panel">
            <h2 className="sv-overview-panel-title">Team Workload</h2>
            <div className="sv-overview-workload-list">
              {teamWorkload.map((member) => (
                <div key={member.userId || member.name} className="sv-overview-workload-row">
                  <div className="sv-overview-workload-meta">
                    <span className="sv-overview-workload-name">{member.name}</span>
                    <span className="sv-overview-workload-percent">{member.utilizationPercent ?? member.utilization ?? 0}%</span>
                  </div>
                  <div className="sv-overview-workload-track">
                    <div className="sv-overview-workload-fill" style={{ width: `${Math.max(0, Math.min(100, Number(member.utilizationPercent ?? member.utilization ?? 0)))}%` }} />
                  </div>
                </div>
              ))}
              {!teamWorkload.length ? <p className="sv-overview-message">No workload data.</p> : null}
            </div>
          </article>

          <article className="sv-card sv-overview-panel">
            <h2 className="sv-overview-panel-title">Recent Activity</h2>
            <div className="sv-overview-activity-list">
              {recentActivity.map((item, index) => (
                <article key={`${item._id || index}`} className="sv-overview-activity-item">
                  <p className="sv-overview-activity-text">{item.message || `${item.action || 'updated'} ${item.entity || 'project'}`}</p>
                  <div className="sv-overview-activity-meta">
                    {item.action ? <span className="sv-overview-activity-chip">{toTitleCase(item.action)}</span> : null}
                    {item.createdAt ? <p className="sv-overview-activity-time">{new Date(item.createdAt).toLocaleString()}</p> : null}
                  </div>
                </article>
              ))}
              {!recentActivity.length ? <p className="sv-overview-message">No activity yet.</p> : null}
            </div>
          </article>
        </section>
      </div>
    </main>
  );
}

export default ProjectOverviewPage;

