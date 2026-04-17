import { projectsApi } from './index';
import { createCachedAccessor } from './cache';

const readCache = createCachedAccessor('projects');

export async function getProjects(workspaceId, params = {}, signal) {
  const key = [workspaceId, params];
  const cached = readCache.get(key);
  if (cached) return cached;
  const response = await projectsApi.list(workspaceId, params, signal);
  return readCache.set(key, response);
}

export async function getProjectBoard(workspaceId, projectId, params = {}, signal) {
  const key = [workspaceId, projectId, 'board', params];
  const cached = readCache.get(key);
  if (cached) return cached;
  const response = await projectsApi.board(workspaceId, projectId, params, signal);
  return readCache.set(key, response);
}

export async function getProjectOverview(workspaceId, projectId, signal) {
  const key = [workspaceId, projectId, 'overview'];
  const cached = readCache.get(key);
  if (cached) return cached;
  const response = await projectsApi.overview(workspaceId, projectId, signal);
  return readCache.set(key, response);
}

export function invalidateProjectsCache() {
  readCache.clear();
}

