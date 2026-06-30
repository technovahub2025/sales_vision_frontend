import { useEffect, useMemo, useRef, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Download,
  FileSpreadsheet,
  FileText,
  Gauge,
  HeartPulse,
  KanbanSquare,
  LayoutGrid,
  ListChecks,
  LoaderCircle,
  Zap,
} from 'lucide-react';
import { projectRoute, ROUTES } from '../../routes/routePaths';
import { useDashboard } from '../../hooks/useDashboard';

function TrendBadge({ value }) {
  const numeric = Number(value || 0);
  const isUp = numeric >= 0;
  const TrendIcon = isUp ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={`sv-trend-badge ${isUp ? 'is-up' : 'is-down'}`}>
      <TrendIcon size={13} strokeWidth={2.6} />
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

  const heatmapScale = ['#edf2fb', '#cfe3ff', '#8ccfff', '#41b6ff', '#1d9e75'];

  const kpis = [
    { key: 'open', label: 'Open Tasks', value: Number(metrics.openTasks || 0), trend: 12, icon: ListChecks, tone: 'blue', hint: 'Tasks currently in the pipeline' },
    { key: 'overdue', label: 'Overdue', value: Number(metrics.overdueTasks || 0), trend: -7, icon: Clock3, tone: 'rose', hint: 'Needs attention today' },
    { key: 'closed', label: 'Closed This Week', value: Number(metrics.completedThisWeek || 0), trend: 18, icon: CheckCircle2, tone: 'green', hint: 'Completed in the last 7 days' },
    { key: 'velocity', label: 'Sprint Velocity', value: Number(metrics.sprintVelocity || 0), trend: 6, icon: Gauge, tone: 'teal', hint: velocityLabel },
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
      <section className="sv-dashboard-hero sv-dashboard-hero-shell">
        <div className="sv-dashboard-hero-copy">
          <div className="sv-dashboard-eyebrow">
            <LayoutGrid size={15} />
            Workspace summary
          </div>
          <h1 className="h2 fw-bold mb-1 sv-heading">Dashboard Overview</h1>
          <p className="sv-dashboard-subtitle">
            Real-time view of opportunities, workload and execution velocity.
          </p>
        </div>

        <div className="btn-group sv-dashboard-actions" ref={actionMenuRef}>
          <button
            type="button"
            className="btn btn-sm sv-btn-primary sv-export-trigger"
            aria-label="Open report actions"
            aria-expanded={actionMenuOpen}
            onClick={() => setActionMenuOpen((prev) => !prev)}
            disabled={actionsState.exporting}
          >
            {actionsState.exporting ? (
              <LoaderCircle className="sv-spin" size={16} aria-hidden="true" />
            ) : (
              <Download size={16} />
            )}
            <span>Export</span>
            <ChevronDown className={`sv-export-chevron ${actionMenuOpen ? 'is-open' : ''}`} size={14} />
          </button>
          <ul className={`sv-action-menu ${actionMenuOpen ? 'show' : ''}`}>
            <li>
              <button type="button" className="sv-action-item" onClick={() => handleExport('pdf')}>
                <FileText size={16} />
                Export PDF
              </button>
            </li>
            <li>
              <button type="button" className="sv-action-item" onClick={() => handleExport('excel')}>
                <FileSpreadsheet size={16} />
                Export Excel
              </button>
            </li>
            <li>
              <button type="button" className="sv-action-item" onClick={() => handleExport('csv')}>
                <FileSpreadsheet size={16} />
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
            <article className={`sv-card sv-kpi-card sv-kpi-${kpi.tone} sv-reveal sv-reveal-delay-${Math.min(idx, 3)}`}>
              <div className="sv-kpi-topline">
                <span className="sv-kpi-icon-chip">
                  <kpi.icon size={18} strokeWidth={2.2} />
                </span>
                <TrendBadge value={kpi.trend} />
              </div>
              <div className="sv-kpi-body">
                <p className="sv-kpi-label">{kpi.label}</p>
                <div className="sv-kpi-value" data-target={kpi.value}>{mounted ? '0' : kpi.value}</div>
              </div>
              <p className="sv-kpi-foot">{kpi.hint}</p>
            </article>
          </div>
        ))}
      </section>

      <section className="row g-3 mb-4">
        <div className="col-12 col-xl-8">
          <article className="sv-card p-4 sv-reveal">
            <div className="d-flex justify-content-between align-items-center mb-4">
              <h2 className="h5 mb-0 sv-heading sv-section-title">
                <KanbanSquare size={22} />
                Task Overview
              </h2>
              <button type="button" className="btn btn-sm btn-outline-secondary sv-soft-button" onClick={() => navigate(ROUTES.myTasks)}>
                View All Tasks
                <ArrowRight size={14} />
              </button>
            </div>
            <div className="row g-2">
              {myTasks.slice(0, 4).map((task) => (
                <div className="col-12 col-md-6" key={task._id || task.id}>
                  <div className="sv-task-tile">
                    <div className="d-flex flex-column gap-2">
                      <div className="d-flex justify-content-between align-items-start gap-2">
                        <p className="sv-task-title">{task.title}</p>
                        <span className={`sv-status-chip status-${task.status || 'todo'}`}>
                          {String(task.status || 'todo').replace('_', ' ')}
                        </span>
                      </div>
                      <p className="sv-task-project">{task.projectName || 'Unassigned Project'}</p>
                    </div>
                  </div>
                </div>
              ))}
              {!myTasks.length ? <p className="small mb-0" style={{ color: 'var(--color-text-muted)' }}>No tasks assigned yet.</p> : null}
            </div>
          </article>
        </div>

        <div className="col-12 col-xl-4">
          <article className="sv-card p-4 sv-reveal sv-reveal-delay-1 sv-active-sprint-card">
            <h2 className="h5 mb-4 sv-heading sv-section-title">
              <Zap size={22} />
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
                <p className="sv-muted-text">{activeSprint.done}/{activeSprint.total} completed</p>
                <p className="sv-muted-text mb-0">{activeSprint.daysLeft != null ? `${activeSprint.daysLeft} days left` : 'No date set'}</p>
              </>
            ) : (
              <p className="sv-muted-text mb-0">No active sprint.</p>
            )}
          </article>
        </div>
      </section>

      <section className="row g-3 align-items-stretch">
        <div className="col-12 col-xl-7 d-flex">
          <article className="sv-card sv-dashboard-panel sv-activity-panel sv-reveal sv-reveal-delay-2">
            <div className="sv-panel-header">
              <h2 className="h5 mb-0 sv-heading sv-section-title">
                <Clock3 size={22} />
                Recent Activity
              </h2>
              {activityHasMore ? <button type="button" className="sv-panel-action" onClick={loadMoreActivity}>Load More</button> : null}
            </div>
            <div className="d-flex flex-column gap-2 sv-activity-scroll">
              {activity.slice(0, 6).map((item) => (
                <button
                  key={item._id}
                  type="button"
                  onClick={() => {
                    if (item.entity === 'task') navigate(`/tasks/${item.entityId}`);
                    if (item.entity === 'project') navigate(projectRoute('board', item.entityId));
                    if (item.entity === 'lead') navigate(ROUTES.leads);
                  }}
                  className="sv-activity-item"
                >
                  <div className="d-flex justify-content-between gap-3">
                    <div className="d-flex gap-3 min-w-0">
                      <span className="sv-activity-icon"><Activity size={16} /></span>
                      <div className="min-w-0">
                        <p className="sv-activity-title">{item.actor?.name || 'User'} {String(item.action || 'updated').replaceAll('_', ' ')}</p>
                        <p className="sv-activity-message">{item.message || 'Record updated'}</p>
                      </div>
                    </div>
                    <span className="sv-activity-time">
                      {item.occurredAt ? formatDistanceToNow(new Date(item.occurredAt), { addSuffix: true }) : 'just now'}
                    </span>
                  </div>
                </button>
              ))}
              {!activity.length ? <p className="small mb-0" style={{ color: 'var(--color-text-muted)' }}>No activity yet.</p> : null}
            </div>
          </article>
        </div>

        <div className="col-12 col-xl-5 d-flex">
          <article className="sv-card sv-dashboard-panel sv-health-panel sv-reveal sv-reveal-delay-3">
            <div className="sv-panel-header">
              <h2 className="h5 mb-0 sv-heading sv-section-title">
                <HeartPulse size={22} />
                Project Health
              </h2>
              <span className="sv-panel-count">{projectHealth.length} projects</span>
            </div>
            <div className="d-flex flex-column gap-2 sv-health-scroll">
              {projectHealth.slice(0, 5).map((project) => (
                <button
                  key={project.projectId}
                  type="button"
                  onClick={() => navigate(projectRoute('board', project.projectId))}
                  className="sv-health-item"
                >
                  <div className="d-flex justify-content-between align-items-center gap-2">
                    <p className="sv-health-title">{project.name}</p>
                    <span className="sv-overdue-chip">{project.overdueCount} overdue</span>
                  </div>
                  <div className="progress sv-health-progress" role="progressbar" aria-label={`${project.name} completion`}>
                    <div className="progress-bar" style={{ width: `${project.completionPct || 0}%`, background: 'linear-gradient(90deg,#6c63ff,#1d9e75)' }} />
                  </div>
                </button>
              ))}
              {!projectHealth.length ? <p className="small mb-0" style={{ color: 'var(--color-text-muted)' }}>No projects yet.</p> : null}
            </div>
          </article>
        </div>
      </section>

      <section className="sv-card sv-dashboard-panel sv-heatmap-panel mt-4 sv-reveal">
        <div className="sv-panel-header">
          <h2 className="h5 mb-0 sv-heading sv-section-title">
            <LayoutGrid size={22} />
            Team Heatmap
          </h2>
          <div className="sv-heatmap-header-meta">
            <div className="sv-heatmap-legend" aria-label="Heatmap intensity legend">
              <span className="sv-heatmap-legend-label">Low</span>
              <span className="sv-heatmap-legend-swatches" aria-hidden="true">
                <span className="sv-heatmap-swatch is-low" />
                <span className="sv-heatmap-swatch is-low-mid" />
                <span className="sv-heatmap-swatch is-mid" />
                <span className="sv-heatmap-swatch is-high-mid" />
                <span className="sv-heatmap-swatch is-high" />
              </span>
              <span className="sv-heatmap-legend-label">High intensity</span>
            </div>
            <span className="sv-panel-count">Last 7 days</span>
          </div>
        </div>
        <div className="sv-heatmap-scroll table-responsive">
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
                    const bg = intensity >= 3 ? heatmapScale[4] : intensity === 2 ? heatmapScale[3] : intensity === 1 ? heatmapScale[1] : heatmapScale[0];
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
