import { NavLink } from 'react-router-dom';
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { NAV_CONFIG } from '../../config/navConfig';
import { projectsApi } from '../../api';
import { ROUTES, projectRoute } from '../../routes/routePaths';
import Icon from '../ui/Icon';
import { useMyTasks } from '../../hooks/useMyTasks';
import { useWorkspace } from '../../contexts/WorkspaceContext';

function NavItem({ item, activeAware = true, collapsed = false }) {
  const baseClass = collapsed
    ? 'sv-sidebar-nav-item d-flex align-items-center justify-content-center px-3 py-3 rounded-3 fw-semibold small'
    : 'sv-sidebar-nav-item d-flex align-items-center gap-3 px-3 py-2 rounded-3 fw-semibold small';

  if (!activeAware || item.to === '#') {
    return (
      <a href={item.to} className={baseClass}>
        <Icon name={item.icon} />
        {!collapsed && <span className="flex-grow-1">{item.label}</span>}
        {!collapsed && item.badge ? (
          <span className="badge rounded-pill text-bg-primary">
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
      className={({ isActive }) =>
        isActive
          ? `${baseClass} is-active`
          : baseClass
      }
    >
      <Icon name={item.icon} />
      {!collapsed && <span className="flex-grow-1">{item.label}</span>}
      {!collapsed && item.badge ? (
        <span className="badge rounded-pill text-bg-primary">
          {item.badge}
        </span>
      ) : null}
    </NavLink>
  );
}

function Sidebar({ collapsed = false, setCollapsed }) {
  const logoLight = `${import.meta.env.BASE_URL}assets/light_logo.jpeg`;
  const logoDark = `${import.meta.env.BASE_URL}assets/dark_logo.jpeg`;
  const { meta } = useMyTasks();
  const { workspaceId, activeWorkspace, workspacesLoading } = useWorkspace();
  const myOpenCount = Number(meta?.openCount || 0);
  const role = String(activeWorkspace?.role || 'member');
  const canCreate = role !== 'viewer';

  const projectsQuery = useQuery({
    queryKey: ['sidebar-projects', workspaceId],
    enabled: Boolean(workspaceId),
    queryFn: () => projectsApi.list(workspaceId, { page: 1, limit: 7 }).then((res) => res.data || []),
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
    <aside 
      className="sv-sidebar fixed left-0 top-0 z-40 d-flex h-100 flex-column border-end p-4 pt-5"
      style={{ 
        width: collapsed ? '4rem' : '15rem',
        transition: 'width 0.24s ease-in-out'
      }}
    >
      <div className={`mb-8 px-3 d-flex align-items-center ${collapsed ? 'justify-content-center' : 'justify-content-between'}`}>
        {!collapsed && (
          <div className="mb-2">
            <img src={logoLight} alt="Sales Vision" className="sv-logo sv-logo-light sv-logo-dashboard" />
            <img src={logoDark} alt="Sales Vision" className="sv-logo sv-logo-dark sv-logo-dashboard" />
          </div>
        )}
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          className="btn btn-sm btn-outline-secondary sv-focus-ring d-flex align-items-center justify-content-center"
          style={{ width: 32, height: 32, padding: 0, borderRadius: '0.5rem' }}
          aria-label="Toggle sidebar"
        >
          <Icon name={collapsed ? 'bi-chevron-right' : 'bi-chevron-left'} />
        </button>
      </div>

      <nav className="flex-1 space-y-1 mb-4">
        {primaryItems.map((item) => (
          <NavItem key={item.label} item={item} collapsed={collapsed} />
        ))}
      </nav>

      {!collapsed && (
        <div className="mt-2 px-3">
          <div className="d-flex align-items-center justify-content-between text-xs fw-semibold text-uppercase tracking-widest mb-3" style={{ color: 'var(--color-text-muted)' }}>
            <span>Projects</span>
            <NavLink to={ROUTES.projects} className="small fw-bold" style={{ color: 'var(--color-accent)' }}>
              View all
            </NavLink>
          </div>
          {projectsQuery.isLoading || workspacesLoading ? (
            <div className="space-y-2">
              <div className="h-10 animate-pulse rounded-lg" style={{ background: 'var(--color-border)' }} />
              <div className="h-10 animate-pulse rounded-lg" style={{ background: 'var(--color-border)' }} />
              <div className="h-10 animate-pulse rounded-lg" style={{ background: 'var(--color-border)' }} />
            </div>
          ) : (
            <div className="space-y-2">
              {projects.length > 0 ? (
                projects.map((project) => {
                  const color = project?.metadata?.color || '#94a3b8';
                  return (
                    <div key={project._id} className="d-flex align-items-center justify-content-between rounded-3 border px-3 py-2.5 sv-sidebar-project-item">
                      <NavLink
                        to={projectRoute('board', project._id)}
                        className="d-flex min-w-0 align-items-center gap-2 text-start flex-grow-1"
                      >
                        <span className="rounded-full" style={{ width: 10, height: 10, backgroundColor: color }} />
                        <span className="truncate text-xs fw-semibold" style={{ fontSize: '0.85rem' }}>{project.name}</span>
                      </NavLink>
                      <div className="d-flex align-items-center gap-2 text-secondary">
                        <NavLink to={projectRoute('board', project._id)} className="hover-opacity-75">
                          <Icon name="view_kanban" className="text-[16px]" />
                        </NavLink>
                        <NavLink to={projectRoute('backlog', project._id)} className="hover-opacity-75">
                          <Icon name="list" className="text-[16px]" />
                        </NavLink>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="rounded-3 border border-dashed px-3 py-3 small" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}>
                  No projects yet.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {!collapsed && canCreate ? (
        <NavLink to={ROUTES.newTask} className="mx-3 mt-4 rounded-3 btn sv-btn-primary fw-bold py-2.5">
          New Task
        </NavLink>
      ) : null}

      {!collapsed && (
        <div className="mt-auto space-y-1 border-top pt-4 px-3">
          <NavItem item={{ label: 'Support', icon: 'help', to: '#' }} activeAware={false} />
        </div>
      )}
    </aside>
  );
}

export default Sidebar;
