import { useMemo, useRef, useState } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import Icon from '../../components/ui/Icon';
import SelectDropdown from '../../components/ui/SelectDropdown';
import { superAdminApi } from '../../api/superAdmin.api';
import { useInfiniteScrollTrigger } from '../../hooks/useInfiniteScrollTrigger';
import {
  AdminState,
  StatusBadge,
  SuperAdminPageHeader,
  formatAdminDate,
  formatAdminNumber,
} from './SuperAdminShared';
import '../../styles/superadmin.css';

function getNextPageParam(lastPage, allPages) {
  const meta = lastPage?.meta || {};
  const page = Number(meta.page) || allPages.length;
  const total = Number(meta.total) || 0;
  const limit = Number(meta.limit) || 100;
  return total > page * limit ? page + 1 : undefined;
}

export default function SuperAdminActivityPage() {
  const [workspaceId, setWorkspaceId] = useState('');
  const [module, setModule] = useState('');
  const [action, setAction] = useState('');
  const listScrollRef = useRef(null);

  const workspacesQuery = useQuery({
    queryKey: ['super-admin', 'activity-workspaces'],
    queryFn: ({ signal }) => superAdminApi.workspaces({ page: 1, limit: 100 }, signal),
    retry: false,
  });

  const activityQuery = useInfiniteQuery({
    queryKey: ['super-admin', 'activity', workspaceId, module, action],
    queryFn: ({ pageParam = 1, signal }) => superAdminApi.activity({
      page: pageParam,
      limit: 100,
      workspaceId: workspaceId || undefined,
      module: module || undefined,
      action: action || undefined,
    }, signal),
    getNextPageParam,
    initialPageParam: 1,
    retry: false,
  });

  const workspaces = workspacesQuery.data?.data || [];
  const rows = useMemo(() => (activityQuery.data?.pages || []).flatMap((pageItem) => pageItem?.data || []), [activityQuery.data?.pages]);
  const meta = activityQuery.data?.pages?.at(-1)?.meta || {};
  const loadMoreRef = useInfiniteScrollTrigger({
    rootRef: listScrollRef,
    onIntersect: () => {
      if (activityQuery.hasNextPage && !activityQuery.isFetchingNextPage) void activityQuery.fetchNextPage();
    },
    disabled: !activityQuery.hasNextPage || activityQuery.isFetchingNextPage,
  });

  function resetList(setter) {
    return (event) => {
      setter(event.target.value);
      listScrollRef.current?.scrollTo({ top: 0 });
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
          <SelectDropdown
            value={workspaceId}
            onChange={(nextValue) => {
              setWorkspaceId(nextValue);
              listScrollRef.current?.scrollTo({ top: 0 });
            }}
            options={[
              { value: '', label: workspacesQuery.isLoading ? 'Loading workspaces...' : 'All workspaces' },
              ...workspaces.map((workspace) => ({ value: workspace.id, label: workspace.name })),
            ]}
            triggerClassName="form-select"
          />
        </label>
        <label>
          <span className="sv-userdatas-field-label"><Icon name="category" />Module</span>
          <input className="form-control" value={module} onChange={resetList(setModule)} placeholder="tasks, projects..." />
        </label>
        <label>
          <span className="sv-userdatas-field-label"><Icon name="bolt" />Action</span>
          <input className="form-control" value={action} onChange={resetList(setAction)} placeholder="created, updated..." />
        </label>
      </section>

      <section className="sv-userdatas-table-card" aria-label="Activity logs">
        <div className="sv-userdatas-table-head">
          <div><h2>Recent Events</h2><p>Read-only events collected across workspaces.</p></div>
          <span>{activityQuery.isLoading ? 'Loading' : `${formatAdminNumber(meta.total || 0)} records`}</span>
        </div>
        <div className="sv-userdatas-table-wrap sv-list-scroll" ref={listScrollRef}>
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
              {!activityQuery.isLoading && rows.length ? (
                <tr>
                  <td colSpan="6" className="sv-list-sentinel-cell">
                    <span ref={loadMoreRef} className="sv-list-sentinel" />
                    {activityQuery.isFetchingNextPage ? 'Loading more activity...' : activityQuery.hasNextPage ? 'Scroll for more' : 'End of list'}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

    </main>
  );
}
