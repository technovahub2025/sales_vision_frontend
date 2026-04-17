import { EVENTS } from '../socket/events';
import { useCallback, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { projectsApi } from '../api';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { useSocket } from '../contexts/SocketContext';
import { toRealtimeEvent } from '../socket/realtime';

export function useProjectOverview(projectIdArg) {
  const queryClient = useQueryClient();
  const { workspaceId, projectId: projectIdFromContext } = useWorkspace();
  const { socket, joinWorkspace, leaveWorkspace, onReconnect } = useSocket();
  const projectId = projectIdArg || projectIdFromContext;
  const queryKey = useMemo(() => ['workspace', workspaceId, 'projects', projectId, 'overview'], [workspaceId, projectId]);

  const overviewQuery = useQuery({
    queryKey,
    enabled: Boolean(workspaceId && projectId),
    staleTime: 30_000,
    queryFn: ({ signal }) => projectsApi.overview(workspaceId, projectId, signal).then((payload) => payload.data || null),
  });

  const refresh = useCallback(() => overviewQuery.refetch(), [overviewQuery.refetch]);

  useEffect(() => {
    if (!socket || !workspaceId || !projectId) return undefined;
    const joinPayload = { workspaceId, projectId, modules: ['projects', 'tasks', 'activity'] };
    joinWorkspace(joinPayload);

    const invalidateOverview = () => {
      queryClient.invalidateQueries({ queryKey });
    };
    const onRealtime = (raw) => {
      const evt = toRealtimeEvent(raw);
      if (String(evt.workspaceId || '') !== String(workspaceId)) return;
      if (!evt.event) return;
      if (evt.event.startsWith('project:') || evt.event.startsWith('task:') || evt.event.startsWith('activity:')) {
        invalidateOverview();
      }
    };

    socket.on(EVENTS.REALTIME_EVENT, onRealtime);
    const unsubscribeReconnect = onReconnect(invalidateOverview);

    return () => {
      leaveWorkspace(joinPayload);
      socket.off(EVENTS.REALTIME_EVENT, onRealtime);
      unsubscribeReconnect();
    };
  }, [socket, workspaceId, projectId, joinWorkspace, leaveWorkspace, onReconnect, queryClient, queryKey]);

  return useMemo(
    () => ({
      overview: overviewQuery.data || null,
      loading: overviewQuery.isLoading || (overviewQuery.isFetching && !overviewQuery.data),
      error: overviewQuery.error?.message || '',
      refresh,
    }),
    [overviewQuery.data, overviewQuery.isLoading, overviewQuery.isFetching, overviewQuery.error?.message, refresh],
  );
}
