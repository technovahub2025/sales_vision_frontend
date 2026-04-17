import { useMemo } from 'react';
import { useProjectOverview } from '../../hooks/useProjectOverview';
import { useProjectRouteSync } from '../../hooks/useProjectRouteSync';
import ProjectTabs from './ProjectTabs';

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
    () => overview?.teamWorkload || [],
    [overview],
  );
  const recentActivity = useMemo(
    () => overview?.recentActivity || [],
    [overview],
  );

  return (
    <main className="min-h-screen">
      <ProjectTabs projectId={projectId} />
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold text-gray-900">Project Overview</h1>
        {loading ? <p className="text-sm text-on-surface-variant">Loading overview...</p> : null}
        {error ? <p className="text-sm text-error">{error}</p> : null}

        <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {taskBreakdown.map((item) => (
            <article key={`${item.kind || 'metric'}:${item.key || item.status || item.priority}`} className="rounded-xl border border-outline-variant/10 bg-surface-container-lowest p-4">
              <p className="text-xs uppercase text-on-surface-variant">{item.key || item.status || item.priority}</p>
              <p className="text-2xl font-bold text-on-surface">{item.count || 0}</p>
            </article>
          ))}
        </section>

        <section className="rounded-xl border border-outline-variant/10 bg-surface-container-lowest p-4">
          <h2 className="mb-3 text-sm font-semibold text-on-surface">Team Workload</h2>
          <div className="space-y-3">
            {teamWorkload.map((member) => (
              <div key={member.userId || member.name}>
                <div className="mb-1 flex justify-between text-xs text-on-surface-variant">
                  <span>{member.name}</span>
                  <span>{member.utilizationPercent ?? member.utilization ?? 0}%</span>
                </div>
                <div className="h-2 rounded-full bg-surface-container">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(0, Math.min(100, Number(member.utilizationPercent ?? member.utilization ?? 0)))}%` }} />
                </div>
              </div>
            ))}
            {!teamWorkload.length ? <p className="text-sm text-on-surface-variant">No workload data.</p> : null}
          </div>
        </section>

        <section className="rounded-xl border border-outline-variant/10 bg-surface-container-lowest p-4">
          <h2 className="mb-3 text-sm font-semibold text-on-surface">Recent Activity</h2>
          <div className="space-y-2">
            {recentActivity.map((item, index) => (
              <p key={`${item._id || index}`} className="text-sm text-on-surface-variant">
                {item.message || `${item.action || 'updated'} ${item.entity || 'project'}`}
              </p>
            ))}
            {!recentActivity.length ? <p className="text-sm text-on-surface-variant">No activity yet.</p> : null}
          </div>
        </section>
      </div>
    </main>
  );
}

export default ProjectOverviewPage;

