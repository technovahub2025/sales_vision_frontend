import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { invitesApi, workspacesApi } from '../api';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { usePermission } from './usePermission';

export function useWorkspaceMembers() {
  const queryClient = useQueryClient();
  const { workspaceId } = useWorkspace();
  const { hasAnyRole } = usePermission();
  const canManageMembers = hasAnyRole(['owner', 'admin']);

  const membersKey = useMemo(() => ['workspace', workspaceId, 'members'], [workspaceId]);
  const invitesKey = useMemo(() => ['workspace', workspaceId, 'invites'], [workspaceId]);

  const membersQuery = useQuery({
    queryKey: membersKey,
    queryFn: ({ signal }) => workspacesApi.members(workspaceId, signal).then((payload) => payload.data || []),
    enabled: Boolean(workspaceId),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    initialData: [],
  });

  const invitesQuery = useQuery({
    queryKey: invitesKey,
    queryFn: ({ signal }) => invitesApi.list(workspaceId, { status: 'pending', page: 1, limit: 50 }, signal).then((payload) => payload.data || []),
    enabled: Boolean(workspaceId) && canManageMembers,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    initialData: [],
  });

  const inviteMutation = useMutation({
    mutationFn: (payload) => invitesApi.create(workspaceId, payload).then((response) => response.data),
    onSuccess: (created) => {
      queryClient.setQueryData(invitesKey, (current = []) => [created, ...current]);
    },
  });

  const revokeMutation = useMutation({
    mutationFn: (inviteId) => invitesApi.revoke(workspaceId, inviteId).then((response) => response.data),
    onMutate: async (inviteId) => {
      await queryClient.cancelQueries({ queryKey: invitesKey });
      const previous = queryClient.getQueryData(invitesKey) || [];
      queryClient.setQueryData(
        invitesKey,
        (current = []) => current.filter((invite) => String(invite._id || invite.id) !== String(inviteId)),
      );
      return { previous };
    },
    onError: (_error, _inviteId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(invitesKey, context.previous);
      }
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ userId, role }) => workspacesApi.updateMember(workspaceId, userId, { role }).then((response) => response.data),
    onMutate: async ({ userId, role }) => {
      await queryClient.cancelQueries({ queryKey: membersKey });
      const previous = queryClient.getQueryData(membersKey) || [];
      queryClient.setQueryData(
        membersKey,
        (current = []) => current.map((member) => (String(member.userId) === String(userId) ? { ...member, role } : member)),
      );
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(membersKey, context.previous);
      }
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: (userId) => workspacesApi.removeMember(workspaceId, userId).then((response) => response.data),
    onMutate: async (userId) => {
      await queryClient.cancelQueries({ queryKey: membersKey });
      const previous = queryClient.getQueryData(membersKey) || [];
      queryClient.setQueryData(
        membersKey,
        (current = []) => current.filter((member) => String(member.userId) !== String(userId)),
      );
      return { previous };
    },
    onError: (_error, _userId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(membersKey, context.previous);
      }
    },
  });

  return {
    members: membersQuery.data || [],
    invites: invitesQuery.data || [],
    loadingMembers: membersQuery.isLoading || membersQuery.isFetching,
    loadingInvites: invitesQuery.isLoading || invitesQuery.isFetching,
    membersError: membersQuery.error?.message || '',
    invitesError: invitesQuery.error?.message || '',
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

