import { clientsApi } from './index';
import { createCachedAccessor } from './cache';

const readCache = createCachedAccessor('clients');

export async function getClients(workspaceId, params = {}, signal) {
  const key = [workspaceId, params];
  const cached = readCache.get(key);
  if (cached) return cached;
  const response = await clientsApi.list(workspaceId, params, signal);
  return readCache.set(key, response);
}

export async function getClient(workspaceId, clientId, signal) {
  const key = [workspaceId, clientId];
  const cached = readCache.get(key);
  if (cached) return cached;
  const response = await clientsApi.get(workspaceId, clientId, signal);
  return readCache.set(key, response);
}

export async function createClient(workspaceId, payload) {
  readCache.clear();
  return clientsApi.create(workspaceId, payload);
}

export function invalidateClientsCache() {
  readCache.clear();
}

