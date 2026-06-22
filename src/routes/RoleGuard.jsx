import { useLocation, useNavigate } from 'react-router-dom';
import { usePermission } from '../hooks/usePermission';
import { ROUTES } from './routePaths';

export default function RoleGuard({ allow = [], children }) {
  const { hasAnyRole } = usePermission();
  const location = useLocation();
  const navigate = useNavigate();

  if (!hasAnyRole(allow)) {
    navigate(ROUTES.dashboard, { replace: true, state: { forbidden: true, from: location.pathname } });
    return null;
  }

  return children;
}

