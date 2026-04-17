import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import Icon from '../ui/Icon';
import { ROUTES } from '../../routes/routePaths';
import { useNotifications } from '../../hooks/useNotifications';
import NotificationDrawer from '../notifications/NotificationDrawer';
import { useAuth } from '../../contexts/AuthContext';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import ThemeModeToggle from '../ui/ThemeModeToggle';

function Topbar({ collapsed = false, onToggleSidebar }) {
  const { items, meta, markRead, markAllRead, remove, loading, error, hasNextPage, loadingMore, loadMore } = useNotifications();
  const { user, logout } = useAuth();
  const { workspaceId, selectedWorkspaceId, workspaces, switchWorkspace, workspacesLoading } = useWorkspace();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const unreadCount = Number(meta?.unreadCount || 0);

  return (
    <>
      <header className={`sv-topbar ${collapsed ? 'is-collapsed' : 'is-expanded'} d-flex align-items-center justify-content-between px-3 px-lg-4`}>
        <div className="d-flex align-items-center gap-3" style={{ maxWidth: 480 }}>
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary sv-focus-ring d-flex align-items-center justify-content-center"
            style={{ width: 38, height: 38, padding: 0, borderRadius: '0.5rem' }}
            onClick={onToggleSidebar}
            aria-label="Toggle sidebar"
          >
            <Icon name="bi-list" className="fs-5" />
            <span className="visually-hidden">Toggle navigation</span>
          </button>
          <div className="input-group input-group-sm">
            <span className="input-group-text bg-transparent border-end-0" style={{ borderRadius: '0.5rem 0 0 0.5rem' }}><Icon name="bi-search" /></span>
            <input type="text" className="form-control border-start-0" style={{ borderRadius: '0 0.5rem 0.5rem 0' }} placeholder="Search tasks or resources..." aria-label="Search" />
          </div>
        </div>

        <div className="d-flex align-items-center gap-2 gap-lg-3">
          <ThemeModeToggle className="sv-topbar-theme-toggle" />
          <select
            value={selectedWorkspaceId || workspaceId || ''}
            onChange={(event) => switchWorkspace(event.target.value)}
            disabled={workspacesLoading || !(workspaces || []).length}
            className="form-select form-select-sm sv-workspace-select"
            style={{ borderRadius: '0.5rem' }}
            aria-label="Switch workspace"
          >
            {(workspaces || []).length ? (
              (workspaces || []).map((workspace) => (
                <option key={workspace.id || workspace._id} value={workspace.id || workspace._id}>
                  {workspace.name}
                </option>
              ))
            ) : (
              <option value="">{workspacesLoading ? 'Loading workspace...' : 'Workspace'}</option>
            )}
          </select>

          <button type="button" className="btn btn-sm btn-outline-secondary position-relative sv-focus-ring d-flex align-items-center justify-content-center" style={{ width: 38, height: 38, padding: 0, borderRadius: '0.5rem' }} onClick={() => setDrawerOpen(true)} aria-label="Open notifications">
            <Icon name="bi-bell" />
            {unreadCount > 0 ? (
              <span className="position-absolute top-0 start-100 translate-middle badge rounded-pill text-bg-danger">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            ) : null}
          </button>

          <NavLink to={ROUTES.settings} className="btn btn-sm btn-outline-secondary sv-focus-ring d-flex align-items-center justify-content-center" style={{ width: 38, height: 38, padding: 0, borderRadius: '0.5rem' }} aria-label="Settings">
            <Icon name="bi-gear" />
          </NavLink>

          <div className="d-flex align-items-center gap-2">
            <div className="dropdown">
              <button className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-2" style={{ padding: '0.35rem 0.75rem', borderRadius: '0.5rem' }} data-bs-toggle="dropdown" aria-expanded="false" aria-label="User menu">
                <img
                  src={user?.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.displayName || 'User')}&background=6c63ff&color=fff`}
                  alt="User"
                  className="rounded-circle"
                  width="32"
                  height="32"
                  loading="lazy"
                />
                <span className="d-none d-lg-inline text-truncate fw-medium" style={{ maxWidth: 120 }}>{user?.displayName || 'User'}</span>
              </button>
              <ul className="dropdown-menu dropdown-menu-end">
                <li><span className="dropdown-item-text small text-muted">{user?.role || 'member'}</span></li>
              </ul>
            </div>
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary sv-focus-ring d-flex align-items-center justify-content-center"
              style={{ width: 38, height: 38, padding: 0, borderRadius: '0.5rem' }}
              onClick={logout}
              aria-label="Logout"
              title="Logout"
            >
              <Icon name="bi-box-arrow-right" />
            </button>
          </div>
        </div>
      </header>

      <NotificationDrawer
        open={drawerOpen}
        items={items}
        loading={loading}
        error={error}
        hasNextPage={hasNextPage}
        loadingMore={loadingMore}
        onClose={() => setDrawerOpen(false)}
        onRead={markRead}
        onReadAll={markAllRead}
        onDelete={remove}
        onLoadMore={loadMore}
      />
    </>
  );
}

export default Topbar;
