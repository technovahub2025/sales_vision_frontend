import { commentsApi } from './index';
import { createCachedAccessor } from './cache';

const readCache = createCachedAccessor('comments');

export async function getTaskComments(workspaceId, taskId, signal) {
  const key = [workspaceId, 'task', taskId];
  const cached = readCache.get(key);
  if (cached) return cached;
  const response = await commentsApi.listByTask(workspaceId, taskId, signal);
  return readCache.set(key, response);
}

export async function getLeadComments(workspaceId, leadId, signal) {
  const key = [workspaceId, 'lead', leadId];
  const cached = readCache.get(key);
  if (cached) return cached;
  const response = await commentsApi.listByLead(workspaceId, leadId, signal);
  return readCache.set(key, response);
}

export async function createTaskComment(workspaceId, taskId, payload) {
  readCache.clear();
  return commentsApi.createForTask(workspaceId, taskId, payload);
}

export function invalidateCommentsCache() {
  readCache.clear();
}

