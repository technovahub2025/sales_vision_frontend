import { useEffect, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { invitesApi, projectsApi, usersApi } from '../api';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { useSocket } from '../contexts/SocketContext';
import { EVENTS } from '../socket/events';
import { toRealtimeEvent } from '../socket/realtime';

function upsertMember(list, member) {
  const safe = Array.isArray(list) ? list : [];
  const index = safe.findIndex((item) => String(item.userId) === String(member.userId));
  if (index < 0) {
    return [...safe, member];
  }
  const next = [...safe];
  next[index] = { ...next[index], ...member };
  return next;
}

export function useProjectMembers(projectIdArg) {
  const queryClient = useQueryClient();
  const { workspaceId, projectId: projectIdFromContext } = useWorkspace();
  const { socket, joinWorkspace, leaveWorkspace, onReconnect } = useSocket();
  const projectId = projectIdArg || projectIdFromContext;

  const membersKey = useMemo(() => ['projects', workspaceId, projectId, 'members'], [workspaceId, projectId]);
  const usersKey = useMemo(() => ['workspace', workspaceId, 'users'], [workspaceId]);
  const invitesKey = useMemo(() => ['workspace', workspaceId, 'invites', 'pending'], [workspaceId]);

  const membersQuery = useQuery({
    queryKey: membersKey,
    queryFn: () => projectsApi.members(workspaceId, projectId).then((payload) => payload.data || []),
    enabled: Boolean(workspaceId && projectId),
    staleTime: 30_000,
  });

  const usersQuery = useQuery({
    queryKey: usersKey,
    queryFn: () => usersApi.list(workspaceId, { limit: 200, page: 1 }).then((payload) => payload.data || []),
    enabled: Boolean(workspaceId),
    staleTime: 60_000,
  });

  const invitesQuery = useQuery({
    queryKey: invitesKey,
    queryFn: () => invitesApi.list(workspaceId, { status: 'pending', page: 1, limit: 50 }).then((payload) => payload.data || []),
    enabled: Boolean(workspaceId),
    staleTime: 15_000,
  });

  useEffect(() => {
    if (!socket || !workspaceId || !projectId) {
      return;
    }

    const joinPayload = { workspaceId, projectId, modules: ['projects'] };
    joinWorkspace(joinPayload);

    const onRealtime = (raw) => {
      const evt = toRealtimeEvent(raw);
      if (String(evt.workspaceId || '') !== String(workspaceId)) return;
      const event = String(evt.event || '');
      if (!event.startsWith('project:')) return;

      const member = evt.payload || null;
      if (member?.projectId && String(member.projectId) !== String(projectId)) {
        return;
      }
      if (event === 'project:memberAdded') {
        if (!member?.userId) return;
        queryClient.setQueryData(membersKey, (previous) => upsertMember(previous, member));
        return;
      }
      if (event === 'project:memberRemoved') {
        if (!member?.userId) return;
        queryClient.setQueryData(membersKey, (previous) =>
          (Array.isArray(previous) ? previous : []).filter((item) => String(item.userId) !== String(member.userId)),
        );
        return;
      }
      if (event === 'project:updated' && member?.userId && member?.role) {
        queryClient.setQueryData(membersKey, (previous) =>
          (Array.isArray(previous) ? previous : []).map((item) =>
            String(item.userId) === String(member.userId) ? { ...item, role: member.role } : item,
          ),
        );
      }
    };

    socket.on(EVENTS.REALTIME_EVENT, onRealtime);
    const unsubscribeReconnect = onReconnect(() => {
      queryClient.invalidateQueries({ queryKey: membersKey });
      queryClient.invalidateQueries({ queryKey: invitesKey });
    });

    return () => {
      leaveWorkspace(joinPayload);
      socket.off(EVENTS.REALTIME_EVENT, onRealtime);
      unsubscribeReconnect();
    };
  }, [socket, workspaceId, projectId, joinWorkspace, leaveWorkspace, onReconnect, queryClient, membersKey, invitesKey]);

  const addMemberMutation = useMutation({
    mutationFn: ({ userId, role }) => projectsApi.addMember(workspaceId, projectId, { userId, role }),
    onSuccess: (response) => {
      const member = response?.data;
      if (!member) return;
      queryClient.setQueryData(membersKey, (previous) => upsertMember(previous, member));
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ userId, role }) => projectsApi.updateMemberRole(workspaceId, projectId, userId, { role }),
    onSuccess: (response, variables) => {
      const member = response?.data;
      queryClient.setQueryData(membersKey, (previous) => {
        const safe = Array.isArray(previous) ? previous : [];
        if (!member) {
          return safe.map((item) =>
            String(item.userId) === String(variables.userId)
              ? { ...item, role: variables.role }
              : item,
          );
        }
        return upsertMember(safe, member);
      });
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: ({ userId }) => projectsApi.removeMember(workspaceId, projectId, userId),
    onSuccess: (_response, variables) => {
      queryClient.setQueryData(membersKey, (previous) =>
        (Array.isArray(previous) ? previous : []).filter((item) => String(item.userId) !== String(variables.userId)),
      );
    },
  });

  const createInviteMutation = useMutation({
    mutationFn: ({ email, role }) => invitesApi.create(workspaceId, { email, role }),
    onSuccess: (response) => {
      const invite = response?.data;
      if (!invite) return;
      queryClient.setQueryData(invitesKey, (previous) => [invite, ...(Array.isArray(previous) ? previous : [])]);
    },
  });

  const revokeInviteMutation = useMutation({
    mutationFn: ({ inviteId }) => invitesApi.revoke(workspaceId, inviteId),
    onSuccess: (_response, variables) => {
      queryClient.setQueryData(invitesKey, (previous) =>
        (Array.isArray(previous) ? previous : []).filter((item) => String(item._id || item.id) !== String(variables.inviteId)),
      );
    },
  });

  const availableUsers = useMemo(() => {
    const members = Array.isArray(membersQuery.data) ? membersQuery.data : [];
    const existingIds = new Set(members.map((item) => String(item.userId)));
    const users = Array.isArray(usersQuery.data) ? usersQuery.data : [];
    return users.filter((user) => !existingIds.has(String(user._id)));
  }, [membersQuery.data, usersQuery.data]);

  return {
    projectId,
    members: membersQuery.data || [],
    pendingInvites: invitesQuery.data || [],
    availableUsers,
    loading: membersQuery.isLoading,
    usersLoading: usersQuery.isLoading,
    invitesLoading: invitesQuery.isLoading,
    error: membersQuery.error?.message || '',
    inviteError: invitesQuery.error?.message || createInviteMutation.error?.message || '',
    refresh: membersQuery.refetch,
    addMember: addMemberMutation.mutateAsync,
    updateRole: updateRoleMutation.mutateAsync,
    removeMember: removeMemberMutation.mutateAsync,
    createInvite: createInviteMutation.mutateAsync,
    revokeInvite: revokeInviteMutation.mutateAsync,
    addMemberState: addMemberMutation,
    updateRoleState: updateRoleMutation,
    removeMemberState: removeMemberMutation,
    createInviteState: createInviteMutation,
    revokeInviteState: revokeInviteMutation,
  };
}
