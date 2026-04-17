import { myTasksApi } from './index';
import { createCachedAccessor } from './cache';

const readCache = createCachedAccessor('my-tasks');

export async function getMyTasks(workspaceId, params = {}, signal) {
  const key = [workspaceId, params];
  const cached = readCache.get(key);
  if (cached) return cached;
  const response = await myTasksApi.list(workspaceId, params, signal);
  return readCache.set(key, response);
}

export async function patchMyTask(workspaceId, taskId, payload) {
  readCache.clear();
  return myTasksApi.patch(workspaceId, taskId, payload);
}

export async function quickCreateMyTask(workspaceId, payload) {
  readCache.clear();
  return myTasksApi.quickCreate(workspaceId, payload);
}

export async function reorderMyTasks(workspaceId, payload) {
  readCache.clear();
  return myTasksApi.reorder(workspaceId, payload);
}

export function invalidateMyTasksCache() {
  readCache.clear();
}

