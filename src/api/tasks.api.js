import { tasksApi } from './index';
import { createCachedAccessor } from './cache';

const readCache = createCachedAccessor('tasks');

export async function getTasks(workspaceId, params = {}, signal) {
  const key = [workspaceId, params];
  const cached = readCache.get(key);
  if (cached) return cached;
  const response = await tasksApi.list(workspaceId, params, signal);
  return readCache.set(key, response);
}

export async function getTaskById(workspaceId, taskId, signal) {
  const key = [workspaceId, taskId];
  const cached = readCache.get(key);
  if (cached) return cached;
  const response = await tasksApi.get(workspaceId, taskId, signal);
  return readCache.set(key, response);
}

export async function createTask(workspaceId, payload) {
  readCache.clear();
  return tasksApi.create(workspaceId, payload);
}

export async function updateTask(workspaceId, taskId, payload) {
  readCache.clear();
  return tasksApi.update(workspaceId, taskId, payload);
}

export async function updateTaskStatus(workspaceId, taskId, payload) {
  readCache.clear();
  return tasksApi.updateStatus(workspaceId, taskId, payload);
}

export async function deleteTask(workspaceId, taskId) {
  readCache.clear();
  return tasksApi.remove(workspaceId, taskId);
}

export function invalidateTasksCache() {
  readCache.clear();
}

