import { NavLink } from 'react-router-dom';
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { NAV_CONFIG } from '../../config/navConfig';
import { projectsApi } from '../../api';
import { ROUTES, projectRoute } from '../../routes/routePaths';
import Icon from '../ui/Icon';
import { Plus } from 'lucide-react';
import { useMyTasks } from '../../hooks/useMyTasks';
import { useWorkspace } from '../../contexts/WorkspaceContext';

function NavItem({ item, activeAware = true, collapsed = false }) {
  const baseClass = collapsed
    ? 'sv-sidebar-nav-item sv-sidebar-nav-item--collapsed d-flex align-items-center justify-content-center rounded-3 fw-semibold small'
    : 'sv-sidebar-nav-item d-flex align-items-center gap-3 rounded-3 fw-semibold small';
  const title = collapsed ? item.label : undefined;

  if (!activeAware || item.to === '#') {
    return (
      <a href={item.to} className={baseClass} title={title} aria-label={item.label}>
        <Icon name={item.icon} />
        {!collapsed && <span className="sv-sidebar-nav-label flex-grow-1">{item.label}</span>}
        {!collapsed && item.badge ? (
          <span className="badge rounded-pill text-bg-primary sv-sidebar-nav-badge">
            {item.badge}
          </span>
        ) : null}
      </a>
    );
  }

  return (
    <NavLink
      to={item.to}
      end={item.end}
      title={title}
      aria-label={item.label}
      className={({ isActive }) =>
        isActive
          ? `${baseClass} is-active`
          : baseClass
      }
    >
      <Icon name={item.icon} />
      {!collapsed && <span className="sv-sidebar-nav-label flex-grow-1">{item.label}</span>}
      {!collapsed && item.badge ? (
        <span className="badge rounded-pill text-bg-primary sv-sidebar-nav-badge">
          {item.badge}
        </span>
      ) : null}
    </NavLink>
  );
}

function SidebarFrame({ collapsed, children, footer }) {
  const logoLight = `${import.meta.env.BASE_URL}assets/light_logo.jpeg`;
  const logoDark = `${import.meta.env.BASE_URL}assets/dark_logo.jpeg`;
  const logoSecondary = `${import.meta.env.BASE_URL}assets/logo_2.png`;

  return (
    <aside
      className={`sv-sidebar fixed left-0 top-0 z-40 d-flex h-100 flex-column border-end ${collapsed ? 'is-collapsed' : ''}`}
      style={{
        width: collapsed ? '4rem' : '15rem',
      }}
    >
      <div className={`sv-sidebar-header ${collapsed ? 'is-collapsed' : ''}`}>
        <div className="sv-sidebar-brand-stack">
          <img
            src={logoSecondary}
            alt="Technova Hub"
            className={`sv-sidebar-brand-secondary ${collapsed ? 'sv-sidebar-brand-secondary--collapsed' : ''}`}
            loading="eager"
            decoding="async"
          />
          {!collapsed && (
            <div className="sv-sidebar-brand">
              <img src={logoLight} alt="Sales Vision" className="sv-logo sv-logo-light sv-logo-dashboard" loading="eager" decoding="async" />
              <img src={logoDark} alt="Sales Vision" className="sv-logo sv-logo-dark sv-logo-dashboard" loading="eager" decoding="async" />
            </div>
          )}
        </div>
      </div>

      {children}
      {footer}
    </aside>
  );
}

