import { notificationsApi } from './index';
import { createCachedAccessor } from './cache';

const readCache = createCachedAccessor('notifications');

export async function getNotifications(workspaceId, params = {}, signal) {
  const key = [workspaceId, params];
  const cached = readCache.get(key);
  if (cached) return cached;
  const response = await notificationsApi.list(workspaceId, params, signal);
  return readCache.set(key, response);
}

export async function markNotificationRead(workspaceId, notificationId, payload = {}) {
  readCache.clear();
  return notificationsApi.markRead(workspaceId, notificationId, payload);
}

export async function markAllNotificationsRead(workspaceId, payload = {}) {
  readCache.clear();
  return notificationsApi.markAllRead(workspaceId, payload);
}

export async function deleteNotification(workspaceId, notificationId) {
  readCache.clear();
  return notificationsApi.remove(workspaceId, notificationId);
}

export function invalidateNotificationsCache() {
  readCache.clear();
}

