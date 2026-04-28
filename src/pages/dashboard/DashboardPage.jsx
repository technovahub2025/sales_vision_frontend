import { useEffect, useMemo, useRef, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import Icon from '../../components/ui/Icon';
import { projectRoute, ROUTES } from '../../routes/routePaths';
import { useDashboard } from '../../hooks/useDashboard';

function TrendBadge({ value }) {
  const numeric = Number(value || 0);
  const isUp = numeric >= 0;
  return (
    <span className={`badge rounded-pill ${isUp ? 'text-bg-success' : 'text-bg-danger'}`}>
      <Icon name={isUp ? 'bi-arrow-up-right' : 'bi-arrow-down-right'} className="me-1" />
      {Math.abs(numeric)}%
    </span>
  );
}

function DashboardPage() {
  const navigate = useNavigate();
  const {
    loading,
    error,
    metrics,
    velocitySeries,
    activeSprint,
    teamWorkload,
    projectHealth,
    myTasks,
    activity,
    activityHasMore,
    loadMoreActivity,
    updateTaskStatus,
    actionsState,
    exportReport,
  } = useDashboard();

  const [mounted, setMounted] = useState(false);
  const [notice, setNotice] = useState(null);
  const [actionMenuOpen, setActionMenuOpen] = useState(false);
  const actionMenuRef = useRef(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const nodes = document.querySelectorAll('.sv-kpi-value[data-target]');
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const target = Number(entry.target.getAttribute('data-target') || 0);
          const duration = 900;
          const started = performance.now();
          const start = 0;

          const tick = (now) => {
            const progress = Math.min((now - started) / duration, 1);
            const value = Math.floor(start + (target - start) * progress);
            entry.target.textContent = String(value);
            if (progress < 1) requestAnimationFrame(tick);
          };

          requestAnimationFrame(tick);
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.35 },
    );

    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [loading, metrics]);

  useEffect(() => {
    if (!notice) return undefined;
    const timeout = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(timeout);
  }, [notice]);

  useEffect(() => {
    if (!actionMenuOpen) return undefined;
    const onOutside = (event) => {
      if (!actionMenuRef.current?.contains(event.target)) {
        setActionMenuOpen(false);
      }
    };
    window.addEventListener('mousedown', onOutside);
    return () => window.removeEventListener('mousedown', onOutside);
  }, [actionMenuOpen]);

  const velocityLabel = useMemo(() => {
    if (!velocitySeries?.length) return 'No velocity data';
    const latest = velocitySeries[velocitySeries.length - 1];
    return `Latest sprint velocity: ${latest.value || 0} pts`;
  }, [velocitySeries]);

  const heatmapCells = useMemo(() => {
    const map = new Map();
    (teamWorkload.cells || []).forEach((cell) => {
      map.set(`${cell.r}:${cell.c}`, cell);
    });
    return map;
  }, [teamWorkload.cells]);

  const kpis = [
    { key: 'open', label: 'Open Tasks', value: Number(metrics.openTasks || 0), trend: 12, icon: 'bi-list-check' },
    { key: 'overdue', label: 'Overdue', value: Number(metrics.overdueTasks || 0), trend: -7, icon: 'bi-clock-history' },
    { key: 'closed', label: 'Closed This Week', value: Number(metrics.completedThisWeek || 0), trend: 18, icon: 'bi-check2-circle' },
    { key: 'velocity', label: 'Sprint Velocity', value: Number(metrics.sprintVelocity || 0), trend: 6, icon: 'bi-graph-up-arrow', hint: velocityLabel },
  ];

  async function handleExport(format) {
    try {
      const result = await exportReport(format);
      const blob = result?.blob;
      if (!blob) {
        throw new Error('Empty export file');
      }
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = result?.filename || `salesvision_dashboard.${String(format).toLowerCase()}`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
      setNotice({ tone: 'success', text: `${String(format).toUpperCase()} report downloaded.` });
      setActionMenuOpen(false);
    } catch (errorPayload) {
      setNotice({ tone: 'error', text: errorPayload?.message || 'Unable to export report right now.' });
    }
  }

  if (loading) {
    return (
      <main className="container-fluid px-0 py-4">
        <div className="row g-3">
          {[1, 2, 3, 4].map((item) => (
            <div className="col-12 col-sm-6 col-xl-3" key={item}>
              <div className="sv-card placeholder-glow p-4" style={{ minHeight: 144 }}>
                <span className="placeholder col-8" />
                <span className="placeholder col-6" />
              </div>
            </div>
          ))}
        </div>
      </main>
    );
  }

  if (error) {
    return <p className="text-danger small">{error}</p>;
  }

  return (
    <main className="container-fluid px-0 py-3 py-lg-4 sv-dashboard-page">
      <section className="d-flex flex-wrap justify-content-between align-items-end gap-4 mb-4">
        <div>
          <h1 className="h2 fw-bold mb-1 sv-heading">Dashboard Overview</h1>
          <p className="mb-0" style={{ color: 'var(--color-text-muted)' }}>
            Real-time view of opportunities, workload and execution velocity.
          </p>
        </div>

        <div className="btn-group sv-dashboard-actions" ref={actionMenuRef}>
          <button
            type="button"
            className="btn btn-sm sv-btn-primary d-flex align-items-center gap-2 dropdown-toggle"
            style={{ padding: '0.5rem 1rem', borderRadius: '0.5rem' }}
            aria-label="Open report actions"
            aria-expanded={actionMenuOpen}
            onClick={() => setActionMenuOpen((prev) => !prev)}
            disabled={actionsState.exporting}
          >
            {actionsState.exporting ? (
              <span className="spinner-border spinner-border-sm" aria-hidden="true" />
            ) : (
              <Icon name="bi-download" />
            )}
            Export
          </button>
          <ul className={`dropdown-menu dropdown-menu-end ${actionMenuOpen ? 'show' : ''}`}>
            <li>
              <button type="button" className="dropdown-item" onClick={() => handleExport('pdf')}>
                <Icon name="bi-file-earmark-pdf" className="me-2" />
                Export PDF
              </button>
            </li>
            <li>
              <button type="button" className="dropdown-item" onClick={() => handleExport('csv')}>
                <Icon name="bi-file-earmark-spreadsheet" className="me-2" />
                Export CSV
              </button>
            </li>
          </ul>
        </div>
      </section>

      {notice ? (
        <div className={`alert py-2.5 mb-4 ${notice.tone === 'success' ? 'alert-success' : 'alert-danger'}`} role="status">
          {notice.text}
        </div>
      ) : null}

      <section className="row g-3 mb-4">
        {kpis.map((kpi, idx) => (
          <div className="col-12 col-sm-6 col-xl-3" key={kpi.key}>
            <article className={`sv-card sv-kpi-card sv-kpi-accent p-4 sv-reveal sv-reveal-delay-${Math.min(idx, 3)}`} style={{ borderRadius: '0.75rem' }}>
              <div className="d-flex align-items-center justify-content-between mb-3">
                <span className="d-inline-flex align-items-center justify-content-center rounded-3 sv-kpi-icon-chip">
                  <Icon name={kpi.icon} />
                </span>
                <span className="sv-kpi-trend-wrap">
                  <TrendBadge value={kpi.trend} />
                </span>
              </div>
              <p className="mb-1 small text-uppercase fw-semibold" style={{ color: 'var(--color-text-muted)', letterSpacing: '.07em' }}>
                {kpi.label}
              </p>
              <div className="sv-kpi-value" data-target={kpi.value}>{mounted ? '0' : kpi.value}</div>
              {kpi.hint ? (
                <p className="mb-0 small sv-kpi-foot" style={{ color: 'var(--color-text-muted)' }}>{kpi.hint}</p>
              ) : (
                <p className="mb-0 small sv-kpi-foot opacity-0">placeholder</p>
              )}
            </article>
          </div>
        ))}
      </section>

      <section className="row g-3 mb-4">
        <div className="col-12 col-xl-8">
          <article className="sv-card p-4 sv-reveal" style={{ borderRadius: '0.75rem' }}>
            <div className="d-flex justify-content-between align-items-center mb-4">
              <h2 className="h5 mb-0 sv-heading">
                <Icon name="bi-kanban" className="me-2" />
                Task Overview
              </h2>
              <button type="button" className="btn btn-sm btn-outline-secondary" style={{ padding: '0.35rem 0.85rem', borderRadius: '0.5rem' }} onClick={() => navigate(ROUTES.myTasks)}>
                View All Tasks
              </button>
            </div>
            <div className="row g-2">
              {myTasks.slice(0, 4).map((task) => (
                <div className="col-12 col-md-6" key={task._id || task.id}>
                  <div className="border rounded-3 p-2.5" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface-muted)', transition: 'border-color 200ms ease, transform 200ms ease' }}>
                    <div className="d-flex flex-column gap-2">
                      <div className="d-flex justify-content-between align-items-start gap-2">
                        <p className="mb-0 fw-semibold text-truncate flex-1" style={{ fontSize: '13px' }}>{task.title}</p>
                        <span className="badge rounded-pill" style={{
                          fontSize: '11px',
                          padding: '0.25rem 0.6rem',
                          backgroundColor: task.status === 'completed' ? '#dcfce7' : task.status === 'in_progress' ? '#dbeafe' : task.status === 'in_review' ? '#fef3c7' : '#f1f5f9',
                          color: task.status === 'completed' ? '#166534' : task.status === 'in_progress' ? '#1e40af' : task.status === 'in_review' ? '#92400e' : '#475569'
                        }}>
                          {task.status.replace('_', ' ')}
                        </span>
                      </div>
                      <p className="mb-0 small text-truncate" style={{ color: 'var(--color-text-muted)' }}>{task.projectName || 'Unassigned Project'}</p>
                    </div>
                  </div>
                </div>
              ))}
              {!myTasks.length ? <p className="small mb-0" style={{ color: 'var(--color-text-muted)' }}>No tasks assigned yet.</p> : null}
            </div>
          </article>
        </div>

        <div className="col-12 col-xl-4">
          <article className="sv-card p-4 sv-reveal sv-reveal-delay-1" style={{ minHeight: 264, borderRadius: '0.75rem' }}>
            <h2 className="h5 mb-4 sv-heading">
              <Icon name="bi-lightning-charge" className="me-2" />
              Active Sprint
            </h2>
            {activeSprint ? (
              <>
                <h3 className="h6 fw-semibold">{activeSprint.name}</h3>
                <div className="progress mb-2" role="progressbar" aria-label="Sprint progress" aria-valuenow={activeSprint.done || 0} aria-valuemin="0" aria-valuemax={activeSprint.total || 1}>
                  <div
                    className="progress-bar"
                    style={{ width: `${activeSprint.total ? Math.round((activeSprint.done / activeSprint.total) * 100) : 0}%`, background: 'linear-gradient(90deg,#6c63ff,#1d9e75)' }}
                  />
                </div>
                <p className="small mb-1" style={{ color: 'var(--color-text-muted)' }}>{activeSprint.done}/{activeSprint.total} completed</p>
                <p className="small mb-0" style={{ color: 'var(--color-text-muted)' }}>{activeSprint.daysLeft != null ? `${activeSprint.daysLeft} days left` : 'No date set'}</p>
              </>
            ) : (
              <p className="small mb-0" style={{ color: 'var(--color-text-muted)' }}>No active sprint.</p>
            )}
          </article>
        </div>
      </section>

      <section className="row g-3">
        <div className="col-12 col-xl-7">
          <article className="sv-card p-4 sv-reveal sv-reveal-delay-2" style={{ borderRadius: '0.75rem' }}>
            <div className="d-flex justify-content-between align-items-center mb-4">
              <h2 className="h5 mb-0 sv-heading">
                <Icon name="bi-clock-history" className="me-2" />
                Recent Activity
              </h2>
              {activityHasMore ? <button type="button" className="btn btn-sm btn-link" style={{ borderRadius: '0.5rem' }} onClick={loadMoreActivity}>Load More</button> : null}
            </div>
            <div className="d-flex flex-column gap-2 sv-activity-scroll custom-scrollbar">
              {activity.slice(0, 6).map((item) => (
                <button
                  key={item._id}
                  type="button"
                  onClick={() => {
                    if (item.entity === 'task') navigate(`/tasks/${item.entityId}`);
                    if (item.entity === 'project') navigate(projectRoute('board', item.entityId));
                    if (item.entity === 'lead') navigate(ROUTES.leads);
                  }}
                  className="btn text-start border rounded-3 p-3"
                  style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)', borderRadius: '0.5rem' }}
                >
                  <div className="d-flex justify-content-between gap-3">
                    <div>
                      <p className="mb-1 fw-semibold">{item.actor?.name || 'User'} {String(item.action || 'updated').replaceAll('_', ' ')}</p>
                      <p className="mb-0 small" style={{ color: 'var(--color-text-muted)' }}>{item.message || 'Record updated'}</p>
                    </div>
                    <span className="small" style={{ color: 'var(--color-text-muted)' }}>
                      {item.occurredAt ? formatDistanceToNow(new Date(item.occurredAt), { addSuffix: true }) : 'just now'}
                    </span>
                  </div>
                </button>
              ))}
              {!activity.length ? <p className="small mb-0" style={{ color: 'var(--color-text-muted)' }}>No activity yet.</p> : null}
            </div>
          </article>
        </div>

        <div className="col-12 col-xl-5">
          <article className="sv-card p-4 sv-reveal sv-reveal-delay-3" style={{ borderRadius: '0.75rem' }}>
            <h2 className="h5 mb-4 sv-heading">
              <Icon name="bi-heart-pulse" className="me-2" />
              Project Health
            </h2>
            <div className="d-flex flex-column gap-2">
              {projectHealth.slice(0, 5).map((project) => (
                <button
                  key={project.projectId}
                  type="button"
                  onClick={() => navigate(projectRoute('board', project.projectId))}
                  className="btn text-start border rounded-3 p-3"
                  style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)', borderRadius: '0.5rem' }}
                >
                  <div className="d-flex justify-content-between align-items-center gap-2">
                    <p className="mb-0 fw-semibold text-truncate">{project.name}</p>
                    <span className="badge rounded-pill text-bg-danger">{project.overdueCount} overdue</span>
                  </div>
                  <div className="progress mt-2" role="progressbar" aria-label={`${project.name} completion`}>
                    <div className="progress-bar" style={{ width: `${project.completionPct || 0}%`, background: 'linear-gradient(90deg,#6c63ff,#1d9e75)' }} />
                  </div>
                </button>
              ))}
              {!projectHealth.length ? <p className="small mb-0" style={{ color: 'var(--color-text-muted)' }}>No projects yet.</p> : null}
            </div>
          </article>
        </div>
      </section>

      <section className="sv-card p-4 mt-4 sv-reveal" style={{ borderRadius: '0.75rem' }}>
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h2 className="h5 mb-0 sv-heading">
            <Icon name="bi-grid-1x2" className="me-2" />
            Team Heatmap
          </h2>
          <span className="small" style={{ color: 'var(--color-text-muted)' }}>Last 7 days</span>
        </div>
        <div className="table-responsive">
          <table className="table sv-table align-middle mb-0">
            <thead>
              <tr>
                <th scope="col">Member</th>
                {(teamWorkload.columns || []).map((col) => (
                  <th scope="col" key={col} className="text-center small">{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(teamWorkload.rows || []).map((row, rIdx) => (
                <tr key={row.id}>
                  <td className="fw-semibold">{row.name}</td>
                  {(teamWorkload.columns || []).map((col, cIdx) => {
                    const cell = heatmapCells.get(`${rIdx}:${cIdx}`);
                    const intensity = Number(cell?.intensity || 0);
                    const bg = intensity >= 3 ? '#1d9e75' : intensity === 2 ? '#6c63ff' : intensity === 1 ? '#a89dff' : '#e7ebf8';
                    return <td key={`${row.id}-${col}`} className="text-center"><span className="d-inline-block rounded-2" style={{ width: 22, height: 22, background: bg }} /></td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

export default DashboardPage;
