import { useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Icon from '../../components/ui/Icon';
import { superAdminApi } from '../../api/superAdmin.api';
import { ROUTES } from '../../routes/routePaths';
import { useSocket } from '../../contexts/SocketContext';
import { EVENTS } from '../../socket/events';
import {
  AdminKpiCard,
  AdminState,
  HealthBadge,
  StatusBadge,
  SuperAdminPageHeader,
  formatAdminDate,
} from './SuperAdminShared';
import '../../styles/superadmin.css';

const MODULES = [
  { title: 'Dashboard', text: 'Global health, risk, and recent activity.', icon: 'dashboard', to: ROUTES.superAdmin },
  { title: 'Workspaces', text: 'Workspace counts, owners, tasks, and health.', icon: 'business', to: ROUTES.superAdminWorkspaces },
  { title: 'Users', text: 'All workspace users with filters and role controls.', icon: 'group', to: ROUTES.superAdminUserDatas },
  { title: 'Activity', text: 'Global activity across every workspace.', icon: 'history', to: ROUTES.superAdminActivity },
  { title: 'Security', text: 'Sessions, API keys, invites, and audit events.', icon: 'shield', to: ROUTES.superAdminSecurity },
];

const KPI_CONFIG = [
  ['workspaceCount', 'Workspaces', 'business'],
  ['userCount', 'Users', 'group'],
  ['projectCount', 'Projects', 'folder'],
  ['openTasks', 'Open tasks', 'task_alt'],
  ['overdueTasks', 'Overdue', 'warning'],
  ['pendingInvites', 'Pending invites', 'mail'],
  ['ownerlessWorkspaceCount', 'No owner', 'person_off'],
  ['activityCount', 'Activity logs', 'history'],
];

export default function SuperAdminPage() {
  const queryClient = useQueryClient();
  const { socket, onReconnect } = useSocket();

  const dashboardQuery = useQuery({
    queryKey: ['super-admin', 'dashboard'],
    queryFn: ({ signal }) => superAdminApi.dashboard(signal),
    retry: 1,
    staleTime: 15000,
  });

  const fallbackSummaryQuery = useQuery({
    queryKey: ['super-admin', 'summary'],
    queryFn: () => superAdminApi.summary(),
    enabled: dashboardQuery.isError,
    retry: 1,
  });

  const fallbackHealthQuery = useQuery({
    queryKey: ['super-admin', 'workspace-health', 'dashboard-fallback'],
    queryFn: ({ signal }) => superAdminApi.workspaceHealth({ page: 1, limit: 100 }, signal),
    enabled: dashboardQuery.isError,
    retry: 1,
  });

  const fallbackActivityQuery = useQuery({
    queryKey: ['super-admin', 'activity', 'dashboard-fallback'],
    queryFn: ({ signal }) => superAdminApi.activity({ page: 1, limit: 8 }, signal),
    enabled: dashboardQuery.isError,
    retry: 1,
  });

  useEffect(() => {
    const refreshDashboard = () => {
      void queryClient.invalidateQueries({ queryKey: ['super-admin', 'dashboard'] });
      void queryClient.invalidateQueries({ queryKey: ['super-admin', 'summary'] });
      void queryClient.invalidateQueries({ queryKey: ['super-admin', 'workspace-health'] });
      void queryClient.invalidateQueries({ queryKey: ['super-admin', 'activity'] });
    };

    const cleanupReconnect = onReconnect ? onReconnect(refreshDashboard) : () => {};
    if (!socket) return cleanupReconnect;

    const events = [
      EVENTS.SUPERADMIN_USERS_UPDATED,
      EVENTS.ACTIVITY_APPENDED,
      EVENTS.DASHBOARD_UPDATED,
      EVENTS.DASHBOARD_REFRESHED,
      EVENTS.TASK_CREATED,
      EVENTS.TASK_UPDATED,
      EVENTS.TASK_DELETED,
      EVENTS.PROJECT_UPDATED,
      EVENTS.SECURITY_UPDATED,
    ].filter(Boolean);

    events.forEach((eventName) => socket.on(eventName, refreshDashboard));
    return () => {
      events.forEach((eventName) => socket.off(eventName, refreshDashboard));
      cleanupReconnect();
    };
  }, [socket, onReconnect, queryClient]);

  const data = dashboardQuery.data?.data || {};
  const fallbackRows = fallbackHealthQuery.data?.data || [];
  const fallbackSummary = fallbackSummaryQuery.data?.data || {};
  const fallbackActivityRows = fallbackActivityQuery.data?.data || [];
  const fallbackActivityMeta = fallbackActivityQuery.data?.meta || {};

  const fallbackMetrics = useMemo(() => fallbackRows.reduce(
    (acc, row) => ({
      ...acc,
      projectCount: acc.projectCount + Number(row.projectCount || 0),
      openTasks: acc.openTasks + Number(row.openTasks || 0),
      overdueTasks: acc.overdueTasks + Number(row.overdueTasks || 0),
      pendingInvites: acc.pendingInvites + Number(row.pendingInvites || 0),
    }),
    {
      workspaceCount: fallbackSummary.workspaceCount || fallbackHealthQuery.data?.meta?.total || 0,
      userCount: fallbackSummary.userCount || 0,
      projectCount: 0,
      openTasks: 0,
      overdueTasks: 0,
      pendingInvites: 0,
      ownerlessWorkspaceCount: fallbackSummary.ownerlessWorkspaceCount || 0,
      activityCount: fallbackActivityMeta.total || 0,
    },
  ), [fallbackRows, fallbackSummary, fallbackHealthQuery.data?.meta?.total, fallbackActivityMeta.total]);

  const metrics = dashboardQuery.isError ? fallbackMetrics : (data.metrics || {});
  const riskWorkspaces = dashboardQuery.isError
    ? fallbackRows.filter((item) => !(item.health || []).includes('healthy')).slice(0, 5)
    : (data.riskWorkspaces || []);
  const recentActivity = dashboardQuery.isError ? fallbackActivityRows : (data.recentActivity || []);
  const isLoadingDashboard =
    dashboardQuery.isLoading ||
    (dashboardQuery.isError && (fallbackSummaryQuery.isLoading || fallbackHealthQuery.isLoading || fallbackActivityQuery.isLoading));
  const hasFallbackData = dashboardQuery.isError && (
    Boolean(fallbackRows.length) ||
    Boolean(fallbackActivityRows.length) ||
    Boolean(fallbackSummary.workspaceCount)
  );

  return (
    <main className="sv-superadmin-page container-fluid px-3 px-md-4 px-xl-5 pb-5 pb-lg-6">
      <SuperAdminPageHeader
        eyebrow="Global Admin"
        title="Super Admin Console"
        badge={isLoadingDashboard ? 'Loading overview' : 'Live overview'}
        badgeIcon="monitoring"
        back={false}
      />

      {dashboardQuery.isError && !hasFallbackData ? (
        <div className="sv-userdatas-error sv-admin-inline-alert">
          <Icon name="error" />
          Unable to load dashboard data. Check backend connection and refresh.
        </div>
      ) : null}
      {dashboardQuery.isError && hasFallbackData ? (
        <div className="sv-userdatas-notice sv-admin-inline-alert">
          <Icon name="sync" />
          Dashboard endpoint is unavailable. Showing live fallback data from Super Admin summaries.
        </div>
      ) : null}

      <section className="sv-admin-kpi-grid is-dashboard" aria-label="Global metrics">
        {KPI_CONFIG.map(([key, label, icon]) => (
          <AdminKpiCard
            key={key}
            icon={icon}
            value={metrics[key]}
            label={label}
            loading={isLoadingDashboard}
            tone={key === 'overdueTasks' || key === 'ownerlessWorkspaceCount' ? 'risk' : 'neutral'}
          />
        ))}
      </section>

      <section className="sv-admin-module-grid" aria-label="Super admin modules">
        {MODULES.map((module) => (
          <Link key={module.title} to={module.to} className="sv-admin-module-card text-decoration-none">
            <span className="sv-admin-module-icon">
              <Icon name={module.icon} />
            </span>
            <span>
              <strong>{module.title}</strong>
              <small>{module.text}</small>
            </span>
            <Icon name="arrow_forward" className="sv-admin-module-arrow" />
          </Link>
        ))}
      </section>

      <section className="sv-admin-insight-grid">
        <article className="sv-admin-panel">
          <header>
            <h2>Workspace Risks</h2>
            <Link to={ROUTES.superAdminWorkspaces}>View all</Link>
          </header>
          {riskWorkspaces.length ? (
            <div className="sv-admin-list">
              {riskWorkspaces.map((workspace) => (
                <div key={workspace.id} className="sv-admin-list-row">
                  <span>
                    <strong>{workspace.name}</strong>
                    <small>{workspace.slug}</small>
                  </span>
                  <div className="sv-admin-badge-row">
                    {workspace.health.map((badge) => (
                      <HealthBadge key={badge} value={badge} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <AdminState icon="health_and_safety" title="No risk signals found" text="All visible workspace health checks are clear." />
          )}
        </article>

        <article className="sv-admin-panel">
          <header>
            <h2>Recent Activity</h2>
            <Link to={ROUTES.superAdminActivity}>Open logs</Link>
          </header>
          {recentActivity.length ? (
            <div className="sv-admin-list">
              {recentActivity.map((item) => (
                <div key={item.id} className="sv-admin-list-row">
                  <span>
                    <strong>{item.message || `${item.module} ${item.action}`}</strong>
                    <small>{item.workspace?.name || 'Unknown workspace'} / {formatAdminDate(item.occurredAt)}</small>
                  </span>
                  <StatusBadge tone="neutral" icon="category">{item.module || 'Module'}</StatusBadge>
                </div>
              ))}
            </div>
          ) : (
            <AdminState icon="history" title="No activity yet" text="Global activity events will appear here." />
          )}
        </article>
      </section>
    </main>
  );
}
