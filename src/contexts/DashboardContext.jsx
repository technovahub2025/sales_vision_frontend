import { EVENTS } from '../socket/events';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { useSocket } from './SocketContext';
import { toRealtimeEvent } from '../socket/realtime';

const DashboardContext = createContext(null);

export function DashboardProvider({ workspaceId, projectId, children }) {
  const { socket, joinWorkspace, leaveWorkspace, onReconnect } = useSocket();
  const [data, setData] = useState({ kpis: [], risk: {}, priorityRows: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(
    async ({ silent = false } = {}) => {
      if (!workspaceId) {
        return;
      }
      if (!silent) {
        setLoading(true);
      }
      setError('');

      try {
        const result = await api.getDashboard(workspaceId);
        setData(result || { kpis: [], risk: {}, priorityRows: [] });
      } catch (err) {
        if (!silent) {
          setError(err.message);
        }
      } finally {
        if (!silent) {
          setLoading(false);
        }
      }
    },
    [workspaceId],
  );

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!socket || !workspaceId) {
      return undefined;
    }

    const joinPayload = { workspaceId, projectId, modules: ['dashboard', 'activity', 'tasks'] };
    joinWorkspace(joinPayload);

    const onRefresh = (payload) => {
      const safeWorkspaceId = String(payload?.workspaceId || '');
      if (!safeWorkspaceId || safeWorkspaceId === String(workspaceId)) {
        refresh({ silent: true });
      }
    };

    const onRealtime = (raw) => {
      const evt = toRealtimeEvent(raw);
      if (String(evt.workspaceId || '') !== String(workspaceId)) return;
      if (!evt.event) return;
      if (evt.event.startsWith('dashboard:') || evt.event.startsWith('task:') || evt.event.startsWith('activity:')) {
        refresh({ silent: true });
      }
    };

    socket.on(EVENTS.DASHBOARD_REFRESHED, onRefresh);
    socket.on(EVENTS.REALTIME_EVENT, onRealtime);
    const unsubscribeReconnect = onReconnect(() => refresh({ silent: true }));

    return () => {
      leaveWorkspace(joinPayload);
      socket.off(EVENTS.DASHBOARD_REFRESHED, onRefresh);
      socket.off(EVENTS.REALTIME_EVENT, onRealtime);
      unsubscribeReconnect();
    };
  }, [socket, joinWorkspace, leaveWorkspace, workspaceId, projectId, refresh, onReconnect]);

  const value = useMemo(
    () => ({ data, loading, error, refresh }),
    [data, loading, error, refresh],
  );

  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>;
}

export function useDashboardContext() {
  const context = useContext(DashboardContext);
  if (!context) {
    throw new Error('useDashboardContext must be used within DashboardProvider');
  }

  return context;
}
