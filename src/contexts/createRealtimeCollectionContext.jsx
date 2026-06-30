import { createContext, useCallback, useContext, useEffect, useMemo, useRef } from 'react';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { useSocket } from './SocketContext';
import { EVENTS } from '../socket/events';
import { toRealtimeEvent } from '../socket/realtime';
import { compareByRecencyDesc } from '../lib/listSort';

export function createRealtimeCollectionContext({ contextName, moduleName, entityName, listFn, createFn, updateFn, removeFn }) {
  const Context = createContext(null);

  function Provider({ workspaceId, enabled = true, children }) {
    const queryClient = useQueryClient();
    const { socket, joinWorkspace, leaveWorkspace, onReconnect } = useSocket();
    const refreshTimerRef = useRef(null);
    const listKey = useMemo(() => [contextName, workspaceId, 'collection'], [workspaceId]);

    const collectionQuery = useInfiniteQuery({
      queryKey: listKey,
      enabled: Boolean(workspaceId) && enabled,
      initialPageParam: 1,
      queryFn: ({ pageParam, signal }) => listFn(workspaceId, { page: pageParam, limit: 50 }, signal),
      getNextPageParam: (lastPage, allPages) => {
        const meta = lastPage?.meta || {};
        const page = Number(meta.page || allPages.length || 1);
        const limit = Number(meta.limit || 50);
        const total = Number(meta.total || 0);
        const rows = Array.isArray(lastPage?.data) ? lastPage.data : [];
        if (total > 0) return page * limit < total ? page + 1 : undefined;
        return rows.length >= limit ? page + 1 : undefined;
      },
      staleTime: 30_000,
      gcTime: 5 * 60_000,
    });

    const items = useMemo(() => {
      const merged = (collectionQuery.data?.pages || []).flatMap((page) => page?.data || []);
      const unique = new Map();
      merged.forEach((item) => {
        const id = String(item?._id || item?.id || '');
        if (id) unique.set(id, item);
      });
      return [...unique.values()].sort(compareByRecencyDesc);
    }, [collectionQuery.data?.pages]);

    const meta = useMemo(() => {
      const pages = collectionQuery.data?.pages || [];
      const lastPage = pages[pages.length - 1] || {};
      const lastMeta = lastPage.meta || {};
      return {
        page: Number(lastMeta.page || pages.length || 1),
        limit: Number(lastMeta.limit || 50),
        total: Number(lastMeta.total || items.length),
        hasNextPage: Boolean(collectionQuery.hasNextPage),
      };
    }, [collectionQuery.data?.pages, collectionQuery.hasNextPage, items.length]);

    const scheduleSilentRefresh = useCallback(() => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
      refreshTimerRef.current = setTimeout(() => {
        void collectionQuery.refetch();
      }, 120);
    }, [collectionQuery]);

    useEffect(() => {
      if (!enabled) {
        queryClient.removeQueries({ queryKey: listKey, exact: true });
        return;
      }
    }, [enabled, listKey, queryClient]);

    useEffect(() => {
      if (!socket || !workspaceId || !enabled) return undefined;
      const joinPayload = { workspaceId, modules: [moduleName] };
      joinWorkspace(joinPayload);

      const onUpdate = () => scheduleSilentRefresh();
      const onRealtimeEvent = (raw) => {
        const evt = toRealtimeEvent(raw);
        if (String(evt.workspaceId || '') !== String(workspaceId)) return;
        if (evt.entity !== entityName) return;
        onUpdate();
      };

      socket.on(`${moduleName}:updated`, onUpdate);
      socket.on(`${entityName}:created`, onUpdate);
      socket.on(`${entityName}:updated`, onUpdate);
      socket.on(`${entityName}:deleted`, onUpdate);
      socket.on(EVENTS.REALTIME_EVENT, onRealtimeEvent);
      const unsubscribeReconnect = onReconnect(() => scheduleSilentRefresh());

      return () => {
        leaveWorkspace(joinPayload);
        socket.off(`${moduleName}:updated`, onUpdate);
        socket.off(`${entityName}:created`, onUpdate);
        socket.off(`${entityName}:updated`, onUpdate);
        socket.off(`${entityName}:deleted`, onUpdate);
        socket.off(EVENTS.REALTIME_EVENT, onRealtimeEvent);
        unsubscribeReconnect();
      };
    }, [socket, workspaceId, enabled, joinWorkspace, leaveWorkspace, scheduleSilentRefresh, onReconnect]);

    useEffect(
      () => () => {
        if (refreshTimerRef.current) {
          clearTimeout(refreshTimerRef.current);
        }
      },
      [],
    );

    const createItem = useCallback(
      async (payload) => {
        if (!enabled) return null;
        const response = await createFn(workspaceId, payload);
        await collectionQuery.refetch();
        return response?.data ?? null;
      },
      [workspaceId, enabled, collectionQuery],
    );

    const updateItem = useCallback(
      async (id, payload) => {
        if (!enabled) return null;
        const response = await updateFn(workspaceId, id, payload);
        await collectionQuery.refetch();
        return response?.data ?? null;
      },
      [workspaceId, enabled, collectionQuery],
    );

    const removeItem = useCallback(
      async (id) => {
        if (!enabled) return null;
        await removeFn(workspaceId, id);
        await collectionQuery.refetch();
      },
      [workspaceId, enabled, collectionQuery],
    );

    const value = useMemo(
      () => ({
        items,
        meta,
        loading: collectionQuery.isLoading,
        loadingMore: collectionQuery.isFetchingNextPage,
        error: collectionQuery.error?.message || '',
        hasMore: Boolean(collectionQuery.hasNextPage),
        refresh: collectionQuery.refetch,
        loadMore: collectionQuery.fetchNextPage,
        createItem,
        updateItem,
        removeItem,
      }),
      [items, meta, collectionQuery, createItem, updateItem, removeItem],
    );
    return <Context.Provider value={value}>{children}</Context.Provider>;
  }

  function useCollection() {
    const context = useContext(Context);
    if (!context) throw new Error(`${contextName} must be used within provider`);
    return context;
  }

  return { Provider, useCollection };
}
