import { EVENTS } from '../socket/events';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { authApi } from '../api/auth.api';
import { settingsApi, workspacesApi } from '../api';
import { useSocket } from '../contexts/SocketContext';
import { useWorkspace } from './WorkspaceContext';
import { toRealtimeEvent } from '../socket/realtime';

const SettingsContext = createContext(null);

export function SettingsProvider({ workspaceId, children }) {
  const { socket, joinWorkspace, leaveWorkspace, onReconnect } = useSocket();
  const { switchWorkspace, workspaceId: activeWorkspaceId, workspaces: workspaceOptions } = useWorkspace();
  const [profile, setProfile] = useState({});
  const [preferences, setPreferences] = useState({});
  const [sessions, setSessions] = useState([]);
  const [apiKeys, setApiKeys] = useState([]);
  const [auditLog, setAuditLog] = useState([]);
  const [workspaceActivity, setWorkspaceActivity] = useState([]);
  const [workspaces, setWorkspaces] = useState([]);
  const [workspaceBusy, setWorkspaceBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const hasHydratedRef = useRef(false);

  const refresh = useCallback(async (options = {}) => {
    if (!workspaceId) return;
    const isSilentRefresh = Boolean(options.silent) && hasHydratedRef.current;
    if (!isSilentRefresh) {
      setLoading(true);
      setError('');
    }
    try {
      const meRes = await authApi.me();
      const profileData = meRes?.data?.user || {};
      setProfile(profileData);

      const role = String(profileData.role || '').toLowerCase();
      const canSeeAudit = role === 'owner' || role === 'admin';
      const canSeeApiKeys = canSeeAudit;

      const criticalResults = await Promise.allSettled([
        settingsApi.getPreferences(workspaceId),
      ]);

      const [prefRes] = criticalResults.map((result) =>
        result.status === 'fulfilled' ? result.value : null,
      );

      criticalResults.forEach((result) => {
        if (result.status === 'rejected') {
          console.warn('[SettingsContext] partial failure:', result.reason);
        }
      });

      setPreferences(prefRes?.data || {});

      // Unblock the UI once profile + core settings are ready.
      setLoading(false);
      hasHydratedRef.current = true;

      const backgroundResults = await Promise.allSettled([
        workspacesApi.list(),
        authApi.listMeSessions(),
        canSeeApiKeys ? settingsApi.listApiKeys(workspaceId) : Promise.resolve({ data: null }),
        canSeeAudit ? workspacesApi.auditLog(workspaceId, { page: 1, limit: 20 }) : Promise.resolve({ data: [] }),
        workspacesApi.activity(workspaceId, { page: 1, limit: 20 }),
      ]);

      const [workspaceRes, sessionsRes, keysRes, auditRes, activityRes] = backgroundResults.map((result) =>
        result.status === 'fulfilled' ? result.value : null,
      );

      backgroundResults.forEach((result) => {
        if (result.status === 'rejected') {
          console.warn('[SettingsContext] background failure:', result.reason);
        }
      });

      setWorkspaces(workspaceRes?.data || []);
      setSessions(sessionsRes?.data || []);
      setApiKeys(keysRes?.data || []);
      setAuditLog(auditRes?.data || []);
      setWorkspaceActivity(activityRes?.data || []);
    } catch (nextError) {
      if (!isSilentRefresh) {
        setError(nextError.message || 'Failed to load settings');
      }
    } finally {
      if (!isSilentRefresh) {
        setLoading(false);
      }
    }
  }, [workspaceId]);

  useEffect(() => {
    hasHydratedRef.current = false;
  }, [workspaceId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!socket || !workspaceId) return;
    const joinPayload = { workspaceId, modules: ['settings', 'security', 'activity'] };
    joinWorkspace(joinPayload);
    const onUpdate = () => refresh({ silent: true });
    const onRealtime = (raw) => {
      const evt = toRealtimeEvent(raw);
      if (String(evt.workspaceId || '') !== String(workspaceId)) return;
      if (!evt.event) return;
      if (evt.event.startsWith('settings:') || evt.event.startsWith('workspace:') || evt.event.startsWith('member:')) {
        onUpdate();
      }
    };
    socket.on(EVENTS.SETTINGS_UPDATED, onUpdate);
    socket.on(EVENTS.SECURITY_UPDATED, onUpdate);
    socket.on(EVENTS.ACTIVITY_APPENDED, onUpdate);
    socket.on(EVENTS.REALTIME_EVENT, onRealtime);
    const unsubscribeReconnect = onReconnect(() => refresh({ silent: true }));
    return () => {
      leaveWorkspace(joinPayload);
      socket.off(EVENTS.SETTINGS_UPDATED, onUpdate);
      socket.off(EVENTS.SECURITY_UPDATED, onUpdate);
      socket.off(EVENTS.ACTIVITY_APPENDED, onUpdate);
      socket.off(EVENTS.REALTIME_EVENT, onRealtime);
      unsubscribeReconnect();
    };
  }, [socket, workspaceId, joinWorkspace, leaveWorkspace, refresh, onReconnect]);

  const updateProfile = useCallback(async (payload) => {
    const response = await authApi.updateMeProfile(payload);
    const updated = response.data || {};
    setProfile((current) => ({ ...current, ...updated }));
    return updated;
  }, []);

  const updatePreferences = useCallback(
    async (payload) => {
      const response = await settingsApi.updatePreferences(workspaceId, payload);
      setPreferences(response.data || {});
      return response.data;
    },
    [workspaceId],
  );

  const updateNotifications = useCallback(async (preferencesMap) => {
    const response = await authApi.updateMeNotifications({ preferences: preferencesMap });
    const notifications = response?.data?.notifications || {};
    setPreferences((current) => ({ ...current, ...notifications }));
    return notifications;
  }, []);

  const updatePassword = useCallback(async (payload) => {
    const response = await authApi.updateMePassword(payload);
    return response.data;
  }, []);

  const revokeSession = useCallback(async (sessionId) => {
    const previous = sessions;
    setSessions((current) =>
      current.map((item) =>
        String(item.id || item.sessionId || item._id) === String(sessionId)
          ? { ...item, revoked: true, isCurrent: false, revokedAt: new Date().toISOString() }
          : item,
      ),
    );
    try {
      await authApi.revokeMeSession(sessionId);
      return { sessionId, revoked: true };
    } catch (nextError) {
      setSessions(previous);
      throw nextError;
    }
  }, [sessions]);

  const revokeAllOtherSessions = useCallback(async () => {
    const previous = sessions;
    const targetSessionIds = previous
      .filter((item) => !item.isCurrent && !item.revoked)
      .map((item) => String(item.id || item.sessionId || item._id))
      .filter(Boolean);

    if (!targetSessionIds.length) {
      return { revokedCount: 0 };
    }

    setSessions((current) =>
      current.map((item) =>
        item.isCurrent || item.revoked
          ? item
          : { ...item, revoked: true, revokedAt: new Date().toISOString() },
      ),
    );

    try {
      await Promise.all(targetSessionIds.map((sessionId) => authApi.revokeMeSession(sessionId)));
      return { revokedCount: targetSessionIds.length };
    } catch (nextError) {
      setSessions(previous);
      throw nextError;
    }
  }, [sessions]);

  const createWorkspace = useCallback(
    async (payload = {}) => {
      setWorkspaceBusy(true);
      try {
        const response = await workspacesApi.create(payload);
        const created = response?.data || null;
        await refresh({ silent: true });
        const createdId = String(created?._id || created?.id || '');
        if (createdId) {
          switchWorkspace(createdId);
        }
        return created;
      } finally {
        setWorkspaceBusy(false);
      }
    },
    [refresh, switchWorkspace],
  );

  const updateWorkspace = useCallback(
    async (targetWorkspaceId, payload = {}) => {
      setWorkspaceBusy(true);
      try {
        const response = await workspacesApi.update(targetWorkspaceId, payload);
        await refresh({ silent: true });
        return response?.data || null;
      } finally {
        setWorkspaceBusy(false);
      }
    },
    [refresh],
  );

  const deleteWorkspace = useCallback(
    async (targetWorkspaceId) => {
      const targetId = String(targetWorkspaceId || '');
      if (!targetId) return null;
      setWorkspaceBusy(true);
      try {
        await workspacesApi.remove(targetId);
        const listRes = await workspacesApi.list();
        const nextWorkspaces = listRes?.data || [];
        setWorkspaces(nextWorkspaces);

        if (String(activeWorkspaceId) === targetId) {
          const fallback = nextWorkspaces[0];
          const fallbackId = String(fallback?._id || fallback?.id || '');
          if (fallbackId) {
            switchWorkspace(fallbackId);
          }
        }
        await refresh({ silent: true });
        return { deleted: true };
      } finally {
        setWorkspaceBusy(false);
      }
    },
    [activeWorkspaceId, refresh, switchWorkspace],
  );

  const value = useMemo(
    () => ({
      profile,
      preferences,
      sessions,
      apiKeys,
      auditLog,
      workspaceActivity,
      workspaces: workspaces.length ? workspaces : workspaceOptions,
      activeWorkspaceId,
      workspaceBusy,
      loading,
      error,
      refresh,
      updateProfile,
      updatePreferences,
      updateNotifications,
      updatePassword,
      revokeSession,
      revokeAllOtherSessions,
      createWorkspace,
      updateWorkspace,
      deleteWorkspace,
      switchWorkspace,
    }),
    [
      profile,
      preferences,
      sessions,
      apiKeys,
      auditLog,
      workspaceActivity,
      workspaces,
      workspaceOptions,
      activeWorkspaceId,
      workspaceBusy,
      loading,
      error,
      refresh,
      updateProfile,
      updatePreferences,
      updateNotifications,
      updatePassword,
      revokeSession,
      revokeAllOtherSessions,
      createWorkspace,
      updateWorkspace,
      deleteWorkspace,
      switchWorkspace,
    ],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) throw new Error('useSettings must be used within SettingsProvider');
  return context;
}
