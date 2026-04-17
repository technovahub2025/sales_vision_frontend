import { teamsApi } from './index';
import { createCachedAccessor } from './cache';

const readCache = createCachedAccessor('teams');

export async function getTeams(workspaceId, params = {}, signal) {
  const key = [workspaceId, params];
  const cached = readCache.get(key);
  if (cached) return cached;
  const response = await teamsApi.list(workspaceId, params, signal);
  return readCache.set(key, response);
}

export async function getTeam(workspaceId, teamId, signal) {
  const key = [workspaceId, teamId];
  const cached = readCache.get(key);
  if (cached) return cached;
  const response = await teamsApi.get(workspaceId, teamId, signal);
  return readCache.set(key, response);
}

export async function createTeam(workspaceId, payload) {
  readCache.clear();
  return teamsApi.create(workspaceId, payload);
}

export function invalidateTeamsCache() {
  readCache.clear();
}

