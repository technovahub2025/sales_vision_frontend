import { EVENTS } from '../socket/events';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { employeesApi } from '../api';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { useSocket } from '../contexts/SocketContext';
import { toRealtimeEvent } from '../socket/realtime';

export function useEmployeeTimeLogs(employeeId, from, to) {
  const { workspaceId } = useWorkspace();
  const { socket, joinWorkspace, leaveWorkspace, onReconnect } = useSocket();
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState({ totalMins: 0, count: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const hydrate = useCallback(async ({ silent = false } = {}) => {
    if (!workspaceId || !employeeId) return;
    if (!silent) {
      setLoading(true);
    }
    setError('');
    try {
      const response = await employeesApi.timeLogs(workspaceId, employeeId, { from, to });
      setItems(response.data || []);
      setSummary({
        totalMins: Number(response.meta?.totalMins || 0),
        count: Number(response.meta?.count || 0),
      });
    } catch (err) {
      if (!silent) {
        setError(err.message || 'Failed to load employee time logs');
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, [workspaceId, employeeId, from, to]);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!socket || !workspaceId || !employeeId) return undefined;
    const joinPayload = { workspaceId, modules: ['timeLogs'] };
    joinWorkspace(joinPayload);
    const refreshSilent = () => hydrate({ silent: true });
    const onRealtime = (raw) => {
      const evt = toRealtimeEvent(raw);
      if (String(evt.workspaceId || '') !== String(workspaceId)) return;
      if (!evt.event) return;
      if (evt.event.startsWith('timeLog:') || evt.event.startsWith('timer:')) {
        refreshSilent();
      }
    };

    socket.on(EVENTS.TIMELOG_CREATED, refreshSilent);
    socket.on(EVENTS.TIMER_STOPPED, refreshSilent);
    socket.on(EVENTS.REALTIME_EVENT, onRealtime);
    const unsubscribeReconnect = onReconnect(refreshSilent);

    return () => {
      leaveWorkspace(joinPayload);
      socket.off(EVENTS.TIMELOG_CREATED, refreshSilent);
      socket.off(EVENTS.TIMER_STOPPED, refreshSilent);
      socket.off(EVENTS.REALTIME_EVENT, onRealtime);
      unsubscribeReconnect();
    };
  }, [socket, workspaceId, employeeId, joinWorkspace, leaveWorkspace, hydrate, onReconnect]);

  return useMemo(
    () => ({
      items,
      summary,
      loading,
      error,
      refresh: hydrate,
    }),
    [items, summary, loading, error, hydrate],
  );
}
