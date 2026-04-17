import { useMemo, useState } from 'react';
import { useQueries } from '@tanstack/react-query';
import { useSprints } from '../../hooks/useSprints';
import { useProjectRouteSync } from '../../hooks/useProjectRouteSync';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import ProjectTabs from './ProjectTabs';

function svgPath(points, width, height, maxValue) {
  if (!points.length) return '';
  return points
    .map((point, index) => {
      const x = (index / Math.max(points.length - 1, 1)) * width;
      const y = height - ((Number(point.remaining || 0) / Math.max(maxValue, 1)) * height);
      return `${index === 0 ? 'M' : 'L'}${x},${y}`;
    })
    .join(' ');
}

function SprintsPage() {
  const projectId = useProjectRouteSync();
  const { workspaceId } = useWorkspace();
  const { sprints, loading, error, createSprint, startSprint, completeSprint, getBurndown } = useSprints(projectId);
  const [form, setForm] = useState({
    name: '',
    goal: '',
    startDate: '',
    endDate: '',
  });
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [createSuccess, setCreateSuccess] = useState('');
  const burndownQueries = useQueries({
    queries: (sprints || []).map((sprint) => ({
      queryKey: ['workspace', workspaceId, 'sprints', sprint._id, 'burndown'],
      enabled: Boolean(workspaceId && sprint?._id),
      staleTime: 30_000,
      queryFn: ({ signal }) => getBurndown(sprint._id, signal),
    })),
  });

  const burndown = useMemo(() => {
    const rows = (sprints || []).map((sprint, index) => [
      String(sprint._id),
      burndownQueries[index]?.data || [],
    ]);
    return Object.fromEntries(rows);
  }, [sprints, burndownQueries]);

  const activeSprintId = useMemo(
    () => (sprints.find((item) => String(item.status) === 'active')?._id || ''),
    [sprints],
  );
  const hasSprints = (sprints || []).length > 0;

  const onCreateSprint = async (event) => {
    event.preventDefault();
    const payload = {
      name: String(form.name || '').trim(),
      goal: String(form.goal || '').trim(),
      startDate: form.startDate || undefined,
      endDate: form.endDate || undefined,
    };
    if (!payload.name) {
      setCreateError('Sprint name is required.');
      return;
    }

    setCreateError('');
    setCreateSuccess('');
    setIsCreating(true);
    try {
      await createSprint(payload);
      setCreateSuccess('Sprint created successfully.');
      setForm({ name: '', goal: '', startDate: '', endDate: '' });
    } catch (err) {
      setCreateError(err?.message || 'Failed to create sprint.');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <main className="min-h-screen">
      <ProjectTabs projectId={projectId} />
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="text-2xl font-semibold text-gray-900">Sprints</h1>
          <form onSubmit={onCreateSprint} className="grid w-full max-w-2xl grid-cols-1 gap-2 rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-3 md:grid-cols-2">
            <input
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              placeholder="Sprint name"
              className="rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm"
            />
            <input
              value={form.goal}
              onChange={(event) => setForm((current) => ({ ...current, goal: event.target.value }))}
              placeholder="Sprint goal (optional)"
              className="rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm"
            />
            <input
              type="date"
              value={form.startDate}
              onChange={(event) => setForm((current) => ({ ...current, startDate: event.target.value }))}
              className="rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm"
            />
            <input
              type="date"
              value={form.endDate}
              onChange={(event) => setForm((current) => ({ ...current, endDate: event.target.value }))}
              className="rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm"
            />
            <button
              type="submit"
              disabled={isCreating}
              className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white md:col-span-2"
            >
              {isCreating ? 'Creating Sprint...' : 'Create Sprint'}
            </button>
          </form>
        </div>
        {loading ? <p className="text-sm text-on-surface-variant">Loading sprints...</p> : null}
        {error ? <p className="text-sm text-error">{error}</p> : null}
        {createError ? <p className="text-sm text-error">{createError}</p> : null}
        {createSuccess ? <p className="text-sm text-emerald-600">{createSuccess}</p> : null}

        {!loading && !error && !hasSprints ? (
          <div className="rounded-xl border border-dashed border-outline-variant/40 bg-surface-container-lowest p-8 text-center">
            <h2 className="text-base font-semibold text-on-surface">No sprints yet</h2>
            <p className="mt-1 text-sm text-on-surface-variant">Create your first sprint using the form above, then move backlog tasks into it.</p>
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {(sprints || []).map((sprint) => {
            const points = burndown[sprint._id] || [];
            const maxValue = Math.max(...points.map((point) => Number(point.remaining || 0)), 1);
            const isActive = String(sprint._id) === String(activeSprintId);
            const status = String(sprint.status || '').toLowerCase();
            const canStart = status === 'planning';
            const canComplete = status === 'active';

            return (
              <article
                key={sprint._id}
                className={`rounded-xl border bg-surface-container-lowest p-4 ${isActive ? 'border-primary' : 'border-outline-variant/20'}`}
              >
                <div className="mb-3 flex items-start justify-between">
                  <div>
                    <h3 className="text-base font-semibold text-on-surface">{sprint.name}</h3>
                    <p className="text-xs text-on-surface-variant">{sprint.goal || 'No goal set'}</p>
                  </div>
                  <span className="rounded-full bg-surface-container px-2 py-0.5 text-xs font-bold uppercase text-on-surface-variant">
                    {sprint.status}
                  </span>
                </div>
                <div className="mb-4 h-28 rounded-lg bg-surface-container-low p-2">
                  <svg viewBox="0 0 240 80" className="h-full w-full">
                    <path d={svgPath(points, 240, 80, maxValue)} fill="none" stroke="currentColor" className="text-primary" strokeWidth="2" />
                  </svg>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => startSprint(sprint._id)}
                    disabled={!canStart}
                    className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Start Sprint
                  </button>
                  <button
                    type="button"
                    onClick={() => completeSprint(sprint._id)}
                    disabled={!canComplete}
                    className="rounded-lg border border-outline-variant px-3 py-1.5 text-xs font-semibold text-on-surface disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Complete Sprint
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </main>
  );
}

export default SprintsPage;

