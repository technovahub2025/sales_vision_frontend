import { useDeferredValue, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRoadmap } from '../../hooks/useRoadmap';
import { useProjectRouteSync } from '../../hooks/useProjectRouteSync';
import ProjectTabs from './ProjectTabs';
import Icon from '../../components/ui/Icon';
import DeniedActionButton from '../../components/ui/DeniedActionButton';
import RowActionMenu from '../../components/ui/RowActionMenu';
import { usePlanAccess } from '../../hooks/usePlanAccess';
import SelectDropdown from '../../components/ui/SelectDropdown';

function formatShortDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString(undefined, { month: 'short', day: '2-digit' });
}

function RoadmapPage() {
  const navigate = useNavigate();
  const projectId = useProjectRouteSync();
  const { canUseFeature } = usePlanAccess();
  const roadmapAllowed = canUseFeature('roadmap');
  const { items, loading, error } = useRoadmap(projectId);
  const [openRowMenuId, setOpenRowMenuId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [sortBy, setSortBy] = useState('start');
  const [showFilters, setShowFilters] = useState(false);
  const deferredSearchQuery = useDeferredValue(searchQuery);

  const normalized = useMemo(
    () =>
      (items || []).map((item) => ({
        ...item,
        progress: Math.max(0, Math.min(100, Number(item.progress || 0))),
        typeLabel: String(item.type || 'task').toUpperCase(),
        assigneeLabel: String(item.assigneeName || '').trim() || 'Unassigned',
      })),
    [items],
  );

  const filtered = useMemo(() => {
    const query = String(deferredSearchQuery || '').trim().toLowerCase();
    const type = String(typeFilter || 'all').toLowerCase();
    const list = normalized.filter((item) => {
      const itemType = String(item.type || 'task').toLowerCase();
      const matchesType = type === 'all' || itemType === type;
      if (!matchesType) return false;
      if (!query) return true;
      const haystack = `${item.title || ''} ${item.assigneeLabel} ${itemType}`.toLowerCase();
      return haystack.includes(query);
    });

    const asTime = (value) => {
      if (!value) return Number.POSITIVE_INFINITY;
      const time = new Date(value).getTime();
      return Number.isNaN(time) ? Number.POSITIVE_INFINITY : time;
    };

    const sorted = [...list].sort((a, b) => {
      if (sortBy === 'due') {
        const diff = asTime(a.dueDate) - asTime(b.dueDate);
        if (diff !== 0) return diff;
      } else if (sortBy === 'progress') {
        const diff = b.progress - a.progress;
        if (diff !== 0) return diff;
      } else {
        const diff = asTime(a.startDate) - asTime(b.startDate);
        if (diff !== 0) return diff;
      }
      return String(a.title || '').localeCompare(String(b.title || ''));
    });

    return sorted;
  }, [normalized, deferredSearchQuery, typeFilter, sortBy]);

  const summary = useMemo(() => {
    const total = normalized.length;
    const tasks = normalized.filter((item) => String(item.type || 'task').toLowerCase() === 'task').length;
    const sprints = normalized.filter((item) => String(item.type || '').toLowerCase() === 'sprint').length;
    const averageProgress = total
      ? Math.round(normalized.reduce((sum, item) => sum + item.progress, 0) / total)
      : 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const atRisk = normalized.filter((item) => {
      if (!item.dueDate || item.progress >= 100) return false;
      const dueDate = new Date(item.dueDate);
      if (Number.isNaN(dueDate.getTime())) return false;
      dueDate.setHours(0, 0, 0, 0);
      return dueDate < today;
    }).length;

    return { total, tasks, sprints, averageProgress, atRisk };
  }, [normalized]);

  const hasSearch = searchQuery.trim().length > 0;
  const activeFilterCount = Number(typeFilter !== 'all') + Number(sortBy !== 'start');
  const hasActiveFilters = hasSearch || activeFilterCount > 0;
  const clearFilters = () => {
    setSearchQuery('');
    setTypeFilter('all');
    setSortBy('start');
    setShowFilters(false);
  };

  const typeOptions = [
    { value: 'all', label: 'All types' },
    { value: 'task', label: 'Tasks only' },
    { value: 'sprint', label: 'Sprints only' },
  ];

  const sortOptions = [
    { value: 'start', label: 'Start date' },
    { value: 'due', label: 'Due date' },
    { value: 'progress', label: 'Progress' },
  ];

  return (
    <main className="sv-roadmap-page">
      <ProjectTabs projectId={projectId} />
      {!roadmapAllowed ? (
        <div className="sv-roadmap-stack">
          <section className="sv-card sv-roadmap-toolbar is-locked">
            <p className="sv-roadmap-eyebrow">Planning timeline</p>
            <h1 className="sv-roadmap-title">Roadmap</h1>
            <p className="sv-roadmap-subtitle">Upgrade to Pro to map project tasks and sprints across a timeline.</p>
            <DeniedActionButton
              role="owner"
              actionLabel="use roadmap"
              message="Free plan cannot access roadmap"
              className="btn btn-light btn-sm sv-ctl-btn sv-roadmap-open-btn"
            >
              Roadmap Locked
            </DeniedActionButton>
          </section>
        </div>
      ) : null}
      {roadmapAllowed ? (
      <div className="sv-roadmap-stack">
        <section className="sv-card sv-roadmap-toolbar">
          <div className="sv-roadmap-toolbar-head">
            <div className="sv-roadmap-toolbar-copy">
              <p className="sv-roadmap-eyebrow">Planning timeline</p>
              <h1 className="sv-roadmap-title">Roadmap</h1>
              <p className="sv-roadmap-subtitle">
                Track delivery windows, owners, and progress for project tasks and sprint milestones.
              </p>
            </div>
            <div className="sv-roadmap-summary-grid" aria-label="Roadmap summary">
              <div className="sv-roadmap-summary-chip">
                <strong>{summary.total}</strong>
                <span>Total items</span>
              </div>
              <div className="sv-roadmap-summary-chip">
                <strong>{summary.tasks}</strong>
                <span>Tasks</span>
              </div>
              <div className="sv-roadmap-summary-chip">
                <strong>{summary.sprints}</strong>
                <span>Sprints</span>
              </div>
              <div className={`sv-roadmap-summary-chip ${summary.atRisk ? 'is-risk' : ''}`}>
                <strong>{summary.averageProgress}%</strong>
                <span>{summary.atRisk ? `${summary.atRisk} at risk` : 'Avg progress'}</span>
              </div>
            </div>
          </div>
          <div className="sv-roadmap-controls">
            <div className="sv-roadmap-search-wrap">
              <Icon name="search" className="sv-roadmap-search-icon" />
              <input
                type="text"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search title, assignee, type..."
                className="form-control form-control-sm sv-ctl-input sv-roadmap-search"
              />
            </div>
            <button
              type="button"
              onClick={() => setShowFilters((current) => !current)}
              className={`btn btn-sm sv-ctl-btn sv-roadmap-filter-toggle ${showFilters ? 'btn-primary is-active' : 'btn-light'}`}
              aria-expanded={showFilters}
            >
              Filters
              {activeFilterCount ? <span className="sv-roadmap-filter-badge">{activeFilterCount}</span> : null}
            </button>
            {hasActiveFilters ? (
              <button type="button" className="btn btn-light btn-sm sv-ctl-btn sv-roadmap-clear-btn" onClick={clearFilters}>
                Clear
              </button>
            ) : null}
          </div>
          {showFilters ? (
            <div className="sv-roadmap-filter-panel">
              <label className="sv-roadmap-filter-field">
                <span>Type</span>
                <SelectDropdown
                  value={typeFilter}
                  options={typeOptions}
                  onChange={setTypeFilter}
                  ariaLabel="Filter roadmap by type"
                  className="sv-roadmap-select"
                />
              </label>
              <label className="sv-roadmap-filter-field">
                <span>Sort by</span>
                <SelectDropdown
                  value={sortBy}
                  options={sortOptions}
                  onChange={setSortBy}
                  ariaLabel="Sort roadmap"
                  className="sv-roadmap-select"
                />
              </label>
            </div>
          ) : null}
          {loading ? (
            <div className="sv-roadmap-state-card">
              <Icon name="sync" />
              <span>Loading roadmap timeline...</span>
            </div>
          ) : null}
          {error ? (
            <div className="sv-roadmap-state-card is-error">
              <Icon name="warning" />
              <span>{error}</span>
            </div>
          ) : null}
        </section>

        <section className="sv-card sv-roadmap-table-wrap">
          <div className="sv-roadmap-list-head">
            <div>
              <p className="sv-roadmap-list-kicker">Timeline items</p>
              <h2>{filtered.length} visible</h2>
            </div>
            {hasActiveFilters ? <span>{normalized.length} total in project</span> : null}
          </div>
          <div className="sv-roadmap-table-scroll">
            <table className="sv-roadmap-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Type</th>
                  <th>Assignee</th>
                  <th>Start</th>
                  <th>Due</th>
                  <th>Progress</th>
                  <th className="sv-row-action-heading">Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => (
                  <tr key={item._id}>
                    <td className="sv-roadmap-title-cell" data-label="Title">
                      <button type="button" onClick={() => navigate(`/tasks/${item._id}`)} className="sv-roadmap-title-link">
                        {item.title}
                      </button>
                      <span className="sv-roadmap-title-meta">
                        {formatShortDate(item.startDate)} to {formatShortDate(item.dueDate)}
                      </span>
                    </td>
                    <td data-label="Type">
                      <span className={`sv-roadmap-type-chip ${item.typeLabel === 'SPRINT' ? 'is-sprint' : 'is-task'}`}>
                        {item.typeLabel}
                      </span>
                    </td>
                    <td data-label="Assignee" className={`${item.assigneeLabel === 'Unassigned' ? 'is-unassigned' : ''}`}>{item.assigneeLabel}</td>
                    <td data-label="Start">{formatShortDate(item.startDate)}</td>
                    <td data-label="Due">{formatShortDate(item.dueDate)}</td>
                    <td data-label="Progress">
                      <div className="sv-roadmap-progress-row">
                        <div className="sv-roadmap-progress-track">
                          <div className="sv-roadmap-progress-fill" style={{ width: `${item.progress}%` }} />
                        </div>
                        <span className="sv-roadmap-progress-text">{item.progress}%</span>
                      </div>
                    </td>
                    <td className="sv-row-action-cell" data-label="Action">
                      <RowActionMenu
                        open={openRowMenuId === item._id}
                        onTrigger={() => setOpenRowMenuId((current) => (current === item._id ? '' : item._id))}
                        onClose={() => setOpenRowMenuId('')}
                        ariaLabel={`Actions for ${item.title || 'roadmap item'}`}
                        items={[
                          {
                            key: 'open',
                            label: 'Open',
                            icon: 'open_in_new',
                            onClick: () => navigate(`/tasks/${item._id}`),
                          },
                        ]}
                        triggerClassName="sv-roadmap-row-action-trigger"
                        menuClassName="sv-roadmap-row-action-menu"
                      />
                    </td>
                  </tr>
                ))}
                {!filtered.length ? (
                  <tr>
                    <td colSpan={7} className="sv-roadmap-empty-cell">
                      <div className="sv-roadmap-empty-state">
                        <span className="sv-roadmap-empty-icon">
                          <Icon name="route" />
                        </span>
                        <strong>{hasActiveFilters ? 'No matching roadmap items' : 'No roadmap items yet'}</strong>
                        <p>
                          {hasActiveFilters
                            ? 'Try clearing the search or filters to see the full project timeline.'
                            : 'Tasks and sprints with dates will appear here when the project timeline is ready.'}
                        </p>
                        {hasActiveFilters ? (
                          <button type="button" className="btn btn-light btn-sm sv-ctl-btn" onClick={clearFilters}>
                            Clear filters
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>
      ) : null}
    </main>
  );
}

export default RoadmapPage;

