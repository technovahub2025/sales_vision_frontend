import { useEffect, useMemo } from 'react';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationsApi } from '../api';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { useSocket } from '../contexts/SocketContext';
import { EVENTS } from '../socket/events';
import { useAuth } from '../contexts/AuthContext';

const NOTIFICATION_LIMIT = 50;

function normalizeNotification(input) {
  if (!input || typeof input !== 'object') {
    return null;
  }
  return {
    ...input,
    read: Boolean(input.read ?? input.isRead),
  };
}

function updateMeta(meta, updater) {
  const safe = meta && typeof meta === 'object' ? meta : {};
  return updater(safe);
}

function optimisticMarkRead(pages, notificationId) {
  let updated = false;
  const nextPages = (Array.isArray(pages) ? pages : []).map((page, pageIndex) => {
    const items = Array.isArray(page?.data) ? page.data : [];
    const nextItems = items.map((item) => {
      if (String(item._id) !== String(notificationId) || item.read) {
        return item;
      }
      updated = true;
      return { ...item, read: true, readAt: new Date().toISOString() };
    });
    const nextMeta =
      pageIndex === 0 && updated
        ? updateMeta(page?.meta, (meta) => ({
            ...meta,
            unreadCount: Math.max(0, Number(meta.unreadCount || 0) - 1),
          }))
        : page?.meta;
    return { ...page, data: nextItems, meta: nextMeta };
  });
  return { nextPages, updated };
}

function optimisticMarkAllRead(pages) {
  return (Array.isArray(pages) ? pages : []).map((page, pageIndex) => {
    const items = Array.isArray(page?.data) ? page.data : [];
    const nextItems = items.map((item) => (item.read ? item : { ...item, read: true, readAt: new Date().toISOString() }));
    const nextMeta =
      pageIndex === 0
        ? updateMeta(page?.meta, (meta) => ({
            ...meta,
            unreadCount: 0,
          }))
        : page?.meta;
    return { ...page, data: nextItems, meta: nextMeta };
  });
}

function optimisticRemove(pages, notificationId) {
  let removedUnread = 0;
  const nextPages = (Array.isArray(pages) ? pages : []).map((page, pageIndex) => {
    const items = Array.isArray(page?.data) ? page.data : [];
    const nextItems = items.filter((item) => {
      if (String(item._id) !== String(notificationId)) {
        return true;
      }
      if (!item.read) {
        removedUnread += 1;
      }
      return false;
    });
    const nextMeta =
      pageIndex === 0 && removedUnread
        ? updateMeta(page?.meta, (meta) => ({
            ...meta,
            unreadCount: Math.max(0, Number(meta.unreadCount || 0) - removedUnread),
          }))
        : page?.meta;
    return { ...page, data: nextItems, meta: nextMeta };
  });
  return nextPages;
}

function prependNotification(pages, notification) {
  const normalized = normalizeNotification(notification);
  if (!normalized) {
    return pages;
  }

  const safePages = Array.isArray(pages) ? pages : [];
  const firstPage = safePages[0] || { data: [], meta: { limit: NOTIFICATION_LIMIT, nextCursor: null, hasMore: false } };
  const firstItems = Array.isArray(firstPage.data) ? firstPage.data : [];
  if (firstItems.some((item) => String(item._id) === String(normalized._id))) {
    return safePages;
  }

  const limit = Number(firstPage.meta?.limit || NOTIFICATION_LIMIT);
  const mergedItems = [normalized, ...firstItems].slice(0, limit);
  const nextMeta = updateMeta(firstPage.meta, (meta) => ({
    ...meta,
    unreadCount: normalized.read ? Number(meta.unreadCount || 0) : Number(meta.unreadCount || 0) + 1,
  }));

  const nextFirstPage = { ...firstPage, data: mergedItems, meta: nextMeta };
  if (!safePages.length) {
    return [nextFirstPage];
  }
  return [nextFirstPage, ...safePages.slice(1)];
}

