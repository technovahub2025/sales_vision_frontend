import { useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useWorkspace } from '../contexts/WorkspaceContext';

const ROLE_RANK = {
  owner: 4,
  admin: 3,
  member: 2,
  viewer: 1,
};

function normalizeRole(role) {
  const next = String(role || 'viewer').trim().toLowerCase();
  return ROLE_RANK[next] ? next : 'viewer';
}

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
      role,
    }),
    [role],
  );

  return can;
}

