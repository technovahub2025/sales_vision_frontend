import { Navigate, useLocation } from 'react-router-dom';
import { usePermission } from '../hooks/usePermission';
import { ROUTES } from './routePaths';

export default function RoleGuard({ allow = [], children }) {
  const { hasAnyRole } = usePermission();
  const location = useLocation();

  if (!hasAnyRole(allow)) {
    return <Navigate replace to={ROUTES.dashboard} state={{ forbidden: true, from: location.pathname }} />;
  }

  return children;
}