export function useNotifications(userIdArg) {
  const queryClient = useQueryClient();
  const { workspaceId, workspaceReady, bootstrapStatus } = useWorkspace();
  const { socket, joinWorkspace, leaveWorkspace, onReconnect } = useSocket();
  const { user } = useAuth();
  const userId = userIdArg || String(user?._id || user?.id || '') || window.localStorage.getItem('salevision:userId') || '';
  const queryKey = useMemo(() => ['workspace', workspaceId, 'notifications', userId], [workspaceId, userId]);

  const notificationsQuery = useInfiniteQuery({
    queryKey,
    enabled: Boolean(workspaceReady && workspaceId && userId),
    staleTime: 0,
    gcTime: 5 * 60_000,
    initialPageParam: null,
    queryFn: async ({ pageParam, signal }) => {
      const response = await notificationsApi.list(
        workspaceId,
        {
          cursor: pageParam || undefined,
          limit: NOTIFICATION_LIMIT,
        },
        signal,
      );
      return {
        ...response,
        data: (Array.isArray(response?.data) ? response.data : []).map(normalizeNotification).filter(Boolean),
      };
    },
    getNextPageParam: (lastPage) => lastPage?.meta?.nextCursor || undefined,
  });
  const refetchNotifications = notificationsQuery.refetch;

  const markReadMutation = useMutation({
    mutationFn: (id) => notificationsApi.markRead(workspaceId, id, {}),
    onMutate: async (notificationId) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData(queryKey);
      queryClient.setQueryData(queryKey, (current) => {
        const pages = current?.pages || [];
        const { nextPages } = optimisticMarkRead(pages, notificationId);
        return { ...current, pages: nextPages };
      });
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => notificationsApi.markAllRead(workspaceId, {}),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData(queryKey);
      queryClient.setQueryData(queryKey, (current) => ({
        ...current,
        pages: optimisticMarkAllRead(current?.pages || []),
      }));
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
    },
  });

  const removeMutation = useMutation({
    mutationFn: (id) => notificationsApi.remove(workspaceId, id),
    onMutate: async (notificationId) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData(queryKey);
      queryClient.setQueryData(queryKey, (current) => ({
        ...current,
        pages: optimisticRemove(current?.pages || [], notificationId),
      }));
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
    },
  });

  useEffect(() => {
    if (!socket || !workspaceId || !userId) {
      return;
    }

    const joinPayload = { workspaceId, userId, modules: ['notifications'] };
    joinWorkspace(joinPayload);

    const onNotificationNew = (payload) => {
      const notification = payload?.data || payload?.notification || payload;
      queryClient.setQueryData(queryKey, (current) => {
        if (!current) {
          return current;
        }
        return {
          ...current,
          pages: prependNotification(current.pages, notification),
        };
      });
    };

    socket.on(EVENTS.NOTIFICATION_NEW, onNotificationNew);
    socket.on(EVENTS.NOTIFY_MENTION, onNotificationNew);
    const unsubscribeReconnect = onReconnect(() => {
      refetchNotifications();
    });
    return () => {
      leaveWorkspace(joinPayload);
      socket.off(EVENTS.NOTIFICATION_NEW, onNotificationNew);
      socket.off(EVENTS.NOTIFY_MENTION, onNotificationNew);
      unsubscribeReconnect();
    };
  }, [socket, workspaceId, userId, joinWorkspace, leaveWorkspace, queryClient, queryKey, onReconnect, refetchNotifications]);

  const items = useMemo(
    () =>
      (notificationsQuery.data?.pages || [])
        .flatMap((page) => (Array.isArray(page?.data) ? page.data : []))
        .filter(Boolean),
    [notificationsQuery.data?.pages],
  );

  const meta = useMemo(() => notificationsQuery.data?.pages?.[0]?.meta || { unreadCount: 0 }, [notificationsQuery.data?.pages]);
  const bootstrapLoading = bootstrapStatus === 'booting';
  const initialNotificationLoading =
    workspaceReady &&
    Boolean(userId) &&
    notificationsQuery.isLoading &&
    !notificationsQuery.isFetched;

  return useMemo(
    () => ({
      items,
      meta,
      loading: bootstrapLoading || initialNotificationLoading,
      error: notificationsQuery.error?.message || '',
      hasNextPage: Boolean(notificationsQuery.hasNextPage),
      loadingMore: notificationsQuery.isFetchingNextPage,
      refresh: notificationsQuery.refetch,
      loadMore: notificationsQuery.fetchNextPage,
      markRead: markReadMutation.mutateAsync,
      markAllRead: markAllReadMutation.mutateAsync,
      remove: removeMutation.mutateAsync,
      markReadState: markReadMutation,
      markAllReadState: markAllReadMutation,
      removeState: removeMutation,
    }),
    [
      items,
      meta,
      bootstrapLoading,
      initialNotificationLoading,
      notificationsQuery.error?.message,
      notificationsQuery.hasNextPage,
      notificationsQuery.isFetchingNextPage,
      notificationsQuery.refetch,
      notificationsQuery.fetchNextPage,
      markReadMutation,
      markAllReadMutation,
      removeMutation,
    ],
  );
}
