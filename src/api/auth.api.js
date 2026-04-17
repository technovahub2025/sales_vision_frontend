import { apiRequest } from './axiosClient';

export const authApi = {
  me: () => apiRequest({ method: 'get', url: '/v1/auth/me', dedupeKey: 'auth:me' }),
  workspaceDiagnostics: () => apiRequest({ method: 'get', url: '/v1/auth/me/workspace-diagnostics' }),
  updateMeProfile: (data) => apiRequest({ method: 'patch', url: '/v1/auth/me/profile', data }),
  updateMePassword: (data) => apiRequest({ method: 'patch', url: '/v1/auth/me/password', data }),
  updateMeNotifications: (data) => apiRequest({ method: 'patch', url: '/v1/auth/me/notifications', data }),
  listMeSessions: () => apiRequest({ method: 'get', url: '/v1/auth/me/sessions' }),
  revokeMeSession: (sessionId) => apiRequest({ method: 'delete', url: `/v1/auth/me/sessions/${sessionId}` }),
  login: (data) => apiRequest({ method: 'post', url: '/v1/auth/login', data, dedupeKey: 'auth:login' }),
  register: (data) => apiRequest({ method: 'post', url: '/v1/auth/register', data }),
  getInvite: (token) => apiRequest({ method: 'get', url: `/v1/auth/invite/${token}`, dedupeKey: `auth:invite:${token}` }),
  acceptInvite: (data) => apiRequest({ method: 'post', url: '/v1/auth/invite/accept', data }),
  logout: () => apiRequest({ method: 'post', url: '/v1/auth/logout', data: {} }),
  forgotPassword: (data) => apiRequest({ method: 'post', url: '/v1/auth/forgot-password', data }),
  resetPassword: (data) => apiRequest({ method: 'post', url: '/v1/auth/reset-password', data }),
};
