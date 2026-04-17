import { EVENTS } from '../socket/events';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { commentsApi } from '../api';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { useSocket } from '../contexts/SocketContext';
import { toRealtimeEvent } from '../socket/realtime';

function appendOrUpdate(list, item) {
  const id = String(item?._id || item?.id || '');
  if (!id) return list;
  const exists = list.some((row) => String(row?._id || row?.id) === id);
  if (!exists) return [...list, item];
  return list.map((row) => (String(row?._id || row?.id) === id ? { ...row, ...item } : row));
}

export function useComments(entityType, entityId) {
  const { workspaceId } = useWorkspace();
  const { socket, joinWorkspace, leaveWorkspace, onReconnect } = useSocket();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const hydrate = useCallback(async ({ silent = false } = {}) => {
    if (!workspaceId || !entityType || !entityId) return;
    if (!silent) {
      setLoading(true);
    }
    setError('');
    try {
      if (entityType === 'task') {
        const response = await commentsApi.listByTask(workspaceId, entityId);
        setItems(response.data || []);
      } else {
        const response = await commentsApi.listByLead(workspaceId, entityId);
        setItems(response.data || []);
      }
    } catch (err) {
      if (!silent) {
        setError(err.message || 'Failed to load comments');
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, [workspaceId, entityType, entityId]);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!socket || !workspaceId || !entityId) return undefined;
    const joinPayload = { workspaceId, modules: ['comments'], entities: [{ module: 'comments', id: entityId }] };
    joinWorkspace(joinPayload);

    const refreshSilent = () => hydrate({ silent: true });
    const onRealtime = (raw) => {
      const evt = toRealtimeEvent(raw);
      if (String(evt.workspaceId || '') !== String(workspaceId)) return;
      if (evt.entity !== 'comment') return;
      const comment = evt.payload;
      if (!comment) return;

      const relatedTaskId = String(comment.taskId || '');
      const relatedLeadId = String(comment.leadId || '');
      const belongsToEntity = entityType === 'task'
        ? relatedTaskId === String(entityId)
        : relatedLeadId === String(entityId);
      if (!belongsToEntity) return;

      if (evt.event.endsWith(':deleted')) {
        setItems((prev) => prev.filter((row) => String(row._id || row.id) !== String(evt.entityId)));
        return;
      }
      setItems((prev) => appendOrUpdate(prev, comment));
    };

    socket.on(EVENTS.COMMENT_CREATED, refreshSilent);
    socket.on(EVENTS.COMMENT_UPDATED, refreshSilent);
    socket.on(EVENTS.REALTIME_EVENT, onRealtime);
    const unsubscribeReconnect = onReconnect(refreshSilent);

    return () => {
      leaveWorkspace(joinPayload);
      socket.off(EVENTS.COMMENT_CREATED, refreshSilent);
      socket.off(EVENTS.COMMENT_UPDATED, refreshSilent);
      socket.off(EVENTS.REALTIME_EVENT, onRealtime);
      unsubscribeReconnect();
    };
  }, [socket, workspaceId, entityId, entityType, joinWorkspace, leaveWorkspace, hydrate, onReconnect]);

  const createComment = useCallback(async (payload) => {
    if (!workspaceId) return null;
    const response = entityType === 'task'
      ? await commentsApi.createForTask(workspaceId, entityId, payload)
      : await commentsApi.createForLead(workspaceId, entityId, payload);
    const item = response.data || null;
    if (item) setItems((prev) => appendOrUpdate(prev, item));
    return item;
  }, [workspaceId, entityType, entityId]);

  const updateComment = useCallback(async (commentId, payload) => {
    if (!workspaceId) return null;
    const response = await commentsApi.update(workspaceId, commentId, payload);
    const item = response.data || null;
    if (item) {
      setItems((prev) => prev.map((row) => (String(row._id || row.id) === String(commentId) ? item : row)));
    }
    return item;
  }, [workspaceId]);

  const removeComment = useCallback(async (commentId) => {
    if (!workspaceId) return null;
    const response = await commentsApi.remove(workspaceId, commentId);
    setItems((prev) => prev.filter((row) => String(row._id || row.id) !== String(commentId)));
    return response.data || null;
  }, [workspaceId]);

  return useMemo(
    () => ({
      items,
      loading,
      error,
      refresh: hydrate,
      createComment,
      updateComment,
      removeComment,
    }),
    [items, loading, error, hydrate, createComment, updateComment, removeComment],
  );
}
