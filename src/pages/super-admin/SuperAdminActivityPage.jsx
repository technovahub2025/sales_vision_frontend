import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Icon from '../../components/ui/Icon';
import { superAdminApi } from '../../api/superAdmin.api';
import {
  AdminState,
  StatusBadge,
  SuperAdminPageHeader,
  formatAdminDate,
  formatAdminNumber,
} from './SuperAdminShared';
import '../../styles/superadmin.css';

export default function SuperAdminActivityPage() {
  const [workspaceId, setWorkspaceId] = useState('');
  const [module, setModule] = useState('');
  const [action, setAction] = useState('');
  const [page, setPage] = useState(1);

  const workspacesQuery = useQuery({
    queryKey: ['super-admin', 'activity-workspaces'],
    queryFn: ({ signal }) => superAdminApi.workspaces({ page: 1, limit: 100 }, signal),
    retry: false,
  });

  const activityQuery = useQuery({
    queryKey: ['super-admin', 'activity', page, workspaceId, module, action],
    queryFn: ({ signal }) => superAdminApi.activity({
      page,
      limit: 25,
      workspaceId: workspaceId || undefined,
      module: module || undefined,
      action: action || undefined,
    }, signal),
    retry: false,
  });

  const workspaces = workspacesQuery.data?.data || [];
  const rows = activityQuery.data?.data || [];
  const meta = activityQuery.data?.meta || {};
  const pages = Number(meta.pages || 1);

  function resetPage(setter) {
    return (event) => {
      setter(event.target.value);
      setPage(1);
    };
  }

  return (
    <main className="sv-superadmin-page container-fluid px-3 px-md-4 px-xl-5 pb-5 pb-lg-6">
      <SuperAdminPageHeader
        eyebrow="Global Activity"
        title="Activity Logs"
        badge={`Read-only / ${formatAdminNumber(meta.total || 0)} logs`}
        badgeIcon="lock"
      />

      {activityQuery.isError ? (
        <div className="sv-userdatas-error sv-admin-inline-alert"><Icon name="error" />Unable to load activity logs. Refresh and try again.</div>
      ) : null}
      {workspacesQuery.isError ? (
        <div className="sv-userdatas-error sv-admin-inline-alert"><Icon name="warning" />Unable to load workspace filter options.</div>
      ) : null}

      <section className="sv-userdatas-filters is-always-open" aria-label="Activity filters">
        <label>
          <span className="sv-userdatas-field-label"><Icon name="business" />Workspace</span>
          <select className="form-select" value={workspaceId} onChange={resetPage(setWorkspaceId)}>
            <option value="">All workspaces</option>
            {workspacesQuery.isLoading ? <option value="" disabled>Loading workspaces...</option> : null}
            {workspaces.map((workspace) => <option key={workspace.id} value={workspace.id}>{workspace.name}</option>)}
          </select>
        </label>
        <label>
          <span className="sv-userdatas-field-label"><Icon name="category" />Module</span>
          <input className="form-control" value={module} onChange={resetPage(setModule)} placeholder="tasks, projects..." />
        </label>
        <label>
          <span className="sv-userdatas-field-label"><Icon name="bolt" />Action</span>
          <input className="form-control" value={action} onChange={resetPage(setAction)} placeholder="created, updated..." />
        </label>
      </section>

      <section className="sv-userdatas-table-card" aria-label="Activity logs">
        <div className="sv-userdatas-table-head">
          <div><h2>Recent Events</h2><p>Read-only events collected across workspaces.</p></div>
          <span>{activityQuery.isLoading ? 'Loading' : `${formatAdminNumber(meta.total || 0)} records`}</span>
        </div>
        <div className="sv-userdatas-table-wrap">
          <table className="sv-userdatas-table sv-admin-activity-table">
            <thead>
              <tr>
                <th>Event</th>
                <th>Workspace</th>
                <th>Actor</th>
                <th>Module</th>
                <th>Entity</th>
                <th>When</th>
              </tr>
            </thead>
            <tbody>
              {activityQuery.isLoading ? <tr><td colSpan="6" className="sv-userdatas-state"><AdminState icon="progress_activity" title="Loading activity" text="Reading global event logs." /></td></tr> : null}
              {!activityQuery.isLoading && !rows.length ? <tr><td colSpan="6" className="sv-userdatas-state"><AdminState icon="history" title="No activity found" text="Try changing the workspace, module, or action filter." /></td></tr> : null}
              {rows.map((row) => (
                <tr key={row.id}>
                  <td><div className="sv-userdatas-two-line"><strong>{row.message || row.action}</strong><small>{row.action}</small></div></td>
                  <td><div className="sv-userdatas-two-line"><strong>{row.workspace?.name || '-'}</strong><small>{row.workspace?.slug || ''}</small></div></td>
                  <td><div className="sv-userdatas-two-line"><strong>{row.actor?.name || 'System'}</strong><small>{row.actor?.email || ''}</small></div></td>
                  <td><StatusBadge tone="neutral" icon="category">{row.module || '-'}</StatusBadge></td>
                  <td>{row.entity}</td>
                  <td>{formatAdminDate(row.occurredAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="sv-userdatas-pagination">
        <span>{formatAdminNumber(meta.total || 0)} events</span>
        <button type="button" className="btn btn-sm btn-outline-secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>Prev</button>
        <span>{page} / {pages}</span>
        <button type="button" className="btn btn-sm btn-outline-secondary" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</button>
      </div>
    </main>
  );
}
