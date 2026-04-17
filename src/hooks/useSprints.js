import { EVENTS } from '../socket/events';
import { useCallback, useEffect, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { sprintsApi } from '../api';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { useSocket } from '../contexts/SocketContext';
import { toRealtimeEvent } from '../socket/realtime';

function extractEventSprint(payload) {
  return payload?.data || payload?.sprint || payload || null;
}

function upsertSprint(list, sprint) {
  const safe = Array.isArray(list) ? list : [];
  const id = String(sprint?._id || sprint?.id || '');
  if (!id) return safe;
  const index = safe.findIndex((item) => String(item._id || item.id) === id);
  if (index < 0) return [sprint, ...safe];
  const next = [...safe];
  next[index] = { ...next[index], ...sprint };
  return next;
}

export function useSprints(projectIdArg) {
  const queryClient = useQueryClient();
  const { workspaceId, projectId: defaultProjectId } = useWorkspace();
  const { socket, joinWorkspace, leaveWorkspace, onReconnect } = useSocket();
  const projectId = projectIdArg || defaultProjectId;
  const queryKey = useMemo(() => ['workspace', workspaceId, 'projects', projectId, 'sprints'], [workspaceId, projectId]);

  const sprintsQuery = useQuery({
    queryKey,
    enabled: Boolean(workspaceId && projectId),
    staleTime: 30_000,
    queryFn: () => sprintsApi.list(workspaceId, projectId, { page: 1, limit: 100 }).then((response) => response.data || []),
  });

  const upsertFromPayload = useCallback(
    (payload) => {
      const sprint = extractEventSprint(payload);
      const sprintId = String(sprint?._id || sprint?.id || sprint?.sprintId || '');
      if (!sprintId) return false;
      if (sprint?.projectId && String(sprint.projectId) !== String(projectId)) return false;
      queryClient.setQueryData(queryKey, (current) => upsertSprint(current, { ...sprint, _id: sprint._id || sprint.id || sprint.sprintId }));
      return true;
    },
    [projectId, queryClient, queryKey],
  );

  const invalidateSprints = useCallback(() => {
    queryClient.invalidateQueries({ queryKey });
  }, [queryClient, queryKey]);

  useEffect(() => {
    if (!socket || !workspaceId || !projectId) return;
    const joinPayload = { workspaceId, projectId, modules: ['sprints'] };
    joinWorkspace(joinPayload);

    const onRealtime = (raw) => {
      const evt = toRealtimeEvent(raw);
      if (String(evt.workspaceId || '') !== String(workspaceId)) return;
      if (!evt.event?.startsWith('sprint:')) return;

      const updated = upsertFromPayload(raw);
      if (updated) return;

      if (evt.event === 'sprint:updated') {
        const sprintId = String(evt.payload?._id || evt.payload?.id || evt.payload?.sprintId || '');
        if (!sprintId) {
          invalidateSprints();
          return;
        }
        const current = queryClient.getQueryData(queryKey) || [];
        const exists = current.some((item) => String(item._id || item.id) === sprintId);
        if (exists) {
          invalidateSprints();
        }
      }
    };

    socket.on(EVENTS.REALTIME_EVENT, onRealtime);
    const unsubscribeReconnect = onReconnect(invalidateSprints);

    return () => {
      leaveWorkspace(joinPayload);
      socket.off(EVENTS.REALTIME_EVENT, onRealtime);
      unsubscribeReconnect();
    };
  }, [socket, workspaceId, projectId, joinWorkspace, leaveWorkspace, onReconnect, upsertFromPayload, invalidateSprints, queryClient, queryKey]);

  const createSprintMutation = useMutation({
    mutationFn: (payload) => sprintsApi.create(workspaceId, projectId, payload),
    onSuccess: (response) => {
      const sprint = response?.data;
      if (!sprint) return;
      queryClient.setQueryData(queryKey, (current) => upsertSprint(current, sprint));
    },
  });

  const startSprintMutation = useMutation({
    mutationFn: (sprintId) => sprintsApi.start(workspaceId, sprintId),
    onSuccess: (response) => {
      const sprint = response?.data;
      if (!sprint) return;
      queryClient.setQueryData(queryKey, (current) => upsertSprint(current, sprint));
    },
  });

  const completeSprintMutation = useMutation({
    mutationFn: (sprintId) => sprintsApi.complete(workspaceId, sprintId),
    onSuccess: (response) => {
      const sprint = response?.data;
      if (!sprint) return;
      queryClient.setQueryData(queryKey, (current) => upsertSprint(current, sprint));
    },
  });

  const createSprint = useCallback(
    (payload) => createSprintMutation.mutateAsync(payload).then((r) => r?.data || null),
    [createSprintMutation.mutateAsync],
  );
  const startSprint = useCallback(
    (sprintId) => startSprintMutation.mutateAsync(sprintId).then((r) => r?.data || null),
    [startSprintMutation.mutateAsync],
  );
  const completeSprint = useCallback(
    (sprintId) => completeSprintMutation.mutateAsync(sprintId).then((r) => r?.data || null),
    [completeSprintMutation.mutateAsync],
  );
  const getBurndownStable = useCallback(
    (sprintId, signal) => sprintsApi.burndown(workspaceId, sprintId, signal).then((response) => response.data || []),
    [workspaceId],
  );

  return useMemo(
    () => ({
      sprints: sprintsQuery.data || [],
      loading: sprintsQuery.isLoading,
      error: sprintsQuery.error?.message || '',
      refresh: sprintsQuery.refetch,
      createSprint,
      startSprint,
      completeSprint,
      getBurndown: getBurndownStable,
    }),
    [
      sprintsQuery.data,
      sprintsQuery.isLoading,
      sprintsQuery.error?.message,
      sprintsQuery.refetch,
      createSprint,
      startSprint,
      completeSprint,
      getBurndownStable,
    ],
  );
}
