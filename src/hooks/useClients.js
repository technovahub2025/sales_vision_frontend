import { EVENTS } from '../socket/events';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { clientsApi } from '../api';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { useSocket } from '../contexts/SocketContext';

export function useClients(workspaceIdArg) {
  const { workspaceId: workspaceIdFromContext } = useWorkspace();
  const { socket, joinWorkspace } = useSocket();
  const workspaceId = workspaceIdArg || workspaceIdFromContext;
  const [clients, setClients] = useState([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 20 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const lastQueryRef = useRef({ page: 1, limit: 20, includeArchived: true });
  const refreshTimerRef = useRef(null);

  const list = useCallback(async (params = lastQueryRef.current) => {
    if (!workspaceId) return;
    lastQueryRef.current = { ...lastQueryRef.current, ...params };
    setLoading(true);
    setError('');
    try {
      const response = await clientsApi.list(workspaceId, lastQueryRef.current);
      setClients(response.data || []);
      setMeta({
        total: response.meta?.total || 0,
        page: response.meta?.page || 1,
        limit: response.meta?.limit || 20,
      });
    } catch (err) {
      setError(err.message || 'Failed to load clients');
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    list(lastQueryRef.current);
  }, [list]);

  useEffect(() => {
    if (!socket || !workspaceId) return;
    joinWorkspace({ workspaceId, modules: ['clients'] });
    const schedule = () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = setTimeout(() => list(lastQueryRef.current), 120);
    };
    socket.on(EVENTS.CLIENT_CREATED, schedule);
    socket.on(EVENTS.CLIENT_UPDATED, schedule);
    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      socket.off(EVENTS.CLIENT_CREATED, schedule);
      socket.off(EVENTS.CLIENT_UPDATED, schedule);
    };
  }, [socket, workspaceId, joinWorkspace, list]);

  const createClient = useCallback(async (payload) => {
    if (!workspaceId) return null;
    const response = await clientsApi.create(workspaceId, payload);
    return response.data || null;
  }, [workspaceId]);

  const updateClient = useCallback(async (id, payload) => {
    if (!workspaceId) return null;
    const response = await clientsApi.update(workspaceId, id, payload);
    return response.data || null;
  }, [workspaceId]);

  const getClient = useCallback(async (id) => {
    if (!workspaceId) return null;
    const response = await clientsApi.get(workspaceId, id);
    return response.data || null;
  }, [workspaceId]);

  return useMemo(
    () => ({
      clients,
      meta,
      loading,
      error,
      list,
      createClient,
      updateClient,
      getClient,
    }),
    [clients, meta, loading, error, list, createClient, updateClient, getClient],
  );
}



