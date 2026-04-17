import { tasksApi, employeesApi, projectsApi } from './index';
import { createCachedAccessor } from './cache';

const readCache = createCachedAccessor('time-logs');

export async function getTaskTimeLogs(workspaceId, taskId, signal) {
  const key = [workspaceId, 'task', taskId];
  const cached = readCache.get(key);
  if (cached) return cached;
  const response = await tasksApi.listTimeLogs(workspaceId, taskId, undefined, signal);
  return readCache.set(key, response);
}

export async function getEmployeeTimeLogs(workspaceId, employeeId, params = {}, signal) {
  const key = [workspaceId, 'employee', employeeId, params];
  const cached = readCache.get(key);
  if (cached) return cached;
  const response = await employeesApi.timeLogs(workspaceId, employeeId, params, signal);
  return readCache.set(key, response);
}

export async function getProjectTimeLogs(workspaceId, projectId, params = {}, signal) {
  const key = [workspaceId, 'project', projectId, params];
  const cached = readCache.get(key);
  if (cached) return cached;
  const response = await projectsApi.timeLogs(workspaceId, projectId, params, signal);
  return readCache.set(key, response);
}

export function invalidateTimeLogsCache() {
  readCache.clear();
}

