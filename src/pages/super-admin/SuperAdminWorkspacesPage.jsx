import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Icon from '../../components/ui/Icon';
import { superAdminApi } from '../../api/superAdmin.api';
import { ROUTES } from '../../routes/routePaths';
import {
  AdminKpiCard,
  AdminState,
  HealthBadge,
  SuperAdminPageHeader,
  formatAdminNumber,
} from './SuperAdminShared';
import '../../styles/superadmin.css';

const HEALTH_OPTIONS = [
  ['', 'All health'],
  ['healthy', 'Healthy'],
  ['needs_owner', 'Needs owner'],
  ['overdue_risk', 'Overdue risk'],
  ['inactive', 'Inactive'],
  ['invite_pending', 'Invite pending'],
];

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString();
}

function formatHours(minutes) {
  return `${Math.round(Number(minutes || 0) / 60)}h`;
}

function firstInitial(value) {
  return String(value || '?').slice(0, 1).toUpperCase();
}

function Pagination({ meta, page, setPage }) {
  const pages = Number(meta?.pages || 1);
  return (
    <div className="sv-userdatas-pagination">
      <span>{formatAdminNumber(meta?.total || 0)} workspaces</span>
      <button type="button" className="btn btn-sm btn-outline-secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>Prev</button>
      <span>{page} / {pages}</span>
      <button type="button" className="btn btn-sm btn-outline-secondary" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</button>
    </div>
  );
}

