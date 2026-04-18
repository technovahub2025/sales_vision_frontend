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
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
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

  const openCreateModal = () => {
    setCreateError('');
    setCreateSuccess('');
    setIsCreateModalOpen(true);
  };

  const closeCreateModal = () => {
    if (isCreating) return;
    setCreateError('');
    setCreateSuccess('');
    setIsCreateModalOpen(false);
  };

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
      setIsCreateModalOpen(false);
    } catch (err) {
      setCreateError(err?.message || 'Failed to create sprint.');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <main className="sv-sprints-page">
      <ProjectTabs projectId={projectId} />
      <div className="sv-sprints-stack">
        <div className="sv-card sv-sprints-toolbar">
          <div className="sv-sprints-toolbar-head">
            <h1 className="sv-sprints-title">Sprints</h1>
            <button
              type="button"
              onClick={openCreateModal}
              className="btn btn-primary sv-ctl-btn sv-sprints-create-toggle"
            >
              + Create Sprint
            </button>
          </div>
        </div>
        {loading ? <p className="sv-sprints-message text-sm text-on-surface-variant">Loading sprints...</p> : null}
        {error ? <p className="sv-sprints-message is-error text-sm text-error">{error}</p> : null}

        {!loading && !error && !hasSprints ? (
          <div className="sv-card sv-sprints-empty">
            <h2 className="sv-sprints-empty-title text-base font-semibold text-on-surface">No sprints yet</h2>
            <p className="sv-sprints-empty-text mt-1 text-sm text-on-surface-variant">Create your first sprint, then move backlog tasks into it.</p>
          </div>
        ) : null}

        <div className="sv-sprints-grid">
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
                className={`sv-card sv-sprint-card ${isActive ? 'is-active' : ''}`}
              >
                <div className="sv-sprint-card-head">
                  <div>
                    <h3 className="sv-sprint-card-title">{sprint.name}</h3>
                    <p className="sv-sprint-card-goal text-xs text-on-surface-variant">{sprint.goal || 'No goal set'}</p>
                  </div>
                  <span className="sv-sprint-status-chip rounded-full bg-surface-container px-2 py-0.5 text-xs font-bold uppercase text-on-surface-variant">
                    {sprint.status}
                  </span>
                </div>
                <div className="sv-sprint-chart-wrap">
                  <svg viewBox="0 0 240 80" className="h-full w-full">
                    <path d={svgPath(points, 240, 80, maxValue)} fill="none" stroke="currentColor" className="text-primary" strokeWidth="2" />
                  </svg>
                </div>
                <div className="sv-sprint-actions">
                  <button
                    type="button"
                    onClick={() => startSprint(sprint._id)}
                    disabled={!canStart}
                    className="btn btn-primary sv-ctl-btn sv-sprint-action-btn disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Start Sprint
                  </button>
                  <button
                    type="button"
                    onClick={() => completeSprint(sprint._id)}
                    disabled={!canComplete}
                    className="btn btn-light sv-ctl-btn sv-sprint-action-btn disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Complete Sprint
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </div>

      {isCreateModalOpen ? (
        <div
          className="sv-modal-backdrop sv-sprints-create-modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-3"
          onClick={(event) => {
            if (event.target === event.currentTarget) closeCreateModal();
          }}
        >
          <div className="sv-modal-panel sv-sprints-create-modal" role="dialog" aria-modal="true" aria-label="Create Sprint">
            <div className="sv-sprints-create-modal-head">
              <h2 className="sv-sprints-create-modal-title">Create Sprint</h2>
              <button
                type="button"
                className="sv-modal-close-btn"
                onClick={closeCreateModal}
                aria-label="Close create sprint modal"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <form onSubmit={onCreateSprint} className="sv-sprints-create-modal-form">
              <input
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="Sprint name"
                className="form-control sv-ctl-input sv-sprints-input"
              />
              <input
                value={form.goal}
                onChange={(event) => setForm((current) => ({ ...current, goal: event.target.value }))}
                placeholder="Sprint goal (optional)"
                className="form-control sv-ctl-input sv-sprints-input"
              />
              <input
                type="date"
                value={form.startDate}
                onChange={(event) => setForm((current) => ({ ...current, startDate: event.target.value }))}
                className="form-control sv-ctl-input sv-sprints-input"
              />
              <input
                type="date"
                value={form.endDate}
                onChange={(event) => setForm((current) => ({ ...current, endDate: event.target.value }))}
                className="form-control sv-ctl-input sv-sprints-input"
              />
              {createError ? <p className="sv-sprints-message is-error text-sm text-error">{createError}</p> : null}
              {createSuccess ? <p className="sv-sprints-message is-success text-sm text-emerald-600">{createSuccess}</p> : null}
              <div className="sv-sprints-create-modal-actions">
                <button
                  type="button"
                  className="btn btn-light sv-ctl-btn"
                  onClick={closeCreateModal}
                  disabled={isCreating}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="btn btn-primary sv-ctl-btn"
                >
                  {isCreating ? 'Creating Sprint...' : 'Create Sprint'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </main>
  );
}

export default SprintsPage;

