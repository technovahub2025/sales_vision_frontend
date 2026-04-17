import { EVENTS } from '../socket/events';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { leadsApi } from '../api';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { useSocket } from '../contexts/SocketContext';
import { toRealtimeEvent } from '../socket/realtime';

export function useLeadPipeline(workspaceIdArg) {
  const { workspaceId: workspaceIdFromContext } = useWorkspace();
  const { socket, joinWorkspace, leaveWorkspace, onReconnect } = useSocket();
  const workspaceId = workspaceIdArg || workspaceIdFromContext;
  const [pipeline, setPipeline] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const hydrate = useCallback(async ({ silent = false } = {}) => {
    if (!workspaceId) return;
    if (!silent) {
      setLoading(true);
    }
    setError('');
    try {
      const response = await leadsApi.pipeline(workspaceId);
      setPipeline(response.data || []);
    } catch (err) {
      if (!silent) {
        setError(err.message || 'Failed to load lead pipeline');
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, [workspaceId]);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!socket || !workspaceId) return undefined;
    const joinPayload = { workspaceId, modules: ['leads'] };
    joinWorkspace(joinPayload);

    const refreshSilent = () => hydrate({ silent: true });
    const onRealtime = (raw) => {
      const evt = toRealtimeEvent(raw);
      if (String(evt.workspaceId || '') !== String(workspaceId)) return;
      if (evt.entity !== 'lead') return;
      refreshSilent();
    };

    socket.on(EVENTS.LEAD_CREATED, refreshSilent);
    socket.on(EVENTS.LEAD_UPDATED, refreshSilent);
    socket.on(EVENTS.LEAD_MOVED, refreshSilent);
    socket.on(EVENTS.LEAD_DELETED, refreshSilent);
    socket.on(EVENTS.REALTIME_EVENT, onRealtime);
    const unsubscribeReconnect = onReconnect(refreshSilent);

    return () => {
      leaveWorkspace(joinPayload);
      socket.off(EVENTS.LEAD_CREATED, refreshSilent);
      socket.off(EVENTS.LEAD_UPDATED, refreshSilent);
      socket.off(EVENTS.LEAD_MOVED, refreshSilent);
      socket.off(EVENTS.LEAD_DELETED, refreshSilent);
      socket.off(EVENTS.REALTIME_EVENT, onRealtime);
      unsubscribeReconnect();
    };
  }, [socket, workspaceId, joinWorkspace, leaveWorkspace, hydrate, onReconnect]);

  const moveLead = useCallback(async (leadId, statusId) => {
    if (!workspaceId) return null;
    const response = await leadsApi.updateStatus(workspaceId, leadId, statusId);
    return response.data || null;
  }, [workspaceId]);

  const createLead = useCallback(async (payload) => {
    if (!workspaceId) return null;
    const response = await leadsApi.create(workspaceId, payload);
    return response.data || null;
  }, [workspaceId]);

  return useMemo(
    () => ({ pipeline, moveLead, createLead, loading, error, refresh: hydrate }),
    [pipeline, moveLead, createLead, loading, error, hydrate],
  );
}
