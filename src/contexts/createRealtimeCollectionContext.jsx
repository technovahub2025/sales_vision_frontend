import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useSocket } from './SocketContext';
import { EVENTS } from '../socket/events';
import { toRealtimeEvent } from '../socket/realtime';

function isAbortError(error) {
  return error?.code === 'ERR_CANCELED' || /canceled|aborted/i.test(String(error?.message || ''));
}

export function createRealtimeCollectionContext({ contextName, moduleName, entityName, listFn, createFn, updateFn, removeFn }) {
  const Context = createContext(null);

  function Provider({ workspaceId, enabled = true, children }) {
    const { socket, joinWorkspace, leaveWorkspace, onReconnect } = useSocket();
    const [items, setItems] = useState([]);
    const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0, version: 0 });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const refreshTimerRef = useRef(null);

    const refresh = useCallback(
      async ({ silent = false } = {}) => {
        if (!workspaceId || !enabled) return;
        if (!silent) {
          setLoading(true);
        }
        setError('');
        try {
          const response = await listFn(workspaceId);
          setItems(response.data || []);
          setMeta((prev) => ({ ...prev, ...(response.meta || {}) }));
        } catch (err) {
          if (!isAbortError(err)) {
            setError(err.message || 'Failed to load data');
          }
        } finally {
          if (!silent) {
            setLoading(false);
          }
        }
      },
      [workspaceId, enabled, listFn],
    );

    const scheduleSilentRefresh = useCallback(() => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
      refreshTimerRef.current = setTimeout(() => {
        refresh({ silent: true });
      }, 120);
    }, [refresh]);

    useEffect(() => {
      if (!enabled) {
        setItems([]);
        setMeta({ page: 1, limit: 20, total: 0, version: Date.now() });
        setLoading(false);
        setError('');
        return;
      }
      refresh();
    }, [enabled, refresh]);

    useEffect(() => {
      if (!socket || !workspaceId || !enabled) return undefined;
      const joinPayload = { workspaceId, modules: [moduleName] };
      joinWorkspace(joinPayload);

      const onUpdate = () => scheduleSilentRefresh();
      const onRealtimeEvent = (raw) => {
        const evt = toRealtimeEvent(raw);
        if (String(evt.workspaceId || '') !== String(workspaceId)) return;
        if (evt.entity !== entityName) return;

        if (evt.event.endsWith(':deleted')) {
          setItems((current) =>
            current.filter((item) => String(item?._id || item?.id) !== String(evt.entityId || evt.payload?._id || evt.payload?.id)),
          );
          return;
        }

        if (evt.payload && typeof evt.payload === 'object') {
          setItems((current) => {
            const incomingId = String(evt.payload._id || evt.payload.id || evt.entityId || '');
            if (!incomingId) {
              onUpdate();
              return current;
            }
            const exists = current.some((item) => String(item?._id || item?.id) === incomingId);
            if (!exists) return [evt.payload, ...current];
            return current.map((item) => (String(item?._id || item?.id) === incomingId ? { ...item, ...evt.payload } : item));
          });
        } else {
          onUpdate();
        }
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
    }, [socket, workspaceId, enabled, joinWorkspace, leaveWorkspace, scheduleSilentRefresh, moduleName, entityName, onReconnect]);

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
        if (response?.data) {
          setItems((current) => [response.data, ...current]);
        }
        return response?.data ?? null;
      },
      [workspaceId, enabled, createFn],
    );

    const updateItem = useCallback(
      async (id, payload) => {
        if (!enabled) return null;
        const response = await updateFn(workspaceId, id, payload);
        if (response?.data) {
          setItems((current) => current.map((item) => (String(item._id) === String(id) ? response.data : item)));
        }
        return response?.data ?? null;
      },
      [workspaceId, enabled, updateFn],
    );

    const removeItem = useCallback(
      async (id) => {
        if (!enabled) return null;
        await removeFn(workspaceId, id);
        setItems((current) => current.filter((item) => String(item._id) !== String(id)));
      },
      [workspaceId, enabled, removeFn],
    );

    const value = useMemo(
      () => ({ items, meta, loading, error, refresh, createItem, updateItem, removeItem }),
      [items, meta, loading, error, refresh, createItem, updateItem, removeItem],
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
