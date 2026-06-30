import { EVENTS } from '../socket/events';
import { useCallback, useEffect, useMemo } from 'react';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { activityApi, analyticsApi, dashboardApi, myTasksApi, searchApi, tasksApi } from '../api';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { useSocket } from '../contexts/SocketContext';

function mergeFeed(prev, next) {
  const items = [...next, ...(prev || [])];
  const seen = new Set();
  return items.filter((item) => {
    const key = String(item._id || item.id || '');
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function useDashboard() {
  const { workspaceId, workspaceReady, bootstrapStatus } = useWorkspace();
  const { socket, joinWorkspace } = useSocket();
  const queryClient = useQueryClient();

  const overviewQuery = useQuery({
    queryKey: ['dashboard', 'overview', workspaceId],
    enabled: Boolean(workspaceId),
    queryFn: () => analyticsApi.overview(workspaceId).then((res) => res.data || {}),
    staleTime: 60_000,
  });

  const projectHealthQuery = useQuery({
    queryKey: ['dashboard', 'project-health', workspaceId],
    enabled: Boolean(workspaceId),
    queryFn: () => analyticsApi.projectHealth(workspaceId).then((res) => res.data || []),
    staleTime: 60_000,
  });

  const myTasksQuery = useQuery({
    queryKey: ['dashboard', 'my-tasks', workspaceId],
    enabled: Boolean(workspaceId),
    queryFn: () =>
      myTasksApi
        .summary(workspaceId, { view: 'list', filter: 'all', sort: 'dueDate', limit: 5, includeArchived: 'false' })
        .then((res) => res.data || {}),
    staleTime: 30_000,
  });

  const activityQuery = useInfiniteQuery({
    queryKey: ['dashboard', 'activity-feed', workspaceId],
    enabled: Boolean(workspaceId),
    queryFn: ({ pageParam }) =>
      activityApi.feed(workspaceId, { limit: 20, ...(pageParam ? { cursor: pageParam } : {}) }).then((res) => res),
    getNextPageParam: (lastPage) => lastPage?.meta?.nextCursor || null,
  });

  useEffect(() => {
    if (!socket || !workspaceId) return;
    joinWorkspace({ workspaceId, modules: ['activity', 'dashboard', 'tasks'] });

    const onActivity = (payload) => {
      const item = payload?.data;
      if (!item) return;
      queryClient.setQueryData(['dashboard', 'activity-feed', workspaceId], (current) => {
        if (!current) return current;
        const pages = current.pages || [];
        const first = pages[0];
        if (!first) return current;
        const nextItems = mergeFeed(first.data || [], [item]);
        const nextFirst = { ...first, data: nextItems };
        return { ...current, pages: [nextFirst, ...pages.slice(1)] };
      });
    };

    socket.on(EVENTS.ACTIVITY_APPENDED, onActivity);
    return () => socket.off(EVENTS.ACTIVITY_APPENDED, onActivity);
  }, [socket, workspaceId, joinWorkspace, queryClient]);

  const exportReport = useMutation({
    mutationFn: (format) => dashboardApi.exportReport(workspaceId, format),
  });

  const updateTaskStatus = useCallback(
    async (taskId, status) => {
      if (!workspaceId) return null;
      const response = await tasksApi.updateStatus(workspaceId, taskId, status);
      return response?.data || null;
    },
    [workspaceId],
  );

  const overview = overviewQuery.data || {};
  const metrics = useMemo(() => overview.metrics || {}, [overview.metrics]);

  const activityItems = useMemo(() => {
    const pages = activityQuery.data?.pages || [];
    return pages.flatMap((page) => page?.data || []);
  }, [activityQuery.data]);

  const emptySearchResult = useMemo(
    () => ({ tasks: [], projects: [], leads: [] }),
    [],
  );

  const bootstrapLoading = bootstrapStatus === 'booting';
  const initialDashboardLoading =
    workspaceReady &&
    ((overviewQuery.isLoading && !overviewQuery.isFetched) ||
      (projectHealthQuery.isLoading && !projectHealthQuery.isFetched) ||
      (myTasksQuery.isLoading && !myTasksQuery.isFetched));

  return useMemo(
    () => ({
      loading: bootstrapLoading || initialDashboardLoading,
      error: overviewQuery.error?.message || projectHealthQuery.error?.message || myTasksQuery.error?.message || '',
      metrics,
      velocitySeries: overview.velocitySeries || [],
      activeSprint: overview.activeSprint || null,
      teamWorkload: overview.teamWorkload || { rows: [], columns: [], cells: [] },
      projectHealth: projectHealthQuery.data || [],
      myTasks: myTasksQuery.data?.items || [],
      activity: activityItems,
      activityHasMore: activityQuery.hasNextPage,
      loadMoreActivity: activityQuery.fetchNextPage,
      actionsState: {
        exporting: exportReport.isPending,
      },
      exportReport: (format) => exportReport.mutateAsync(format),
      updateTaskStatus,
      search: (q) => {
        const safeQuery = String(q || '').trim();
        if (!workspaceId || !safeQuery) return Promise.resolve(emptySearchResult);
        return searchApi.search(workspaceId, { q: safeQuery }).then((res) => res.data || emptySearchResult);
      },
    }),
    [
      workspaceId,
      bootstrapLoading,
      initialDashboardLoading,
      overviewQuery.error,
      projectHealthQuery.error,
      myTasksQuery.error,
      metrics,
      overview.velocitySeries,
      overview.activeSprint,
      overview.teamWorkload,
      projectHealthQuery.data,
      myTasksQuery.data,
      activityItems,
      activityQuery.hasNextPage,
      activityQuery.fetchNextPage,
      exportReport,
      updateTaskStatus,
      emptySearchResult,
    ],
  );
}
