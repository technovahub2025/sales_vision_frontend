import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '../components/layout/Sidebar';
import Topbar from '../components/layout/Topbar';
import { useWorkspace } from '../contexts/WorkspaceContext';

function SaasLayout() {
  const { bootstrapStatus, bootstrapError } = useWorkspace();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  if (bootstrapStatus === 'booting') {
    return (
      <div className="grid min-h-screen place-items-center bg-surface p-8 text-on-surface">
        <div className="w-full max-w-xl rounded-2xl border border-outline-variant bg-surface-container-lowest p-6 shadow-sm">
          <div className="mb-4 h-4 w-40 animate-pulse rounded bg-surface-container" />
          <div className="mb-2 h-10 animate-pulse rounded bg-surface-container" />
          <div className="mb-2 h-10 animate-pulse rounded bg-surface-container" />
          <div className="h-10 animate-pulse rounded bg-surface-container" />
        </div>
      </div>
    );
  }

  if (bootstrapStatus === 'error') {
    return (
      <div className="grid min-h-screen place-items-center bg-surface p-8 text-on-surface">
        <div className="w-full max-w-2xl rounded-2xl border border-error/20 bg-surface-container-lowest p-6 shadow-sm">
          <h1 className="text-lg font-semibold text-on-surface">Workspace bootstrap failed</h1>
          <p className="mt-2 text-sm text-on-surface-variant">{bootstrapError || 'Unable to initialize workspace context.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="sv-app-shell">
      <Sidebar collapsed={sidebarCollapsed} setCollapsed={setSidebarCollapsed} />
      <main 
        className="sv-main-content min-h-screen"
        style={{ 
          marginLeft: sidebarCollapsed ? '4rem' : '15rem',
          transition: 'margin-left 0.24s ease-in-out'
        }}
      >
        <Topbar collapsed={sidebarCollapsed} onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)} />
        <div className="px-3 px-md-4 px-xl-5 pb-5 pb-lg-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

export default SaasLayout;
