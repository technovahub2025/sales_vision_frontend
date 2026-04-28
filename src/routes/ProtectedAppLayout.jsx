import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ROUTES } from './routePaths';

function AuthLoadingScreen() {
  return (
    <div className="grid min-h-screen place-items-center bg-surface p-8 text-on-surface">
      <div className="w-full max-w-md rounded-2xl border border-outline-variant bg-surface-container-lowest p-6 shadow-sm">
        <div className="mb-4 h-4 w-24 animate-pulse rounded bg-surface-container" />
        <div className="mb-2 h-9 animate-pulse rounded bg-surface-container" />
        <div className="mb-2 h-9 animate-pulse rounded bg-surface-container" />
        <div className="h-9 animate-pulse rounded bg-surface-container" />
      </div>
    </div>
  );
}

export default function ProtectedAppLayout() {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <AuthLoadingScreen />;
  }

  if (!isAuthenticated) {
    return <Navigate replace to={ROUTES.login} state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}
