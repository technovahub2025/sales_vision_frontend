import { EVENTS } from '../socket/events';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { teamsApi } from '../api';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { useSocket } from '../contexts/SocketContext';
import { toRealtimeEvent } from '../socket/realtime';

function upsert(list, item) {
  const exists = list.some((row) => String(row._id || row.id) === String(item._id || item.id));
  if (exists) {
    return list.map((row) => (String(row._id || row.id) === String(item._id || item.id) ? { ...row, ...item } : row));
  }
  return [item, ...list];
}

export function useTeams(workspaceIdArg) {
  const { workspaceId: workspaceIdFromContext } = useWorkspace();
  const { socket, joinWorkspace, leaveWorkspace, onReconnect } = useSocket();
  const workspaceId = workspaceIdArg || workspaceIdFromContext;
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const hydrate = useCallback(async ({ silent = false } = {}) => {
    if (!workspaceId) return;
    if (!silent) {
      setLoading(true);
    }
    setError('');
    try {
      const response = await teamsApi.list(workspaceId, { page: 1, limit: 100 });
      setTeams(response.data || []);
    } catch (err) {
      if (!silent) {
        setError(err.message || 'Failed to load teams');
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, [workspaceId]);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!socket || !workspaceId) return undefined;
    const joinPayload = { workspaceId, modules: ['teams'] };
    joinWorkspace(joinPayload);

    const refreshSilent = () => hydrate({ silent: true });
    const onTeamUpdated = (payload) => {
      const item = payload?.data || payload?.payload;
      if (!item || (item.workspaceId && String(item.workspaceId) !== String(workspaceId))) return;
      if (item._id || item.id) {
        setTeams((prev) => upsert(prev, item));
      } else {
        refreshSilent();
      }
    };

    const onRealtime = (raw) => {
      const evt = toRealtimeEvent(raw);
      if (String(evt.workspaceId || '') !== String(workspaceId)) return;
      if (evt.entity !== 'team') return;
      if (evt.event.endsWith(':deleted')) {
        setTeams((prev) => prev.filter((row) => String(row._id || row.id) !== String(evt.entityId)));
        return;
      }
      if (evt.payload) {
        setTeams((prev) => upsert(prev, evt.payload));
      }
    };

    socket.on(EVENTS.TEAM_UPDATED, onTeamUpdated);
    socket.on(EVENTS.TEAM_MEMBER_CHANGED, refreshSilent);
    socket.on(EVENTS.REALTIME_EVENT, onRealtime);
    const unsubscribeReconnect = onReconnect(refreshSilent);

    return () => {
      leaveWorkspace(joinPayload);
      socket.off(EVENTS.TEAM_UPDATED, onTeamUpdated);
      socket.off(EVENTS.TEAM_MEMBER_CHANGED, refreshSilent);
      socket.off(EVENTS.REALTIME_EVENT, onRealtime);
      unsubscribeReconnect();
    };
  }, [socket, workspaceId, joinWorkspace, leaveWorkspace, hydrate, onReconnect]);

  const createTeam = useCallback(async (payload) => {
    if (!workspaceId) return null;
    const response = await teamsApi.create(workspaceId, payload);
    const created = response.data || null;
    if (created) setTeams((prev) => upsert(prev, created));
    return created;
  }, [workspaceId]);

  const updateTeam = useCallback(async (teamId, payload) => {
    if (!workspaceId) return null;
    const response = await teamsApi.update(workspaceId, teamId, payload);
    const updated = response.data || null;
    if (updated) setTeams((prev) => upsert(prev, updated));
    return updated;
  }, [workspaceId]);

  const addTeamMember = useCallback(async (teamId, userId) => {
    if (!workspaceId) return null;
    const response = await teamsApi.addMember(workspaceId, teamId, { userId });
    return response.data || null;
  }, [workspaceId]);

  const removeTeamMember = useCallback(async (teamId, userId) => {
    if (!workspaceId) return null;
    const response = await teamsApi.removeMember(workspaceId, teamId, userId);
    return response.data || null;
  }, [workspaceId]);

  return useMemo(
    () => ({
      teams,
      loading,
      error,
      refresh: hydrate,
      createTeam,
      updateTeam,
      addTeamMember,
      removeTeamMember,
    }),
    [teams, loading, error, hydrate, createTeam, updateTeam, addTeamMember, removeTeamMember],
  );
}
