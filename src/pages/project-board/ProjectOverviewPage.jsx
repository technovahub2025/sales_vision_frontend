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

function clampPercent(value) {
  const next = Number(value || 0);
  if (Number.isNaN(next)) return 0;
  return Math.max(0, Math.min(100, next));
}

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString(undefined, { month: 'short', day: '2-digit', year: 'numeric' });
}

function formatDateTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(undefined, { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function initials(name) {
  return String(name || '?').trim().slice(0, 1).toUpperCase() || '?';
}

function ProjectOverviewPage() {
  const projectId = useProjectRouteSync();
  const { overview, loading, error } = useProjectOverview(projectId);

  const projectDetails = overview?.projectDetails || {};
  const sprintSummary = overview?.sprintSummary || {};
  const milestones = Array.isArray(overview?.milestones) ? overview.milestones : [];
  const burndown = Array.isArray(overview?.burndown) ? overview.burndown : [];

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
  const statusMetrics = taskBreakdown.filter((item) => (item.kind || 'status') === 'status');
  const priorityMetrics = taskBreakdown.filter((item) => item.kind === 'priority');
  const totalTasks = Number(sprintSummary.totalTasks || statusMetrics.reduce((sum, item) => sum + Number(item.count || 0), 0));
  const completedTasks = Number(sprintSummary.completedTasks || statusMetrics.find((item) => normalizeMetricLabel(item.key).toLowerCase() === 'completed')?.count || 0);
  const completionPct = clampPercent(sprintSummary.completionPct || (totalTasks ? (completedTasks / totalTasks) * 100 : 0));
  const latestBurndown = burndown.at(-1) || null;
  const highestPriority = priorityMetrics
    .slice()
    .sort((a, b) => Number(b.count || 0) - Number(a.count || 0))[0];
  const heroStats = [
    { label: 'Completion', value: `${Math.round(completionPct)}%` },
    { label: 'Tasks', value: `${completedTasks}/${totalTasks}` },
    { label: 'Story points', value: `${sprintSummary.completedStoryPoints || 0}/${sprintSummary.totalStoryPoints || 0}` },
    { label: 'Remaining', value: latestBurndown ? latestBurndown.remaining : totalTasks - completedTasks },
  ];

  return (
    <main className="sv-overview-page">
      <ProjectTabs projectId={projectId} />
      <div className="sv-overview-stack">
        <section className="sv-card sv-overview-hero">
          <div className="sv-overview-hero-copy">
            <span className="sv-overview-eyebrow">{projectDetails.status || 'Live project'}</span>
            <h1 className="sv-overview-title">{projectDetails.name || 'Project Overview'}</h1>
            <p className="sv-overview-subtitle">
              Delivery health, workload, milestones, and the latest activity in one view.
            </p>
            <div className="sv-overview-hero-meta">
              <span>Lead: {projectDetails.lead?.displayName || 'Unassigned'}</span>
              <span>Client: {projectDetails.client?.name || 'No client'}</span>
              <span>{formatDate(projectDetails.startDate)} - {formatDate(projectDetails.endDate)}</span>
            </div>
          </div>
          <div className="sv-overview-health">
            <div className="sv-overview-health-ring" style={{ '--overview-progress': `${completionPct * 3.6}deg` }}>
              <span>{Math.round(completionPct)}%</span>
            </div>
            <p>Project completion</p>
          </div>
        </section>

        {loading ? <p className="sv-overview-message">Loading overview...</p> : null}
        {error ? <p className="sv-overview-message is-error">{error}</p> : null}

        <section className="sv-overview-hero-stats">
          {heroStats.map((item) => (
            <article key={item.label} className="sv-card sv-overview-stat">
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </article>
          ))}
        </section>

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

        <section className="sv-overview-main-grid">
          <article className="sv-card sv-overview-panel sv-overview-workload-panel">
            <div className="sv-overview-panel-head">
              <div>
                <h2 className="sv-overview-panel-title">Team Workload</h2>
                <p className="sv-overview-panel-subtitle">{teamWorkload.length} active member{teamWorkload.length === 1 ? '' : 's'}</p>
              </div>
              <span className="sv-overview-panel-badge">{highestPriority ? `${toTitleCase(highestPriority.key)} priority` : 'Balanced'}</span>
            </div>
            <div className="sv-overview-workload-list">
              {teamWorkload.map((member) => {
                const utilization = clampPercent(member.utilizationPercent ?? member.utilization ?? 0);
                return (
                  <div key={member.userId || member.name} className="sv-overview-workload-row">
                    <div className="sv-overview-workload-avatar">{initials(member.name)}</div>
                    <div className="sv-overview-workload-content">
                      <div className="sv-overview-workload-meta">
                        <span className="sv-overview-workload-name">{member.name}</span>
                        <span className="sv-overview-workload-percent">{utilization}%</span>
                      </div>
                      <div className="sv-overview-workload-track">
                        <div className="sv-overview-workload-fill" style={{ width: `${utilization}%` }} />
                      </div>
                      <p className="sv-overview-workload-subtext">
                        {member.completedInProject || 0} done of {member.tasksInProject || 0} assigned
                      </p>
                    </div>
                  </div>
                );
              })}
              {!teamWorkload.length ? <p className="sv-overview-message">No workload data.</p> : null}
            </div>
          </article>

          <article className="sv-card sv-overview-panel sv-overview-activity-panel">
            <div className="sv-overview-panel-head">
              <div>
                <h2 className="sv-overview-panel-title">Recent Activity</h2>
                <p className="sv-overview-panel-subtitle">Latest project movement</p>
              </div>
              <span className="sv-overview-panel-badge">{recentActivity.length} updates</span>
            </div>
            <div className="sv-overview-activity-list">
              {recentActivity.map((item, index) => (
                <article key={`${item._id || index}`} className="sv-overview-activity-item">
                  <span className="sv-overview-activity-dot" />
                  <div>
                    <p className="sv-overview-activity-text">{item.message || `${item.action || 'updated'} ${item.entity || 'project'}`}</p>
                    <div className="sv-overview-activity-meta">
                      {item.action ? <span className="sv-overview-activity-chip">{toTitleCase(item.action)}</span> : null}
                      <p className="sv-overview-activity-time">{formatDateTime(item.occurredAt || item.createdAt)}</p>
                    </div>
                  </div>
                </article>
              ))}
              {!recentActivity.length ? <p className="sv-overview-message">No activity yet.</p> : null}
            </div>
          </article>
        </section>

        <section className="sv-overview-secondary-grid">
          <article className="sv-card sv-overview-panel">
            <div className="sv-overview-panel-head">
              <div>
                <h2 className="sv-overview-panel-title">Burndown</h2>
                <p className="sv-overview-panel-subtitle">Remaining work trend</p>
              </div>
            </div>
            <div className="sv-overview-burndown">
              {burndown.slice(-14).map((point, index) => {
                const max = Math.max(...burndown.map((row) => Number(row.remaining || row.ideal || 0)), 1);
                const height = clampPercent((Number(point.remaining || 0) / max) * 100);
                return (
                  <span key={point.day || index} className="sv-overview-burndown-bar" title={`${point.day}: ${point.remaining} remaining`}>
                    <i style={{ height: `${height}%` }} />
                  </span>
                );
              })}
              {!burndown.length ? <p className="sv-overview-message">No burndown data yet.</p> : null}
            </div>
          </article>

          <article className="sv-card sv-overview-panel">
            <div className="sv-overview-panel-head">
              <div>
                <h2 className="sv-overview-panel-title">Milestones</h2>
                <p className="sv-overview-panel-subtitle">Upcoming checkpoints</p>
              </div>
            </div>
            <div className="sv-overview-milestones">
              {milestones.slice(0, 4).map((milestone, index) => (
                <div key={milestone.id || milestone.name || index} className="sv-overview-milestone">
                  <span>{index + 1}</span>
                  <div>
                    <strong>{milestone.name || milestone.title || 'Milestone'}</strong>
                    <p>{formatDate(milestone.date || milestone.dueDate || milestone.endDate)}</p>
                  </div>
                </div>
              ))}
              {!milestones.length ? <p className="sv-overview-message">No milestones configured.</p> : null}
            </div>
          </article>
        </section>
      </div>
    </main>
  );
}

export default ProjectOverviewPage;