function WorkspaceSidebar({ collapsed = false, setCollapsed }) {
  const { meta } = useMyTasks();
  const { workspaceId, activeWorkspace, workspacesLoading } = useWorkspace();
  const myOpenCount = Number(meta?.openCount || 0);
  const role = String(activeWorkspace?.role || 'member');
  const canCreate = role !== 'viewer';

  const projectsQuery = useQuery({
    queryKey: ['sidebar-projects', workspaceId],
    enabled: Boolean(workspaceId),
    queryFn: () => projectsApi.list(workspaceId, { page: 1, limit: 3, sort: 'created_desc' }).then((res) => res.data || []),
    staleTime: 60 * 1000,
  });

  const primaryItems = useMemo(() => {
    const filtered = NAV_CONFIG.filter((item) => {
      if (item.roles === 'all') return true;
      return Array.isArray(item.roles) ? item.roles.includes(role) : false;
    });

    return filtered.map((item) => {
      if (item.path === ROUTES.myTasks) {
        return { ...item, to: item.path, end: true, badge: myOpenCount > 0 ? String(myOpenCount) : '' };
      }
      return { ...item, to: item.path, end: true };
    });
  }, [role, myOpenCount]);

  const projects = projectsQuery.data || [];

  return (
    <SidebarFrame collapsed={collapsed} setCollapsed={setCollapsed} footer={(
      <div className="sv-sidebar-footer">
        {canCreate ? (
          <NavLink
            to={ROUTES.newTask}
            className={`sv-sidebar-new-task ${collapsed ? 'is-collapsed' : ''} btn sv-btn-primary fw-bold`}
            title="New Task"
            aria-label="New Task"
          >
            <Plus size={18} strokeWidth={2.4} aria-hidden="true" />
            {!collapsed ? <span>New Task</span> : null}
          </NavLink>
        ) : null}
        {!collapsed ? <NavItem item={{ label: 'Support', icon: 'help', to: '#' }} activeAware={false} /> : null}
      </div>
    )}>
      <div className="sv-sidebar-body">
        <nav className="sv-sidebar-nav">
          {primaryItems.map((item) => (
            <NavItem key={item.label} item={item} collapsed={collapsed} />
          ))}
        </nav>

        {!collapsed && (
          <section className="sv-sidebar-projects">
            <div className="sv-sidebar-section-head">
              <span>Projects</span>
              <NavLink to={ROUTES.projects} className="sv-sidebar-section-link">
                View all
              </NavLink>
            </div>
            {projectsQuery.isLoading || workspacesLoading ? (
              <div className="sv-sidebar-project-list is-loading">
                <div className="sv-sidebar-skel" />
                <div className="sv-sidebar-skel" />
                <div className="sv-sidebar-skel" />
              </div>
            ) : (
              <div className="sv-sidebar-project-list">
                {projects.length > 0 ? (
                  projects.map((project) => {
                    const color = project?.metadata?.color || '#94a3b8';
                    return (
                      <div key={project._id} className="sv-sidebar-project-item">
                        <NavLink
                          to={projectRoute('board', project._id)}
                          className="sv-sidebar-project-main"
                        >
                          <span className="sv-sidebar-project-dot" style={{ backgroundColor: color }} />
                          <span className="sv-sidebar-project-name">{project.name}</span>
                        </NavLink>
                        <div className="sv-sidebar-project-actions">
                          <NavLink to={projectRoute('board', project._id)} className="sv-sidebar-project-icon-btn" aria-label={`${project.name} board`}>
                            <Icon name="view_kanban" className="text-[16px]" />
                          </NavLink>
                          <NavLink to={projectRoute('backlog', project._id)} className="sv-sidebar-project-icon-btn" aria-label={`${project.name} backlog`}>
                            <Icon name="list" className="text-[16px]" />
                          </NavLink>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="sv-sidebar-empty-state">
                    No projects yet.
                  </div>
                )}
              </div>
            )}
          </section>
        )}
      </div>

    </SidebarFrame>
  );
}

function SuperAdminSidebar({ collapsed = false, setCollapsed }) {
  const items = [
    { label: 'Dashboard', icon: 'dashboard', to: ROUTES.superAdmin, end: true },
    { label: 'Workspaces', icon: 'business', to: ROUTES.superAdminWorkspaces, end: true },
    { label: 'Users', icon: 'group', to: ROUTES.superAdminUserDatas, end: true },
    { label: 'Activity', icon: 'history', to: ROUTES.superAdminActivity, end: true },
    { label: 'Security', icon: 'shield', to: ROUTES.superAdminSecurity, end: true },
  ];

  return (
    <SidebarFrame collapsed={collapsed} setCollapsed={setCollapsed} footer={(
      <div className="sv-sidebar-footer">
        {!collapsed ? <NavItem item={{ label: 'Support', icon: 'help', to: '#' }} activeAware={false} /> : null}
      </div>
    )}>
      <nav className="sv-sidebar-nav">
        {items.map((item) => (
          <NavItem key={item.label} item={item} collapsed={collapsed} />
        ))}
      </nav>
    </SidebarFrame>
  );
}

function Sidebar({ superAdmin = false, ...props }) {
  if (superAdmin) {
    return <SuperAdminSidebar {...props} />;
  }
  return <WorkspaceSidebar {...props} />;
}

export default Sidebar;
