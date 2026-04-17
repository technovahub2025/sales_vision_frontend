import { EVENTS } from '../socket/events';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { employeesApi } from '../api';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { useSocket } from '../contexts/SocketContext';
import { toRealtimeEvent } from '../socket/realtime';

export function useEmployeeProfile(employeeId) {
  const { workspaceId } = useWorkspace();
  const { socket, joinWorkspace, leaveWorkspace, onReconnect } = useSocket();
  const [profile, setProfile] = useState(null);
  const [performance, setPerformance] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const hydrate = useCallback(async ({ silent = false } = {}) => {
    if (!workspaceId || !employeeId) return;
    if (!silent) {
      setLoading(true);
    }
    setError('');
    try {
      const [profileRes, perfRes, timelineRes] = await Promise.all([
        employeesApi.get(workspaceId, employeeId),
        employeesApi.performance(workspaceId, employeeId),
        employeesApi.timeline(workspaceId, employeeId, { page: 1, limit: 20 }),
      ]);
      setProfile(profileRes.data || null);
      setPerformance(perfRes.data || null);
      setTimeline(timelineRes.data || []);
    } catch (err) {
      if (!silent) {
        setError(err.message || 'Failed to load employee profile');
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, [workspaceId, employeeId]);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!socket || !workspaceId || !employeeId) return undefined;
    const joinPayload = { workspaceId, modules: ['employees', 'tasks', 'timeLogs', 'activity'] };
    joinWorkspace(joinPayload);

    const refreshSilent = () => hydrate({ silent: true });
    const onRealtime = (raw) => {
      const evt = toRealtimeEvent(raw);
      if (String(evt.workspaceId || '') !== String(workspaceId)) return;
      if (!evt.event) return;
      if (evt.event.startsWith('employee:') || evt.event.startsWith('task:') || evt.event.startsWith('timeLog:') || evt.event.startsWith('activity:')) {
        refreshSilent();
      }
    };

    socket.on(EVENTS.EMPLOYEE_UPDATED, refreshSilent);
    socket.on(EVENTS.TASK_UPDATED, refreshSilent);
    socket.on(EVENTS.TIMELOG_CREATED, refreshSilent);
    socket.on(EVENTS.ACTIVITY_APPENDED, refreshSilent);
    socket.on(EVENTS.REALTIME_EVENT, onRealtime);
    const unsubscribeReconnect = onReconnect(refreshSilent);

    return () => {
      leaveWorkspace(joinPayload);
      socket.off(EVENTS.EMPLOYEE_UPDATED, refreshSilent);
      socket.off(EVENTS.TASK_UPDATED, refreshSilent);
      socket.off(EVENTS.TIMELOG_CREATED, refreshSilent);
      socket.off(EVENTS.ACTIVITY_APPENDED, refreshSilent);
      socket.off(EVENTS.REALTIME_EVENT, onRealtime);
      unsubscribeReconnect();
    };
  }, [socket, workspaceId, employeeId, joinWorkspace, leaveWorkspace, hydrate, onReconnect]);

  return useMemo(
    () => ({
      profile,
      performance,
      timeline,
      loading,
      error,
      refresh: hydrate,
    }),
    [profile, performance, timeline, loading, error, hydrate],
  );
}
