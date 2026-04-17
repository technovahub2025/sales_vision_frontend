import { EVENTS } from '../socket/events';
import { useEffect, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { sprintsApi, tasksApi } from '../api';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { useSocket } from '../contexts/SocketContext';
import { toRealtimeEvent } from '../socket/realtime';

function extractEventTask(payload) {
  return payload?.data || payload?.task || payload || null;
}

function upsertBacklogItem(list, task) {
  const safe = Array.isArray(list) ? list : [];
  const id = String(task?._id || task?.id || '');
  if (!id) return safe;
  const index = safe.findIndex((item) => String(item._id || item.id) === id);
  if (index < 0) return [task, ...safe];
  const next = [...safe];
  next[index] = { ...next[index], ...task };
  return next;
}

export function sprintItemsQueryKey(workspaceId, sprintId) {
  return ['workspace', workspaceId, 'sprints', sprintId, 'items'];
}

export function useBacklog(projectIdArg) {
  const queryClient = useQueryClient();
  const { workspaceId, projectId: defaultProjectId } = useWorkspace();
  const { socket, joinWorkspace, leaveWorkspace, onReconnect } = useSocket();
  const projectId = projectIdArg || defaultProjectId;
  const queryKey = useMemo(() => ['workspace', workspaceId, 'projects', projectId, 'backlog'], [workspaceId, projectId]);

  const backlogQuery = useQuery({
    queryKey,
    enabled: Boolean(workspaceId && projectId),
    staleTime: 30_000,
    queryFn: () => sprintsApi.backlog(workspaceId, projectId).then((response) => response.data || []),
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
        queryClient.setQueryData(queryKey, (current) => {
          const safe = Array.isArray(current) ? current : [];
          const id = String(task._id || task.id || '');
          const inBacklog = !task.sprintId;
          if (!id) return safe;
          if (!inBacklog) {
            return safe.filter((item) => String(item._id || item.id) !== id);
          }
          return upsertBacklogItem(safe, task);
        });
        if (task.sprintId) {
          queryClient.invalidateQueries({ queryKey: sprintItemsQueryKey(workspaceId, String(task.sprintId)) });
        }
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

      if (evt.event === 'sprint:updated' || evt.event === 'sprint:completed' || evt.event === 'sprint:started') {
        queryClient.invalidateQueries({ queryKey });
        const sprintId = String(evt.payload?.sprintId || evt.payload?._id || evt.entityId || '');
        if (sprintId) {
          queryClient.invalidateQueries({ queryKey: sprintItemsQueryKey(workspaceId, sprintId) });
        } else {
          queryClient.invalidateQueries({ queryKey: ['workspace', workspaceId, 'sprints'] });
        }
      }
    };

    socket.on(EVENTS.REALTIME_EVENT, onRealtime);
    const unsubscribeReconnect = onReconnect(() => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ['workspace', workspaceId, 'sprints'] });
    });

    return () => {
      leaveWorkspace(joinPayload);
      socket.off(EVENTS.REALTIME_EVENT, onRealtime);
      unsubscribeReconnect();
    };
  }, [socket, workspaceId, projectId, joinWorkspace, leaveWorkspace, onReconnect, queryClient, queryKey]);

  const reorderMutation = useMutation({
    mutationFn: ({ taskId, backlogOrder }) => tasksApi.setBacklogOrder(workspaceId, taskId, backlogOrder),
    onMutate: async ({ taskId, backlogOrder }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData(queryKey);
      queryClient.setQueryData(queryKey, (current) =>
        (Array.isArray(current) ? current : []).map((item) =>
          String(item._id || item.id) === String(taskId) ? { ...item, backlogOrder } : item,
        ),
      );
      return { previous };
    },
    onError: (_error, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(queryKey, ctx.previous);
    },
  });

  const addToSprintMutation = useMutation({
    mutationFn: ({ sprintId, taskIds, position }) => {
      if (taskIds.length === 1) {
        return sprintsApi.addItem(workspaceId, sprintId, { taskId: taskIds[0], position });
      }
      return sprintsApi.addBacklogTasks(workspaceId, sprintId, taskIds);
    },
    onMutate: async ({ sprintId, taskIds, position, sourceSprintId }) => {
      await queryClient.cancelQueries({ queryKey });
      const targetItemsKey = sprintItemsQueryKey(workspaceId, String(sprintId));
      await queryClient.cancelQueries({ queryKey: targetItemsKey });
      const sourceItemsKey =
        sourceSprintId && sourceSprintId !== 'backlog' ? sprintItemsQueryKey(workspaceId, String(sourceSprintId)) : null;
      if (sourceItemsKey) {
        await queryClient.cancelQueries({ queryKey: sourceItemsKey });
      }

      const previous = queryClient.getQueryData(queryKey);
      const previousTargetItems = queryClient.getQueryData(targetItemsKey);
      const previousSourceItems = sourceItemsKey ? queryClient.getQueryData(sourceItemsKey) : null;
      const taskIdSet = new Set((taskIds || []).map(String));
      const movingTasks = (Array.isArray(previous) ? previous : []).filter((item) =>
        taskIdSet.has(String(item._id || item.id)),
      );
      queryClient.setQueryData(queryKey, (current) =>
        (Array.isArray(current) ? current : []).filter((item) => !taskIdSet.has(String(item._id || item.id))),
      );
      queryClient.setQueryData(targetItemsKey, (current) => {
        const safe = Array.isArray(current) ? current : [];
        if (!movingTasks.length) return safe;
        const normalized = movingTasks.map((item, index) => ({
          ...item,
          sprintId: String(sprintId),
          backlogOrder: Number.isFinite(Number(position)) ? Number(position) + index : safe.length + index,
        }));
        if (Number.isFinite(Number(position))) {
          const start = Math.min(Math.max(0, Number(position)), safe.length);
          const next = [...safe];
          next.splice(start, 0, ...normalized);
          return next;
        }
        return [...safe, ...normalized];
      });
      if (sourceItemsKey) {
        queryClient.setQueryData(sourceItemsKey, (current) =>
          (Array.isArray(current) ? current : []).filter((item) => !taskIdSet.has(String(item._id || item.id))),
        );
      }
      return { previous, previousTargetItems, previousSourceItems, targetItemsKey, sourceItemsKey };
    },
    onError: (_error, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(queryKey, ctx.previous);
      if (ctx?.targetItemsKey) queryClient.setQueryData(ctx.targetItemsKey, ctx.previousTargetItems);
      if (ctx?.sourceItemsKey) queryClient.setQueryData(ctx.sourceItemsKey, ctx.previousSourceItems);
    },
    onSettled: (_data, _error, variables, _ctx) => {
      queryClient.invalidateQueries({ queryKey });
      if (variables?.sprintId) {
        queryClient.invalidateQueries({ queryKey: sprintItemsQueryKey(workspaceId, String(variables.sprintId)) });
      }
      if (variables?.sourceSprintId && variables.sourceSprintId !== 'backlog') {
        queryClient.invalidateQueries({ queryKey: sprintItemsQueryKey(workspaceId, String(variables.sourceSprintId)) });
      }
    },
  });

  return useMemo(
    () => ({
      items: backlogQuery.data || [],
      loading: backlogQuery.isLoading,
      error: backlogQuery.error?.message || '',
      refresh: backlogQuery.refetch,
      reorder: (taskId, backlogOrder) => reorderMutation.mutateAsync({ taskId, backlogOrder }).then((r) => r?.data || null),
      addToSprint: (sprintId, taskIds, position, sourceSprintId = 'backlog') =>
        addToSprintMutation.mutateAsync({ sprintId, taskIds, position, sourceSprintId }).then((r) => r?.data || null),
    }),
    [backlogQuery.data, backlogQuery.isLoading, backlogQuery.error?.message, backlogQuery.refetch, reorderMutation, addToSprintMutation],
  );
}