export default function SuperAdminWorkspacesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [health, setHealth] = useState('');
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState(null);
  const [planError, setPlanError] = useState('');

  const updatePlanMutation = useMutation({
    mutationFn: ({ workspaceId, plan }) => superAdminApi.updatePlan(workspaceId, plan),
    onSuccess: (_, { workspaceId, plan }) => {
      setPlanError('');
      setDetail((current) => (current && current.id === workspaceId ? { ...current, plan } : current));
      queryClient.invalidateQueries({ queryKey: ['super-admin', 'workspace-health'] });
    },
    onError: (err) => {
      setPlanError(err?.message || 'Failed to update plan');
    },
  });

  const workspacesQuery = useQuery({
    queryKey: ['super-admin', 'workspace-health', page, search, health],
    queryFn: ({ signal }) => superAdminApi.workspaceHealth({ page, limit: 25, search: search || undefined, health: health || undefined }, signal),
    retry: false,
  });

  const rows = workspacesQuery.data?.data || [];
  const meta = workspacesQuery.data?.meta || {};
  const totals = useMemo(() => rows.reduce(
    (acc, row) => ({
      users: acc.users + Number(row.userCount || 0),
      tasks: acc.tasks + Number(row.taskCount || 0),
      overdue: acc.overdue + Number(row.overdueTasks || 0),
      activeProjects: acc.activeProjects + Number(row.activeProjects || 0),
    }),
    { users: 0, tasks: 0, overdue: 0, activeProjects: 0 },
  ), [rows]);

  function resetPage(setter) {
    return (event) => {
      setter(event.target.value);
      setPage(1);
    };
  }

  return (
    <main className="sv-superadmin-page container-fluid px-3 px-md-4 px-xl-5 pb-5 pb-lg-6">
      <SuperAdminPageHeader
        eyebrow="Workspace Management"
        title="Workspaces"
        badge={`Read-only / ${formatAdminNumber(meta.total || 0)} workspaces`}
        badgeIcon="lock"
      />

      {workspacesQuery.isError ? (
        <div className="sv-userdatas-error sv-admin-inline-alert"><Icon name="error" />Unable to load workspaces. Refresh and try again.</div>
      ) : null}

      <section className="sv-admin-kpi-grid is-compact" aria-label="Workspace page totals">
        <AdminKpiCard icon="group" value={totals.users} label="Users on page" loading={workspacesQuery.isLoading} />
        <AdminKpiCard icon="folder" value={totals.activeProjects} label="Active projects" loading={workspacesQuery.isLoading} />
        <AdminKpiCard icon="task_alt" value={totals.tasks} label="Tasks" loading={workspacesQuery.isLoading} />
        <AdminKpiCard icon="warning" value={totals.overdue} label="Overdue" tone="risk" loading={workspacesQuery.isLoading} />
      </section>

      <section className="sv-userdatas-topbar" aria-label="Workspace filters">
        <label className="sv-userdatas-search">
          <Icon name="search" />
          <input className="form-control" value={search} onChange={resetPage(setSearch)} placeholder="Search workspace or slug..." />
        </label>
        <select className="form-select sv-admin-filter-select" value={health} onChange={resetPage(setHealth)}>
          {HEALTH_OPTIONS.map(([value, label]) => <option key={value || 'all'} value={value}>{label}</option>)}
        </select>
      </section>

      <section className="sv-userdatas-table-card" aria-label="Workspaces">
        <div className="sv-userdatas-table-head">
          <div>
            <h2>Workspace Health</h2>
            <p>Read-only operational view across all task management workspaces.</p>
          </div>
          <span>{workspacesQuery.isLoading ? 'Loading' : `${formatAdminNumber(meta.total || 0)} records`}</span>
        </div>
        <div className="sv-userdatas-table-wrap">
          <table className="sv-userdatas-table sv-admin-workspace-table">
            <thead>
              <tr>
                <th>Workspace</th>
                <th>Owner</th>
                <th>Health</th>
                <th>Users</th>
                <th>Projects</th>
                <th>Tasks</th>
                <th>Last activity</th>
                <th className="sv-userdatas-action-heading">Action</th>
              </tr>
            </thead>
            <tbody>
              {workspacesQuery.isLoading ? <tr><td colSpan="8" className="sv-userdatas-state"><AdminState icon="progress_activity" title="Loading workspaces" text="Checking workspace health signals." /></td></tr> : null}
              {!workspacesQuery.isLoading && !rows.length ? <tr><td colSpan="8" className="sv-userdatas-state"><AdminState icon="business" title="No workspaces found" text="Try changing the search or health filter." /></td></tr> : null}
              {rows.map((row) => (
                <tr key={row.id}>
                  <td><div className="sv-userdatas-two-line"><strong>{row.name}</strong><small>{row.slug}</small></div></td>
                  <td><div className="sv-userdatas-two-line"><strong>{row.owner?.name || '-'}</strong><small>{row.owner?.email || 'No owner'}</small></div></td>
                  <td><div className="sv-admin-badge-row">{row.health.map((badge) => <HealthBadge key={badge} value={badge} />)}</div></td>
                  <td>{formatAdminNumber(row.userCount)} <small className="text-muted">({formatAdminNumber(row.inactiveUsers)} inactive)</small></td>
                  <td>{formatAdminNumber(row.activeProjects)} / {formatAdminNumber(row.projectCount)}</td>
                  <td>{formatAdminNumber(row.openTasks)} open / {formatAdminNumber(row.overdueTasks)} overdue</td>
                  <td>{formatDate(row.lastActivityAt)}</td>
                  <td className="sv-userdatas-action-cell">
                    <button type="button" className="sv-userdatas-action-trigger" aria-label={`View ${row.name}`} onClick={() => setDetail(row)}>
                      <Icon name="visibility" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <Pagination meta={meta} page={page} setPage={setPage} />

      {detail ? (
        <div className="sv-userdatas-drawer-layer" role="presentation">
          <button type="button" className="sv-userdatas-drawer-backdrop" aria-label="Close workspace details" onClick={() => setDetail(null)} />
          <aside className="sv-userdatas-drawer" role="dialog" aria-modal="true" aria-label="Workspace details">
            <header>
              <div className="sv-userdatas-drawer-identity">
                <span className="sv-userdatas-avatar">{firstInitial(detail.name)}</span>
                <div><h3>{detail.name || 'Workspace'}</h3><p>{detail.slug || 'No slug'}</p></div>
              </div>
              <button type="button" className="sv-userdatas-drawer-close" onClick={() => setDetail(null)} aria-label="Close"><Icon name="close" /></button>
            </header>
            <section className="sv-userdatas-drawer-body">
              <div className="sv-userdatas-drawer-meta">
                <div className="sv-userdatas-drawer-meta-item"><Icon name="person" /><span>Owner</span><strong>{detail.owner?.name || 'No owner'}</strong></div>
                <div className="sv-userdatas-drawer-meta-item"><Icon name="schedule" /><span>Timezone</span><strong>{detail.timezone || 'UTC'}</strong></div>
                <div className="sv-userdatas-drawer-meta-item"><Icon name="group" /><span>Users</span><strong>{formatAdminNumber(detail.userCount)}</strong></div>
                <div className="sv-userdatas-drawer-meta-item"><Icon name="timer" /><span>Time</span><strong>{formatHours(detail.totalTimeLoggedMins)}</strong></div>
              </div>
              <div className="sv-userdatas-drawer-row">
                <label><Icon name="health_and_safety" />Health</label>
                <div className="sv-admin-badge-row">{detail.health.map((badge) => <HealthBadge key={badge} value={badge} />)}</div>
              </div>
              <div className="sv-userdatas-drawer-row">
                <label><Icon name="workspace_premium" />Plan</label>
                <div className="d-flex align-items-center gap-2">
                  <select
                    className="form-select form-select-sm"
                    value={String(detail.plan || 'free')}
                    onChange={(event) => {
                      const nextPlan = event.target.value;
                      updatePlanMutation.mutate({ workspaceId: detail.id, plan: nextPlan });
                    }}
                    disabled={updatePlanMutation.isPending}
                  >
                    <option value="free">Free</option>
                    <option value="pro">Pro</option>
                  </select>
                  {updatePlanMutation.isPending ? <small>Saving...</small> : null}
                </div>
              </div>
              {planError ? <p className="text-danger small mb-0">{planError}</p> : null}
              <div className="sv-userdatas-drawer-row">
                <label><Icon name="analytics" />Summary</label>
                <p className="sv-admin-drawer-copy">{formatAdminNumber(detail.activeProjects)} active projects, {formatAdminNumber(detail.openTasks)} open tasks, {formatAdminNumber(detail.overdueTasks)} overdue tasks, and {formatAdminNumber(detail.pendingInvites)} pending invites.</p>
              </div>
            </section>
            <footer>
              <Link className="btn btn-outline-primary" to={`${ROUTES.superAdminUserDatas}?workspaceId=${detail.id}`}>
                <Icon name="group" />View users
              </Link>
            </footer>
          </aside>
        </div>
      ) : null}
    </main>
  );
}
