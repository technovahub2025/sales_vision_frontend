import { employeesApi } from './index';
import { createCachedAccessor } from './cache';

const readCache = createCachedAccessor('employees');

export async function getEmployees(workspaceId, params = {}, signal) {
  const key = [workspaceId, params];
  const cached = readCache.get(key);
  if (cached) return cached;
  const response = await employeesApi.list(workspaceId, params, signal);
  return readCache.set(key, response);
}

export async function getEmployee(workspaceId, employeeId, signal) {
  const key = [workspaceId, employeeId];
  const cached = readCache.get(key);
  if (cached) return cached;
  const response = await employeesApi.get(workspaceId, employeeId, signal);
  return readCache.set(key, response);
}

export async function updateEmployee(workspaceId, employeeId, payload) {
  readCache.clear();
  return employeesApi.update(workspaceId, employeeId, payload);
}

export function invalidateEmployeesCache() {
  readCache.clear();
}

