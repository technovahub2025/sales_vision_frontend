import { SUPER_ADMIN_ACCESS_TOKEN_STORAGE_KEY, apiRequest } from './axiosClient';

export const SUPER_ADMIN_TOKEN_KEY = SUPER_ADMIN_ACCESS_TOKEN_STORAGE_KEY;

export const superAdminApi = {
  me: () => apiRequest({ method: 'get', url: '/v1/super-admin/me', dedupeKey: 'super-admin:me' }),
  summary: () => apiRequest({ method: 'get', url: '/v1/super-admin/summary', dedupeKey: 'super-admin:summary' }),
  dashboard: (signal) =>
    apiRequest({ method: 'get', url: '/v1/super-admin/dashboard', signal, dedupeKey: 'super-admin:dashboard' }),
  workspaces: (params, signal) =>
    apiRequest({ method: 'get', url: '/v1/super-admin/workspaces', params, signal }),
  workspaceHealth: (params, signal) =>
    apiRequest({ method: 'get', url: '/v1/super-admin/workspace-health', params, signal }),
  activity: (params, signal) =>
    apiRequest({ method: 'get', url: '/v1/super-admin/activity', params, signal }),
  security: (params, signal) =>
    apiRequest({ method: 'get', url: '/v1/super-admin/security', params, signal }),
  allUsers: (params, signal) =>
    apiRequest({ method: 'get', url: '/v1/super-admin/users', params, signal }),
  users: (workspaceId, params, signal) =>
    apiRequest({ method: 'get', url: `/v1/super-admin/workspaces/${workspaceId}/users`, params, signal }),
  updateRole: (workspaceId, userId, role) =>
    apiRequest({
      method: 'patch',
      url: `/v1/super-admin/workspaces/${workspaceId}/users/${userId}/role`,
      data: { role },
    }),
  updatePlan: (workspaceId, plan) =>
    apiRequest({
      method: 'patch',
      url: `/v1/super-admin/workspaces/${workspaceId}/plan`,
      data: { plan },
    }),
  removeUser: (workspaceId, userId) =>
    apiRequest({
      method: 'delete',
      url: `/v1/super-admin/workspaces/${workspaceId}/users/${userId}`,
    }),
  bulkRemoveUsers: (users) =>
    apiRequest({
      method: 'post',
      url: '/v1/super-admin/users/bulk-remove',
      data: { users },
    }),
};
