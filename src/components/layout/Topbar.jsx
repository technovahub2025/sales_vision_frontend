import { useEffect, useMemo, useRef, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Bell, BriefcaseBusiness, Check, ChevronDown, LogOut, Menu, Search, Settings, X } from 'lucide-react';
import { ROUTES } from '../../routes/routePaths';
import { useNotifications } from '../../hooks/useNotifications';
import NotificationDrawer from '../notifications/NotificationDrawer';
import { useAuth } from '../../contexts/AuthContext';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import ThemeModeToggle from '../ui/ThemeModeToggle';
import { usePermission } from '../../hooks/usePermission';

function Topbar({ collapsed = false, onToggleSidebar }) {
  const { items, meta, markRead, markAllRead, remove, loading, error, hasNextPage, loadingMore, loadMore } = useNotifications();
  const { user, logout } = useAuth();
  const { workspaceId, selectedWorkspaceId, workspaces, switchWorkspace, workspacesLoading } = useWorkspace();
  const { role } = usePermission();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false);
  const [workspaceQuery, setWorkspaceQuery] = useState('');
  const workspaceMenuRef = useRef(null);
  const unreadCount = Number(meta?.unreadCount || 0);
  const workspaceOptions = useMemo(() => workspaces || [], [workspaces]);
  const activeWorkspaceId = selectedWorkspaceId || workspaceId || '';
  const activeWorkspace = useMemo(
    () => workspaceOptions.find((workspace) => String(workspace.id || workspace._id) === String(activeWorkspaceId)),
    [activeWorkspaceId, workspaceOptions],
  );
  const workspaceDisabled = workspacesLoading || !workspaceOptions.length;
  const filteredWorkspaces = useMemo(() => {
    const query = workspaceQuery.trim().toLowerCase();
    const base = workspaceOptions;
    const active = base.find((workspace) => String(workspace.id || workspace._id) === String(activeWorkspaceId)) || null;
    const rest = base.filter((workspace) => String(workspace.id || workspace._id) !== String(activeWorkspaceId));
    const ordered = active ? [active, ...rest] : base;
    if (!query) return ordered;
    return ordered.filter((workspace) => String(workspace.name || '').toLowerCase().includes(query));
  }, [activeWorkspaceId, workspaceOptions, workspaceQuery]);

  useEffect(() => {
    if (!workspaceMenuOpen) return undefined;
    const onOutside = (event) => {
      if (!workspaceMenuRef.current?.contains(event.target)) {
        setWorkspaceMenuOpen(false);
      }
    };
    window.addEventListener('mousedown', onOutside);
    return () => window.removeEventListener('mousedown', onOutside);
  }, [workspaceMenuOpen]);

  function handleWorkspaceSelect(nextWorkspaceId) {
    switchWorkspace(nextWorkspaceId);
    setWorkspaceMenuOpen(false);
  }

  function handleWorkspaceToggle() {
    setWorkspaceMenuOpen((prev) => {
      const next = !prev;
      if (!next) setWorkspaceQuery('');
      return next;
    });
  }

  return (
    <>
      <header className={`sv-topbar ${collapsed ? 'is-collapsed' : 'is-expanded'}`}>
        <div className="sv-topbar-shell px-3 px-lg-4">
        <div className="sv-topbar-group sv-topbar-group--left">
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary sv-focus-ring sv-topbar-icon-btn sv-topbar-menu-btn d-flex align-items-center justify-content-center"
            onClick={onToggleSidebar}
            aria-label="Toggle sidebar"
          >
          <Menu size={20} strokeWidth={2.4} />
          <span className="visually-hidden">Toggle navigation</span>
        </button>
          <div className="sv-topbar-search">
            <span className="sv-topbar-search-icon"><Search size={16} /></span>
            <input type="text" className="sv-topbar-search-input" placeholder="Search tasks or resources..." aria-label="Search" />
          </div>
        </div>

        <div className="sv-topbar-group sv-topbar-group--right">
          <ThemeModeToggle className="sv-topbar-theme-toggle" />
          <div className="sv-workspace-dropdown" ref={workspaceMenuRef}>
            <button
              type="button"
              className="sv-workspace-trigger sv-focus-ring"
              onClick={handleWorkspaceToggle}
              disabled={workspaceDisabled}
              aria-label="Switch workspace"
              aria-haspopup="listbox"
              aria-expanded={workspaceMenuOpen}
            >
              <BriefcaseBusiness size={15} />
              <span className="sv-workspace-trigger-text">
                {activeWorkspace?.name || (workspacesLoading ? 'Loading...' : 'Workspace')}
              </span>
              <ChevronDown className={workspaceMenuOpen ? 'is-open' : ''} size={15} />
            </button>
            <div className={`sv-workspace-menu ${workspaceMenuOpen ? 'show' : ''}`} role="listbox" aria-label="Workspaces">
              <div className="sv-workspace-menu-header">
                <div className="sv-workspace-menu-title-row">
                  <span className="sv-workspace-menu-title">Workspaces</span>
                  <span className="sv-workspace-menu-count">{filteredWorkspaces.length}/{workspaceOptions.length}</span>
                </div>
                <div className="sv-workspace-menu-search">
                  <Search size={14} />
                  <input
                    type="text"
                    value={workspaceQuery}
                    onChange={(event) => setWorkspaceQuery(event.target.value)}
                    placeholder="Filter workspaces"
                    aria-label="Filter workspaces"
                  />
                  {workspaceQuery ? (
                    <button type="button" className="sv-workspace-menu-clear" onClick={() => setWorkspaceQuery('')} aria-label="Clear filter">
                      <X size={13} />
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="sv-workspace-menu-list">
                {filteredWorkspaces.length ? filteredWorkspaces.map((workspace) => {
                  const optionId = workspace.id || workspace._id;
                  const selected = String(optionId) === String(activeWorkspaceId);
                  return (
                    <button
                      type="button"
                      key={optionId}
                      role="option"
                      aria-selected={selected}
                      className={`sv-workspace-option ${selected ? 'is-selected' : ''}`}
                      onClick={() => handleWorkspaceSelect(optionId)}
                    >
                      <span className="sv-workspace-option-mark">{selected ? <Check size={14} /> : null}</span>
                      <span className="sv-workspace-option-name text-truncate">{workspace.name}</span>
                    </button>
                  );
                }) : (
                  <div className="sv-workspace-empty">No matching workspace.</div>
                )}
              </div>
            </div>
          </div>

          <button type="button" className="btn btn-sm btn-outline-secondary position-relative sv-focus-ring sv-topbar-icon-btn d-flex align-items-center justify-content-center" onClick={() => setDrawerOpen(true)} aria-label="Open notifications">
            <Bell size={17} />
            {unreadCount > 0 ? (
              <span className="position-absolute top-0 start-100 translate-middle badge rounded-pill text-bg-danger">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            ) : null}
          </button>

          <NavLink to={ROUTES.settings} className="btn btn-sm btn-outline-secondary sv-focus-ring sv-topbar-icon-btn d-flex align-items-center justify-content-center" aria-label="Settings">
            <Settings size={17} />
          </NavLink>

          <div className="d-flex align-items-center gap-2">
            <div className="dropdown">
              <button className="btn btn-sm btn-outline-secondary sv-topbar-user-btn d-flex align-items-center gap-2" data-bs-toggle="dropdown" aria-expanded="false" aria-label="User menu">
                <img
                  src={user?.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.displayName || 'User')}&background=6c63ff&color=fff`}
                  alt="User"
                  className="rounded-circle"
                  width="32"
                  height="32"
                  loading="lazy"
                />
                <span className="d-none d-lg-inline text-truncate fw-medium sv-topbar-user-name">{user?.displayName || 'User'}</span>
              </button>
              <ul className="dropdown-menu dropdown-menu-end">
                <li><span className="dropdown-item-text small text-muted text-capitalize">{role}</span></li>
              </ul>
            </div>
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary sv-focus-ring sv-topbar-icon-btn d-flex align-items-center justify-content-center"
              onClick={logout}
              aria-label="Logout"
              title="Logout"
            >
              <LogOut size={17} />
            </button>
          </div>
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
