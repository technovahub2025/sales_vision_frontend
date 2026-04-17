import { sprintsApi } from './index';
import { createCachedAccessor } from './cache';

const readCache = createCachedAccessor('sprints');

export async function getSprints(workspaceId, projectId, params = {}, signal) {
  const key = [workspaceId, projectId, params];
  const cached = readCache.get(key);
  if (cached) return cached;
  const response = await sprintsApi.list(workspaceId, projectId, params, signal);
  return readCache.set(key, response);
}

export async function getSprintBoard(workspaceId, sprintId, signal) {
  const key = [workspaceId, sprintId, 'board'];
  const cached = readCache.get(key);
  if (cached) return cached;
  const response = await sprintsApi.board(workspaceId, sprintId, signal);
  return readCache.set(key, response);
}

export function invalidateSprintsCache() {
  readCache.clear();
}

