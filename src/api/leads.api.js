import { leadsApi } from './index';
import { createCachedAccessor } from './cache';

const readCache = createCachedAccessor('leads');

export async function getLeadPipeline(workspaceId, signal) {
  const key = [workspaceId, 'pipeline'];
  const cached = readCache.get(key);
  if (cached) return cached;
  const response = await leadsApi.pipeline(workspaceId, signal);
  return readCache.set(key, response);
}

export async function getLeads(workspaceId, params = {}, signal) {
  const key = [workspaceId, params];
  const cached = readCache.get(key);
  if (cached) return cached;
  const response = await leadsApi.list(workspaceId, params, signal);
  return readCache.set(key, response);
}

export async function createLead(workspaceId, payload) {
  readCache.clear();
  return leadsApi.create(workspaceId, payload);
}

export async function updateLead(workspaceId, leadId, payload) {
  readCache.clear();
  return leadsApi.update(workspaceId, leadId, payload);
}

export function invalidateLeadsCache() {
  readCache.clear();
}

