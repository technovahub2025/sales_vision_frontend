import { EVENTS } from '../socket/events';
import { useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { roadmapApi } from '../api';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { useSocket } from '../contexts/SocketContext';
import { toRealtimeEvent } from '../socket/realtime';

function extractEventTask(payload) {
  return payload?.data || payload?.task || payload || null;
}

function upsertRoadmapItem(list, task) {
  const safe = Array.isArray(list) ? list : [];
  const id = String(task?._id || task?.id || '');
  if (!id) return safe;
  const index = safe.findIndex((item) => String(item._id || item.id) === id);
  if (index < 0) return [task, ...safe];
  const next = [...safe];
  next[index] = { ...next[index], ...task };
  return next;
}

export function useRoadmap(projectIdArg) {
  const queryClient = useQueryClient();
  const { workspaceId, projectId: defaultProjectId } = useWorkspace();
  const { socket, joinWorkspace, leaveWorkspace, onReconnect } = useSocket();
  const projectId = projectIdArg || defaultProjectId;
  const queryKey = useMemo(() => ['workspace', workspaceId, 'projects', projectId, 'roadmap'], [workspaceId, projectId]);

  const roadmapQuery = useQuery({
    queryKey,
    enabled: Boolean(workspaceId && projectId),
    staleTime: 30_000,
    queryFn: () => roadmapApi.get(workspaceId, projectId).then((response) => response.data || []),
  });

  useEffect(() => {
    if (!socket || !workspaceId || !projectId) return;
    const joinPayload = { workspaceId, projectId, modules: ['tasks', 'sprints'] };
    joinWorkspace(joinPayload);

    const onRealtime = (raw) => {
      const evt = toRealtimeEvent(raw);
      if (String(evt.workspaceId || '') !== String(workspaceId)) return;

      if (evt.event === 'task:created' || evt.event === 'task:updated') {
        const task = extractEventTask(raw);
        if (!task || String(task.projectId) !== String(projectId)) return;
        queryClient.setQueryData(queryKey, (current) => upsertRoadmapItem(current, task));
        return;
      }

      if (evt.event === 'task:deleted') {
        const task = extractEventTask(raw);
        const id = String(task?._id || task?.id || '');
        if (!id) return;
        queryClient.setQueryData(queryKey, (current) =>
          (Array.isArray(current) ? current : []).filter((item) => String(item._id || item.id) !== id),
        );
        return;
      }

      if (evt.event.startsWith('sprint:') || evt.event === 'project:updated') {
        queryClient.invalidateQueries({ queryKey });
      }
    };

    socket.on(EVENTS.REALTIME_EVENT, onRealtime);
    const unsubscribeReconnect = onReconnect(() => {
      queryClient.invalidateQueries({ queryKey });
    });

    return () => {
      leaveWorkspace(joinPayload);
      socket.off(EVENTS.REALTIME_EVENT, onRealtime);
      unsubscribeReconnect();
    };
  }, [socket, workspaceId, projectId, joinWorkspace, leaveWorkspace, onReconnect, queryClient, queryKey]);

  return useMemo(
    () => ({
      items: roadmapQuery.data || [],
      loading: roadmapQuery.isLoading,
      error: roadmapQuery.error?.message || '',
      refresh: roadmapQuery.refetch,
    }),
    [roadmapQuery.data, roadmapQuery.isLoading, roadmapQuery.error?.message, roadmapQuery.refetch],
  );
}
