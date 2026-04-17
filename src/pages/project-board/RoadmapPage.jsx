import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRoadmap } from '../../hooks/useRoadmap';
import { useProjectRouteSync } from '../../hooks/useProjectRouteSync';
import ProjectTabs from './ProjectTabs';

function formatShortDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString(undefined, { month: 'short', day: '2-digit' });
}

function RoadmapPage() {
  const navigate = useNavigate();
  const projectId = useProjectRouteSync();
  const { items, loading, error } = useRoadmap(projectId);

  const normalized = useMemo(
    () =>
      (items || []).map((item) => ({
        ...item,
        progress: Math.max(0, Math.min(100, Number(item.progress || 0))),
      })),
    [items],
  );

  return (
    <main className="min-h-screen">
      <ProjectTabs projectId={projectId} />
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold text-gray-900">Roadmap</h1>
        {loading ? <p className="text-sm text-on-surface-variant">Loading roadmap...</p> : null}
        {error ? <p className="text-sm text-error">{error}</p> : null}

        <div className="overflow-x-auto rounded-xl border border-outline-variant/10 bg-surface-container-lowest">
          <table className="w-full min-w-[980px] border-collapse text-left">
            <thead>
              <tr className="bg-surface-container-low/30">
                <th className="px-4 py-3 text-xs font-semibold uppercase text-on-surface-variant">Title</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase text-on-surface-variant">Type</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase text-on-surface-variant">Assignee</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase text-on-surface-variant">Start</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase text-on-surface-variant">Due</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase text-on-surface-variant">Progress</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-on-surface-variant">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/10">
              {normalized.map((item) => (
                <tr key={item._id}>
                  <td className="px-4 py-3 text-sm font-semibold text-on-surface">
                    <button type="button" onClick={() => navigate(`/tasks/${item._id}`)} className="hover:text-primary">
                      {item.title}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-xs uppercase text-on-surface-variant">{item.type || 'task'}</td>
                  <td className="px-4 py-3 text-xs text-on-surface-variant">{item.assigneeName || 'Unassigned'}</td>
                  <td className="px-4 py-3 text-xs text-on-surface-variant">{formatShortDate(item.startDate)}</td>
                  <td className="px-4 py-3 text-xs text-on-surface-variant">{formatShortDate(item.dueDate)}</td>
                  <td className="px-4 py-3">
                    <div className="h-2 w-full rounded-full bg-surface-container">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${item.progress}%` }} />
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => navigate(`/tasks/${item._id}`)}
                      className="rounded-md bg-surface-container px-2.5 py-1 text-[11px] font-semibold text-on-surface"
                    >
                      Open
                    </button>
                  </td>
                </tr>
              ))}
              {!normalized.length ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm text-on-surface-variant">
                    No roadmap items.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}

export default RoadmapPage;

