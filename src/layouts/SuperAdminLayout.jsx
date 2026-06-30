import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import AppFooter from '../components/layout/AppFooter';
import Sidebar from '../components/layout/Sidebar';
import Icon from '../components/ui/Icon';
import ThemeModeToggle from '../components/ui/ThemeModeToggle';
import { useAuth } from '../contexts/AuthContext';

function SuperAdminLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 991.98px)').matches : false,
  );
  const { user, logout } = useAuth();

  useEffect(() => {
    const query = window.matchMedia('(max-width: 991.98px)');
    const syncSidebar = (event) => {
      setSidebarCollapsed(event.matches);
    };
    syncSidebar(query);
    query.addEventListener('change', syncSidebar);
    return () => query.removeEventListener('change', syncSidebar);
  }, []);

  return (
    <div className="sv-app-shell">
      <Sidebar collapsed={sidebarCollapsed} setCollapsed={setSidebarCollapsed} superAdmin />
      <button
        type="button"
        className={`sv-sidebar-backdrop ${sidebarCollapsed ? '' : 'is-open'}`}
        aria-label="Close sidebar"
        onClick={() => setSidebarCollapsed(true)}
      />
      <main
        className={`sv-main-content ${sidebarCollapsed ? 'is-collapsed' : 'is-expanded'} min-h-screen d-flex flex-column`}
      >
        <header className={`sv-topbar ${sidebarCollapsed ? 'is-collapsed' : 'is-expanded'} d-flex align-items-center justify-content-between px-3 px-lg-4`}>
          <div className="d-flex align-items-center gap-3" style={{ maxWidth: 480 }}>
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary sv-focus-ring d-flex align-items-center justify-content-center"
              style={{ width: 38, height: 38, padding: 0, borderRadius: '0.5rem' }}
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              aria-label="Toggle sidebar"
            >
              <Icon name="bi-list" className="fs-5" />
            </button>
            <div>
              <div className="small text-muted">Global console</div>
              <div className="fw-semibold text-on-surface">Super Admin</div>
            </div>
          </div>
          <div className="d-flex align-items-center gap-2 gap-lg-3">
            <ThemeModeToggle className="sv-topbar-theme-toggle" />
            <div className="dropdown">
              <button className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-2" style={{ padding: '0.35rem 0.75rem', borderRadius: '0.5rem' }} data-bs-toggle="dropdown" aria-expanded="false" aria-label="User menu">
                <img
                  src={`https://ui-avatars.com/api/?name=${encodeURIComponent(user?.displayName || 'Super Admin')}&background=6c63ff&color=fff`}
                  alt="User"
                  className="rounded-circle"
                  width="32"
                  height="32"
                  loading="lazy"
                />
                <span className="d-none d-lg-inline text-truncate fw-medium" style={{ maxWidth: 140 }}>{user?.displayName || 'Super Admin'}</span>
              </button>
              <ul className="dropdown-menu dropdown-menu-end">
                <li><span className="dropdown-item-text small text-muted">super_admin</span></li>
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
        </header>
        <div className="flex-grow-1 px-3 px-md-4 px-xl-5 pb-5 pb-lg-6">
          <Outlet />
        </div>
        <AppFooter />
      </main>
    </div>
  );
}

export default SuperAdminLayout;
