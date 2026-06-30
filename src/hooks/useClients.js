import { EVENTS } from '../socket/events';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { clientsApi } from '../api';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { useSocket } from '../contexts/SocketContext';
import { compareByRecencyDesc } from '../lib/listSort';

function mergeClientPages(current, next, replace = false) {
  const merged = replace ? [] : [...current];
  const seen = new Set(merged.map((item) => String(item?._id || item?.id || '')));
  (next || []).forEach((item) => {
    const id = String(item?._id || item?.id || '');
    if (!id || seen.has(id)) return;
    seen.add(id);
    merged.push(item);
  });
  return merged.sort(compareByRecencyDesc);
}

export function useClients(workspaceIdArg) {
  const { workspaceId: workspaceIdFromContext } = useWorkspace();
  const { socket, joinWorkspace } = useSocket();
  const workspaceId = workspaceIdArg || workspaceIdFromContext;
  const [clients, setClients] = useState([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 100 });
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const lastQueryRef = useRef({ page: 1, limit: 100, includeArchived: true, sort: 'newest' });
  const refreshTimerRef = useRef(null);

  const list = useCallback(async (params = lastQueryRef.current) => {
    if (!workspaceId) return;
    lastQueryRef.current = { ...lastQueryRef.current, ...params };
    const page = Math.max(Number(lastQueryRef.current.page) || 1, 1);
    const append = page > 1;
    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }
    setError('');
    try {
      const response = await clientsApi.list(workspaceId, lastQueryRef.current);
      setClients((current) => mergeClientPages(current, response.data || [], !append));
      setMeta({
        total: response.meta?.total || 0,
        page: response.meta?.page || page,
        limit: response.meta?.limit || lastQueryRef.current.limit || 100,
      });
    } catch (err) {
      setError(err.message || 'Failed to load clients');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [workspaceId]);

  const loadMore = useCallback(async () => {
    const total = Number(meta.total) || 0;
    if (!total || clients.length >= total || loading || loadingMore) return;
    await list({ ...lastQueryRef.current, page: (Number(meta.page) || 1) + 1 });
  }, [clients.length, list, loading, loadingMore, meta.page, meta.total]);

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
      loadingMore,
      hasMore: clients.length < (Number(meta.total) || 0),
      error,
      list,
      loadMore,
      createClient,
      updateClient,
      getClient,
    }),
    [clients, meta, loading, loadingMore, error, list, loadMore, createClient, updateClient, getClient],
  );
}



