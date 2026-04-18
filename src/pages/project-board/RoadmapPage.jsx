import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRoadmap } from '../../hooks/useRoadmap';
import { useProjectRouteSync } from '../../hooks/useProjectRouteSync';
import ProjectTabs from './ProjectTabs';
import Icon from '../../components/ui/Icon';

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
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [sortBy, setSortBy] = useState('start');
  const [showFilters, setShowFilters] = useState(false);

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
    const query = String(searchQuery || '').trim().toLowerCase();
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
  }, [normalized, searchQuery, typeFilter, sortBy]);

  return (
    <main className="sv-roadmap-page">
      <ProjectTabs projectId={projectId} />
      <div className="sv-roadmap-stack">
        <section className="sv-card sv-roadmap-toolbar">
          <div className="sv-roadmap-toolbar-head">
            <div>
              <h1 className="sv-roadmap-title">Roadmap</h1>
              <p className="sv-roadmap-subtitle">
                {filtered.length} of {normalized.length} items
                {searchQuery || typeFilter !== 'all' ? ' (filtered)' : ''}
              </p>
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
            >
              Filters
            </button>
          </div>
          {showFilters ? (
            <div className="sv-roadmap-filter-panel">
              <select
                value={typeFilter}
                onChange={(event) => setTypeFilter(event.target.value)}
                className="form-select form-select-sm sv-ctl-select sv-roadmap-select"
              >
                <option value="all">All Types</option>
                <option value="task">Task</option>
                <option value="sprint">Sprint</option>
              </select>
              <select
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value)}
                className="form-select form-select-sm sv-ctl-select sv-roadmap-select"
              >
                <option value="start">Sort: Start Date</option>
                <option value="due">Sort: Due Date</option>
                <option value="progress">Sort: Progress</option>
              </select>
            </div>
          ) : null}
          {loading ? <p className="sv-roadmap-message">Loading roadmap...</p> : null}
          {error ? <p className="sv-roadmap-message is-error">{error}</p> : null}
        </section>

        <section className="sv-card sv-roadmap-table-wrap">
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
                  <th className="is-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => (
                  <tr key={item._id}>
                    <td className="sv-roadmap-title-cell">
                      <button type="button" onClick={() => navigate(`/tasks/${item._id}`)} className="sv-roadmap-title-link">
                        {item.title}
                      </button>
                    </td>
                    <td>
                      <span className={`sv-roadmap-type-chip ${item.typeLabel === 'SPRINT' ? 'is-sprint' : 'is-task'}`}>
                        {item.typeLabel}
                      </span>
                    </td>
                    <td className={`${item.assigneeLabel === 'Unassigned' ? 'is-unassigned' : ''}`}>{item.assigneeLabel}</td>
                    <td>{formatShortDate(item.startDate)}</td>
                    <td>{formatShortDate(item.dueDate)}</td>
                    <td>
                      <div className="sv-roadmap-progress-row">
                        <div className="sv-roadmap-progress-track">
                          <div className="sv-roadmap-progress-fill" style={{ width: `${item.progress}%` }} />
                        </div>
                        <span className="sv-roadmap-progress-text">{item.progress}%</span>
                      </div>
                    </td>
                    <td className="is-right">
                      <button
                        type="button"
                        onClick={() => navigate(`/tasks/${item._id}`)}
                        className="btn btn-light btn-sm sv-ctl-btn sv-roadmap-open-btn"
                      >
                        Open
                      </button>
                    </td>
                  </tr>
                ))}
                {!filtered.length ? (
                  <tr>
                    <td colSpan={7} className="sv-roadmap-empty-cell">
                      No roadmap items.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}

export default RoadmapPage;

