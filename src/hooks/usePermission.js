import { useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { ROLE_RANK, checkPermission, normalizeRole } from '../lib/permissions';

export function usePermission() {
  const { user, memberships } = useAuth();
  const { workspaceId } = useWorkspace();

  const role = useMemo(() => {
    const workspaceRole =
      (memberships || []).find((item) => String(item.workspaceId) === String(workspaceId))?.role || user?.role;
    return normalizeRole(workspaceRole);
  }, [memberships, workspaceId, user?.role]);

  const can = useMemo(
    () => ({
      hasRole: (requiredRole) => ROLE_RANK[role] >= ROLE_RANK[normalizeRole(requiredRole)],
      hasAnyRole: (roles = []) => roles.some((item) => ROLE_RANK[role] >= ROLE_RANK[normalizeRole(item)]),
      can: (resource, action) => checkPermission(resource, action, role),
      role,
    }),
    [role],
  );

  return can;
}
