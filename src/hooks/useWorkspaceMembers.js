import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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

export function useWorkspaceMembers(options = {}) {
  const queryClient = useQueryClient();
  const { workspaceId } = useWorkspace();
  const { hasAnyRole } = usePermission();
  const canManageMembers = hasAnyRole(['owner', 'admin']);

  const view = options.view === 'invites' ? 'invites' : 'members';
  const page = Math.max(Number(options.page) || 1, 1);
  const limit = Math.min(Math.max(Number(options.limit) || 8, 1), 100);
  const search = String(options.search || '').trim();
  const role = String(options.role || 'all');

  const membersParams = useMemo(() => {
    const params = { page, limit };
    if (search) params.search = search;
    if (role !== 'all') params.role = role;
    return params;
  }, [limit, page, role, search]);

  const invitesParams = useMemo(() => {
    const params = { status: 'pending', page, limit };
    if (search) params.search = search;
    if (role !== 'all' && role !== 'owner') params.role = role;
    return params;
  }, [limit, page, role, search]);

  const membersQuery = useQuery({
    queryKey: ['workspace', workspaceId, 'members', membersParams],
    queryFn: ({ signal }) =>
      workspacesApi.members(workspaceId, membersParams, signal).then((payload) => ({
        items: payload.data || [],
        meta: toQueryMeta(payload.meta, page, limit),
      })),
    enabled: Boolean(workspaceId),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    initialData: { items: [], meta: { ...DEFAULT_META } },
  });

  const invitesQuery = useQuery({
    queryKey: ['workspace', workspaceId, 'invites', invitesParams],
    queryFn: ({ signal }) =>
      invitesApi.list(workspaceId, invitesParams, signal).then((payload) => ({
        items: payload.data || [],
        meta: toQueryMeta(payload.meta, page, limit),
      })),
    enabled: Boolean(workspaceId) && canManageMembers,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    initialData: { items: [], meta: { ...DEFAULT_META } },
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

  return {
    members: membersQuery.data?.items || [],
    invites: invitesQuery.data?.items || [],
    listItems: activeQuery.data?.items || [],
    listMeta: activeQuery.data?.meta || { ...DEFAULT_META, page, limit },
    loadingMembers: membersQuery.isLoading || membersQuery.isFetching,
    loadingInvites: invitesQuery.isLoading || invitesQuery.isFetching,
    loadingList: activeQuery.isLoading || activeQuery.isFetching,
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
