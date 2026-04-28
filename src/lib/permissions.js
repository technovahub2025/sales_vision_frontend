export const ROLE_RANK = {
  owner: 4,
  admin: 3,
  member: 2,
  viewer: 1,
};

export const PERMISSION_MATRIX = {
  workspace: {
    delete: ['owner'],
    invite: ['owner', 'admin'],
    manageMembers: ['owner', 'admin'],
    update: ['owner', 'admin'],
    view: ['owner', 'admin', 'member', 'viewer'],
  },
  project: {
    create: ['owner', 'admin'],
    delete: ['owner', 'admin'],
    update: ['owner', 'admin', 'member'],
    view: ['owner', 'admin', 'member', 'viewer'],
  },
  task: {
    create: ['owner', 'admin', 'member'],
    update: ['owner', 'admin', 'member'],
    delete: ['owner', 'admin', 'member'],
    comment: ['owner', 'admin', 'member'],
    view: ['owner', 'admin', 'member', 'viewer'],
  },
  sprint: {
    manage: ['owner', 'admin'],
    view: ['owner', 'admin', 'member', 'viewer'],
  },
  workflow: {
    manage: ['owner', 'admin'],
    view: ['owner', 'admin', 'member', 'viewer'],
  },
  campaign: {
    manage: ['owner', 'admin'],
    view: ['owner', 'admin', 'member'],
  },
  crm: {
    manage: ['owner', 'admin', 'member'],
    view: ['owner', 'admin', 'member'],
  },
  analytics: {
    export: ['owner', 'admin'],
    view: ['owner', 'admin', 'member', 'viewer'],
  },
};

export function normalizeRole(role) {
  const next = String(role || 'viewer').trim().toLowerCase();
  return ROLE_RANK[next] ? next : 'viewer';
}

export function hasRole(role, requiredRole) {
  return ROLE_RANK[normalizeRole(role)] >= ROLE_RANK[normalizeRole(requiredRole)];
}

export function checkPermission(resource, action, role) {
  const allowedRoles = PERMISSION_MATRIX[resource]?.[action];
  if (!Array.isArray(allowedRoles) || !allowedRoles.length) return false;
  return allowedRoles.some((allowedRole) => hasRole(role, allowedRole));
}

export function deniedMessage(role, actionLabel) {
  const safeRole = normalizeRole(role);
  return `${safeRole.charAt(0).toUpperCase()}${safeRole.slice(1)} cannot ${actionLabel}`;
}
