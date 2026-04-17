import { dashboardApi } from './index';
import { createCachedAccessor } from './cache';

const readCache = createCachedAccessor('dashboard');

export async function getDashboard(workspaceId, params = {}, signal) {
  const key = [workspaceId, params];
  const cached = readCache.get(key);
  if (cached) return cached;
  const response = await dashboardApi.get(workspaceId, params, signal);
  return readCache.set(key, response);
}

export async function exportDashboardReport(workspaceId, format = 'pdf') {
  readCache.clear();
  return dashboardApi.exportReport(workspaceId, format);
}

export async function createStrategyMeeting(workspaceId) {
  readCache.clear();
  return dashboardApi.strategyMeeting(workspaceId);
}

export function invalidateDashboardCache() {
  readCache.clear();
}

