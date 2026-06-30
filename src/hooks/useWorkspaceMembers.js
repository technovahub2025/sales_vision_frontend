import { useMemo } from 'react';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { invitesApi, workspacesApi } from '../api';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { usePermission } from './usePermission';

const DEFAULT_META = { page: 1, limit: 8, total: 0, pages: 1 };

function toQueryMeta(meta = {}, fallbackPage, fallbackLimit) {
  const page = Number(meta.page) || fallbackPage;
  const limit = Number(meta.limit) || fallbackLimit;
  const total = Number(meta.total) || 0;
  const pages = Number(meta.pages) || Math.max(1, Math.ceil(total / limit));
  return { page, limit, total, pages };
}

function nextPageParam(lastPage, allPages) {
  const meta = lastPage?.meta || {};
  const page = Number(meta.page) || allPages.length;
  const pages = Number(meta.pages) || 0;
  if (pages > 0) return page < pages ? page + 1 : undefined;
  const total = Number(meta.total) || 0;
  const loaded = allPages.reduce((sum, pageItem) => sum + (pageItem?.items?.length || 0), 0);
  return total > loaded ? page + 1 : undefined;
}

function flattenPages(data) {
  const seen = new Set();
  return (data?.pages || []).flatMap((page) => page?.items || []).filter((item) => {
    const key = String(item?._id || item?.id || item?.userId || item?.email || '');
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function useWorkspaceMembers(options = {}) {
  const queryClient = useQueryClient();
  const { workspaceId } = useWorkspace();
  const { hasAnyRole } = usePermission();
  const canManageMembers = hasAnyRole(['owner', 'admin']);

  const view = options.view === 'invites' ? 'invites' : 'members';
  const limit = Math.min(Math.max(Number(options.limit) || 8, 1), 100);
  const search = String(options.search || '').trim();
  const role = String(options.role || 'all');

  const membersParams = useMemo(() => {
    const params = { limit, sort: 'newest' };
    if (search) params.search = search;
    if (role !== 'all') params.role = role;
    return params;
  }, [limit, role, search]);

  const invitesParams = useMemo(() => {
    const params = { status: 'pending', limit, sort: 'newest' };
    if (search) params.search = search;
    if (role !== 'all' && role !== 'owner') params.role = role;
    return params;
  }, [limit, role, search]);

  const membersQuery = useInfiniteQuery({
    queryKey: ['workspace', workspaceId, 'members', membersParams],
    queryFn: ({ pageParam = 1, signal }) =>
      workspacesApi.members(workspaceId, { ...membersParams, page: pageParam }, signal).then((payload) => ({
        items: payload.data || [],
        meta: toQueryMeta(payload.meta, pageParam, limit),
      })),
    getNextPageParam: nextPageParam,
    enabled: Boolean(workspaceId),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    initialPageParam: 1,
  });

  const invitesQuery = useInfiniteQuery({
    queryKey: ['workspace', workspaceId, 'invites', invitesParams],
    queryFn: ({ pageParam = 1, signal }) =>
      invitesApi.list(workspaceId, { ...invitesParams, page: pageParam }, signal).then((payload) => ({
        items: payload.data || [],
        meta: toQueryMeta(payload.meta, pageParam, limit),
      })),
    getNextPageParam: nextPageParam,
    enabled: Boolean(workspaceId) && canManageMembers,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    initialPageParam: 1,
  });

  const inviteMutation = useMutation({
    mutationFn: (payload) => invitesApi.create(workspaceId, payload).then((response) => response.data),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['workspace', workspaceId, 'invites'] }),
        queryClient.invalidateQueries({ queryKey: ['workspace', workspaceId, 'members'] }),
      ]);
    },
  });

  const revokeMutation = useMutation({
    mutationFn: (inviteId) => invitesApi.revoke(workspaceId, inviteId).then((response) => response.data),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['workspace', workspaceId, 'invites'] });
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ userId, role: nextRole }) =>
      workspacesApi.updateMember(workspaceId, userId, { role: nextRole }).then((response) => response.data),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['workspace', workspaceId, 'members'] });
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: (userId) => workspacesApi.removeMember(workspaceId, userId).then((response) => response.data),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['workspace', workspaceId, 'members'] });
    },
  });

  const activeQuery = view === 'invites' ? invitesQuery : membersQuery;
  const activeMeta = activeQuery.data?.pages?.at(-1)?.meta || { ...DEFAULT_META, limit };

  return {
    members: flattenPages(membersQuery.data),
    invites: flattenPages(invitesQuery.data),
    listItems: flattenPages(activeQuery.data),
    listMeta: activeMeta,
    loadingMembers: membersQuery.isLoading,
    loadingInvites: invitesQuery.isLoading,
    loadingList: activeQuery.isLoading,
    loadingMoreList: activeQuery.isFetchingNextPage,
    hasMoreList: Boolean(activeQuery.hasNextPage),
    loadMoreList: activeQuery.fetchNextPage,
    membersError: membersQuery.error?.message || '',
    invitesError: invitesQuery.error?.message || '',
    listError: activeQuery.error?.message || '',
    canManageMembers,
    inviteMember: inviteMutation.mutateAsync,
    revokeInvite: revokeMutation.mutateAsync,
    updateRole: updateRoleMutation.mutateAsync,
    removeMember: removeMemberMutation.mutateAsync,
    inviteState: inviteMutation,
    revokeState: revokeMutation,
    updateRoleState: updateRoleMutation,
    removeMemberState: removeMemberMutation,
    refetchMembers: membersQuery.refetch,
    refetchInvites: invitesQuery.refetch,
  };
}
