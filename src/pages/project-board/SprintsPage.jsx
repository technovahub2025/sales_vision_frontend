import { useMemo, useState } from 'react';
import { useQueries } from '@tanstack/react-query';
import { useSprints } from '../../hooks/useSprints';
import { useProjectRouteSync } from '../../hooks/useProjectRouteSync';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import ProjectTabs from './ProjectTabs';
import DatePicker from '../../components/ui/DatePicker';

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

function sprintStatus(sprint) {
  return String(sprint?.status || '').toLowerCase();
}

function SprintsPage() {
  const projectId = useProjectRouteSync();
  const { workspaceId } = useWorkspace();
  const { sprints, loading, error, createSprint, startSprint, completeSprint, getBurndown } = useSprints(projectId);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [showAllCompleted, setShowAllCompleted] = useState(false);
  const [form, setForm] = useState({
    name: '',
    goal: '',
    startDate: '',
    endDate: '',
  });
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [createSuccess, setCreateSuccess] = useState('');

  const sprintList = useMemo(() => sprints || [], [sprints]);
  const liveSprints = useMemo(
    () => sprintList.filter((sprint) => ['planning', 'active'].includes(sprintStatus(sprint))),
    [sprintList],
  );
  const completedSprints = useMemo(
    () => sprintList.filter((sprint) => ['completed', 'complete'].includes(sprintStatus(sprint))),
    [sprintList],
  );
  const visibleCompletedSprints = useMemo(
    () => (showAllCompleted ? completedSprints : completedSprints.slice(0, 6)),
    [completedSprints, showAllCompleted],
  );

  const burndownQueries = useQueries({
    queries: liveSprints.map((sprint) => ({
      queryKey: ['workspace', workspaceId, 'sprints', sprint._id, 'burndown'],
      enabled: Boolean(workspaceId && sprint?._id),
      staleTime: 30_000,
      queryFn: ({ signal }) => getBurndown(sprint._id, signal),
    })),
  });

  const burndown = useMemo(
    () =>
      Object.fromEntries(
        liveSprints.map((sprint, index) => [String(sprint._id), burndownQueries[index]?.data || []]),
      ),
    [liveSprints, burndownQueries],
  );

  const activeSprintId = useMemo(
    () => (sprintList.find((item) => sprintStatus(item) === 'active')?._id || ''),
    [sprintList],
  );
  const hasSprints = sprintList.length > 0;
  const sprintSummary = useMemo(
    () =>
      sprintList.reduce(
        (acc, sprint) => {
          acc.total += 1;
          const status = sprintStatus(sprint);
          if (status === 'planning') acc.planning += 1;
          if (status === 'active') acc.active += 1;
          if (status === 'completed' || status === 'complete') acc.completed += 1;
          return acc;
        },
        { total: 0, planning: 0, active: 0, completed: 0 },
      ),
    [sprintList],
  );
  const sprintsHint = useMemo(() => {
    if (!sprintSummary.total) return 'Create your first sprint to start planning.';
    if (sprintSummary.active) return `${sprintSummary.active} active sprint${sprintSummary.active === 1 ? '' : 's'} in progress.`;
    if (sprintSummary.planning) return `${sprintSummary.planning} sprint${sprintSummary.planning === 1 ? '' : 's'} ready to start.`;
    return `${sprintSummary.completed} completed sprint${sprintSummary.completed === 1 ? '' : 's'} in history.`;
  }, [sprintSummary]);

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
            <div className="sv-sprints-toolbar-copy">
              <p className="sv-sprints-eyebrow">Sprint workspace</p>
              <h1 className="sv-sprints-title">Sprints</h1>
              <p className="sv-sprints-subtitle text-sm text-on-surface-variant">
                Create, start, and complete sprints here. Backlog stays focused on intake and bulk moves.
              </p>
              <p className="sv-sprints-hint text-sm text-on-surface-variant">{sprintsHint}</p>
            </div>
            <button
              type="button"
              onClick={openCreateModal}
              className="btn btn-primary sv-ctl-btn sv-sprints-create-toggle"
            >
              + Create Sprint
            </button>
          </div>
          <div className="sv-sprints-summary-row">
            <div className="sv-sprints-summary-chip">
              <strong>{sprintSummary.total}</strong>
              <span>Total</span>
            </div>
            <div className="sv-sprints-summary-chip">
              <strong>{sprintSummary.planning}</strong>
              <span>Planning</span>
            </div>
            <div className="sv-sprints-summary-chip">
              <strong>{sprintSummary.active}</strong>
              <span>Active</span>
            </div>
            <div className="sv-sprints-summary-chip">
              <strong>{sprintSummary.completed}</strong>
              <span>Completed</span>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="sv-card sv-sprints-status-card">
            <div className="sv-sprints-status-icon">
              <span className="material-symbols-outlined">calendar_month</span>
            </div>
            <div className="sv-sprints-status-copy">
              <p className="sv-sprints-message-title">Loading sprint workspace</p>
              <p className="sv-sprints-message-subtitle">Fetching sprint cards and burndown data.</p>
            </div>
          </div>
        ) : null}

        {error ? (
          <div className="sv-card sv-sprints-status-card is-error">
            <div className="sv-sprints-status-icon is-error">
              <span className="material-symbols-outlined">error</span>
            </div>
            <div className="sv-sprints-status-copy">
              <p className="sv-sprints-message-title">Unable to load sprints</p>
              <p className="sv-sprints-message-subtitle">{error}</p>
            </div>
          </div>
        ) : null}

        {!loading && !error && !hasSprints ? (
          <div className="sv-card sv-sprints-empty">
            <div className="sv-sprints-empty-icon">
              <span className="material-symbols-outlined">calendar_month</span>
            </div>
            <h2 className="sv-sprints-empty-title text-base font-semibold text-on-surface">No sprints yet</h2>
            <p className="sv-sprints-empty-text mt-1 text-sm text-on-surface-variant">
              Create a sprint to plan work, track burndown, and manage completion in one place.
            </p>
            <p className="sv-sprints-empty-note text-xs text-on-surface-variant">
              Start with a short goal, then move backlog items into it when you are ready.
            </p>
            <button type="button" onClick={openCreateModal} className="btn btn-primary sv-ctl-btn sv-sprints-empty-action">
              Create Sprint
            </button>
          </div>
        ) : null}

        {liveSprints.length ? (
          <section className="sv-sprints-section">
            <div className="sv-sprints-section-head">
              <div>
                <h2 className="sv-sprints-section-title">Live sprints</h2>
                <p className="sv-sprints-section-subtitle">Planning and active work with burndown visibility.</p>
              </div>
              <span className="sv-sprints-section-count">{liveSprints.length}</span>
            </div>
            <div className="sv-sprints-grid">
              {liveSprints.map((sprint) => {
                const status = sprintStatus(sprint);
                const points = burndown[sprint._id] || [];
                const maxValue = Math.max(...points.map((point) => Number(point.remaining || 0)), 1);
                const isActive = String(sprint._id) === String(activeSprintId);
                const canStart = status === 'planning';
                const canComplete = status === 'active';

                return (
                  <article key={sprint._id} className={`sv-card sv-sprint-card ${isActive ? 'is-active' : ''}`}>
                    <div className="sv-sprint-card-head">
                      <div className="sv-sprint-card-copy">
                        <h3 className="sv-sprint-card-title">{sprint.name}</h3>
                        <p className="sv-sprint-card-goal text-xs text-on-surface-variant">{sprint.goal || 'No goal set'}</p>
                        <div className="sv-sprint-card-meta">
                          {sprint.startDate ? <span>{`Starts ${new Date(sprint.startDate).toLocaleDateString()}`}</span> : null}
                          {sprint.endDate ? <span>{`Ends ${new Date(sprint.endDate).toLocaleDateString()}`}</span> : null}
                        </div>
                      </div>
                      <span className="sv-sprint-status-chip rounded-full bg-surface-container px-2 py-0.5 text-xs font-bold uppercase text-on-surface-variant">
                        {sprint.status}
                      </span>
                    </div>
                    <div className="sv-sprint-card-badges">
                      {isActive ? <span className="sv-sprint-state-pill is-live">Current sprint</span> : null}
                      {sprint.goal ? <span className="sv-sprint-state-pill">Goal set</span> : <span className="sv-sprint-state-pill">No goal</span>}
                    </div>
                    <div className="sv-sprint-chart-wrap">
                      <div className="sv-sprint-chart-labels">
                        <span>Burndown</span>
                        <span>{points.length ? `${points[points.length - 1]?.remaining ?? 0} remaining` : 'No chart data yet'}</span>
                      </div>
                      <svg viewBox="0 0 240 80" className="h-full w-full">
                        <path d={svgPath(points, 240, 80, maxValue)} fill="none" stroke="currentColor" className="text-primary" strokeWidth="2" />
                      </svg>
                    </div>
                    <div className="sv-sprint-card-foot">
                      <span>{canStart ? 'Ready to begin' : canComplete ? 'Track remaining work before closing' : 'Sprint completed'}</span>
                    </div>
                    <div className="sv-sprint-actions">
                      <button
                        type="button"
                        onClick={() => startSprint(sprint._id)}
                        disabled={!canStart}
                        className="btn btn-primary sv-ctl-btn sv-sprint-action-btn disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Start
                      </button>
                      <button
                        type="button"
                        onClick={() => completeSprint(sprint._id)}
                        disabled={!canComplete}
                        className="btn btn-light sv-ctl-btn sv-sprint-action-btn disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Complete
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ) : null}

        {completedSprints.length ? (
          <section className="sv-sprints-section">
            <div className="sv-sprints-section-head">
              <div>
                <h2 className="sv-sprints-section-title">Completed history</h2>
                <p className="sv-sprints-section-subtitle">
                  Archived sprints are summarized here without loading burndown data upfront.
                </p>
              </div>
              <div className="sv-sprints-section-actions">
                <span className="sv-sprints-section-count">{completedSprints.length}</span>
                {completedSprints.length > 6 ? (
                  <button
                    type="button"
                    onClick={() => setShowAllCompleted((current) => !current)}
                    className="btn btn-light sv-ctl-btn sv-sprints-section-toggle"
                  >
                    {showAllCompleted ? 'Show less' : 'Show all'}
                  </button>
                ) : null}
              </div>
            </div>
            <div className="sv-sprints-grid">
              {visibleCompletedSprints.map((sprint) => {
                const status = sprintStatus(sprint);
                return (
                  <article key={sprint._id} className="sv-card sv-sprint-card is-history">
                    <div className="sv-sprint-card-head">
                      <div className="sv-sprint-card-copy">
                        <h3 className="sv-sprint-card-title">{sprint.name}</h3>
                        <p className="sv-sprint-card-goal text-xs text-on-surface-variant">{sprint.goal || 'No goal set'}</p>
                        <div className="sv-sprint-card-meta">
                          {sprint.startDate ? <span>{`Starts ${new Date(sprint.startDate).toLocaleDateString()}`}</span> : null}
                          {sprint.endDate ? <span>{`Ends ${new Date(sprint.endDate).toLocaleDateString()}`}</span> : null}
                        </div>
                      </div>
                      <span className="sv-sprint-status-chip rounded-full bg-surface-container px-2 py-0.5 text-xs font-bold uppercase text-on-surface-variant">
                        {sprint.status}
                      </span>
                    </div>
                    <div className="sv-sprint-card-badges">
                      <span className={`sv-sprint-state-pill is-${status}`}>Completed</span>
                      {sprint.goal ? <span className="sv-sprint-state-pill">Goal set</span> : <span className="sv-sprint-state-pill">No goal</span>}
                    </div>
                    <div className="sv-sprint-history-panel">
                      <div className="sv-sprint-history-figure">
                        <span className="material-symbols-outlined">task_alt</span>
                      </div>
                      <div className="sv-sprint-history-copy">
                        <strong>Burndown archived</strong>
                        <span>History stays lightweight until you open the full sprint record.</span>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ) : null}
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
              <div>
                <h2 className="sv-sprints-create-modal-title">Create Sprint</h2>
                <p className="sv-sprints-create-modal-subtitle text-sm text-on-surface-variant">
                  Define a sprint goal and schedule before moving work into it.
                </p>
              </div>
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
              <label className="sv-sprints-field sv-sprints-field-required">
                <span className="sv-sprints-field-label">Sprint name</span>
                <input
                  value={form.name}
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                  placeholder="Sprint name"
                  className="form-control sv-ctl-input sv-sprints-input"
                />
              </label>
              <label className="sv-sprints-field">
                <span className="sv-sprints-field-label">Goal</span>
                <input
                  value={form.goal}
                  onChange={(event) => setForm((current) => ({ ...current, goal: event.target.value }))}
                  placeholder="Sprint goal (optional)"
                  className="form-control sv-ctl-input sv-sprints-input"
                />
              </label>
              <label className="sv-sprints-field">
                <span className="sv-sprints-field-label">Start date</span>
                <DatePicker
                  value={form.startDate}
                  onChange={(nextValue) => setForm((current) => ({ ...current, startDate: nextValue }))}
                  className="sv-sprints-input"
                  triggerClassName="sv-ctl-input"
                  placeholder="Start date"
                />
              </label>
              <label className="sv-sprints-field">
                <span className="sv-sprints-field-label">End date</span>
                <DatePicker
                  value={form.endDate}
                  onChange={(nextValue) => setForm((current) => ({ ...current, endDate: nextValue }))}
                  className="sv-sprints-input"
                  triggerClassName="sv-ctl-input"
                  placeholder="End date"
                />
              </label>
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
