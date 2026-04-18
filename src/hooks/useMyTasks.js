import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { myTasksApi, tasksApi } from '../api';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { useSocket } from '../contexts/SocketContext';
import { useAuth } from '../contexts/AuthContext';
import { EVENTS } from '../socket/events';

const GROUP_BY = ['dueDate', 'status', 'priority', 'project'];
const DUE_DATE_ORDER = ['overdue', 'today', 'thisWeek', 'upcoming', 'noDueDate'];
const STATUS_ORDER = ['todo', 'in_progress', 'in_review', 'blocked', 'completed', 'done', 'closed'];
const PRIORITY_ORDER = ['critical', 'high', 'medium', 'low', 'none'];

function resolveGroupBy(value) {
  const key = String(value || '');
  return GROUP_BY.includes(key) ? key : 'dueDate';
}

function toDateOnly(value) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function dueDateKey(task) {
  if (!task?.dueDate) return 'noDueDate';
  const today = toDateOnly(new Date());
  const due = toDateOnly(task.dueDate);
  const diff = Math.floor((due.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
  if (diff < 0) return 'overdue';
  if (diff === 0) return 'today';
  if (diff <= 7) return 'thisWeek';
  return 'upcoming';
}

function groupKeyForTask(task, groupBy) {
  if (groupBy === 'status') return String(task.status || 'todo');
  if (groupBy === 'priority') return String(task.priority || 'medium');
  if (groupBy === 'project') return String(task.projectId || 'unknown');
  return dueDateKey(task);
}

function labelForGroup(groupBy, key, sampleTask) {
  if (groupBy === 'status') return String(key || 'todo').replace(/_/g, ' ');
  if (groupBy === 'priority') return String(key || 'medium');
  if (groupBy === 'project') return sampleTask?.projectName || 'Unknown project';
  if (key === 'overdue') return 'Overdue';
  if (key === 'today') return 'Today';
  if (key === 'thisWeek') return 'This Week';
  if (key === 'upcoming') return 'Upcoming';
  if (key === 'noDueDate') return 'No due date';
  return 'Other';
}

function buildGroups(tasks, groupBy) {
  const resolvedGroupBy = resolveGroupBy(groupBy);
  const map = new Map();
  for (const task of tasks) {
    const key = groupKeyForTask(task, resolvedGroupBy);
    if (!map.has(key)) {
      map.set(key, { key, label: labelForGroup(resolvedGroupBy, key, task), items: [] });
    }
    map.get(key).items.push(task);
  }

  let groups = Array.from(map.values());
  if (resolvedGroupBy === 'dueDate') {
    groups = DUE_DATE_ORDER.filter((key) => map.has(key)).map((key) => map.get(key));
  } else if (resolvedGroupBy === 'status') {
    const ordered = STATUS_ORDER.filter((key) => map.has(key)).map((key) => map.get(key));
    const rest = groups.filter((group) => !STATUS_ORDER.includes(group.key)).sort((a, b) => a.label.localeCompare(b.label));
    groups = [...ordered, ...rest];
  } else if (resolvedGroupBy === 'priority') {
    const ordered = PRIORITY_ORDER.filter((key) => map.has(key)).map((key) => map.get(key));
    const rest = groups.filter((group) => !PRIORITY_ORDER.includes(group.key)).sort((a, b) => a.label.localeCompare(b.label));
    groups = [...ordered, ...rest];
  } else if (resolvedGroupBy === 'project') {
    groups = groups.sort((a, b) => a.label.localeCompare(b.label));
  }

  return groups;
}

function flattenGroups(groups) {
  return (Array.isArray(groups) ? groups : []).flatMap((group) => group.items || []);
}

function normalizeGroups(rawGroups, groupBy) {
  if (Array.isArray(rawGroups)) return rawGroups;
  if (rawGroups && typeof rawGroups === 'object') {
    return buildGroups(Object.values(rawGroups).flat(), groupBy);
  }
  return buildGroups([], groupBy);
}

function patchTaskInGroups(groups, groupBy, task) {
  const current = flattenGroups(groups);
  const existing = current.find((item) => String(item._id) === String(task._id));
  const all = current.filter((item) => String(item._id) !== String(task._id));
  all.push({ ...(existing || {}), ...task });
  return buildGroups(all, groupBy);
}

function removeTaskInGroups(groups, groupBy, taskId) {
  const all = flattenGroups(groups).filter((item) => String(item._id) !== String(taskId));
  return buildGroups(all, groupBy);
}

function normalizeTimer(timer, nowIso = new Date().toISOString()) {
  if (!timer || timer.active === false) return null;
  return {
    active: true,
    paused: Boolean(timer.paused),
    startedAt: timer.startedAt || null,
    elapsedSeconds: Number(timer.elapsedSeconds || 0),
    employeeId: timer.employeeId || null,
    logId: timer.logId || null,
    snapshotAt: timer.snapshotAt || nowIso,
  };
}

function computePausedSeconds(pausedIntervals = [], nowMs = Date.now()) {
  return (Array.isArray(pausedIntervals) ? pausedIntervals : []).reduce((sum, interval) => {
    if (!interval?.pausedAt) return sum;
    const pausedAtMs = new Date(interval.pausedAt).getTime();
    if (Number.isNaN(pausedAtMs)) return sum;
    const resumedAtMs = interval?.resumedAt ? new Date(interval.resumedAt).getTime() : nowMs;
    if (Number.isNaN(resumedAtMs) || resumedAtMs <= pausedAtMs) return sum;
    return sum + Math.floor((resumedAtMs - pausedAtMs) / 1000);
  }, 0);
}

function buildTimerFromLog(log, nowMs = Date.now()) {
  const startedMs = new Date(log?.startTime).getTime();
  if (Number.isNaN(startedMs)) {
    return null;
  }
  const totalSeconds = Math.max(0, Math.floor((nowMs - startedMs) / 1000));
  const pausedSeconds = computePausedSeconds(log?.pausedIntervals || [], nowMs);
  return normalizeTimer({
    active: true,
    paused: Boolean(log?.isPaused),
    startedAt: log?.startTime || null,
    elapsedSeconds: Math.max(0, totalSeconds - pausedSeconds),
    employeeId: log?.employeeId ? String(log.employeeId) : null,
    logId: log?._id ? String(log._id) : null,
  });
}

function getElapsedSecondsForTimer(timer, nowMs = Date.now(), snapshotAtOverride = null) {
  if (!timer?.active) return 0;
  const base = Math.max(0, Number(timer.elapsedSeconds || 0));
  if (timer.paused) return base;
  const snapshotMs = new Date(snapshotAtOverride || timer.snapshotAt || timer.startedAt || Date.now()).getTime();
  if (Number.isNaN(snapshotMs)) return base;
  const delta = Math.max(0, Math.floor((nowMs - snapshotMs) / 1000));
  return base + delta;
}

function getDurationSecondsFromLog(log) {
  if (!log) return 0;
  if (Number.isFinite(Number(log.durationSecs))) return Math.max(0, Number(log.durationSecs));
  if (Number.isFinite(Number(log.durationSeconds))) return Math.max(0, Number(log.durationSeconds));
  if (Number.isFinite(Number(log.elapsedSeconds))) return Math.max(0, Number(log.elapsedSeconds));
  if (Number.isFinite(Number(log.durationMins))) return Math.max(0, Math.round(Number(log.durationMins) * 60));
  const startMs = new Date(log.startTime).getTime();
  const endMs = new Date(log.endTime).getTime();
  if (!Number.isNaN(startMs) && !Number.isNaN(endMs) && endMs > startMs) {
    return Math.max(0, Math.floor((endMs - startMs) / 1000) - computePausedSeconds(log.pausedIntervals || [], endMs));
  }
  return 0;
}

function getStoredTrackedSeconds(task) {
  const candidates = [
    task?.trackedSeconds,
    task?.totalTrackedSeconds,
    task?.elapsedSeconds,
    Number(task?.durationMins) * 60,
    Number(task?.timeSpentMins) * 60,
    Number(task?.totalMins) * 60,
  ];
  for (const value of candidates) {
    const numeric = Number(value);
    if (Number.isFinite(numeric) && numeric > 0) return Math.max(0, Math.floor(numeric));
  }
  return 0;
}

export function useMyTasks() {
  const queryClient = useQueryClient();
  const { workspaceId } = useWorkspace();
  const { user } = useAuth();
  const { socket, joinWorkspace } = useSocket();

  const userId = user?.id || '';
  const [query, setQuery] = useState({ view: 'list', filter: 'all', sort: 'dueDate', groupBy: 'dueDate', includeArchived: 'false', onlyArchived: 'false' });
  const [timerTick, setTimerTick] = useState(() => Date.now());
  const timerSnapshotRef = useRef(new Map());
  const timerEventTimeoutsRef = useRef(new Map());
  const processedStopLogIdsRef = useRef(new Set());
  const currentGroupBy = resolveGroupBy(query.groupBy);
  const lastQueryRef = useRef(query);

  const queryKey = [
    'myTasks',
    workspaceId,
    userId,
    query.filter,
    query.sort,
    query.view,
    currentGroupBy,
    query.issueType || 'all',
    query.includeArchived || 'false',
    query.onlyArchived || 'false',
  ];

  const tasksQuery = useQuery({
    queryKey,
    queryFn: () => myTasksApi.list(workspaceId, { ...query }).then((payload) => payload),
    enabled: Boolean(workspaceId && userId),
    staleTime: 30_000,
  });

  useEffect(() => {
    lastQueryRef.current = query;
  }, [query]);

  useEffect(() => {
    if (!socket || !workspaceId || !userId) {
      return;
    }

    joinWorkspace({ workspaceId, userId, modules: ['tasks', 'timeLogs'] });

    const patchTaskTimer = (taskId, nextTimer, nextPatch = null) => {
      queryClient.setQueryData(queryKey, (previous) => {
        const prevData = previous?.data || previous || {};
        const groups = normalizeGroups(prevData?.data?.groups || prevData?.groups || prevData, currentGroupBy);
        const task = flattenGroups(groups).find((item) => String(item._id) === String(taskId));
        if (!task) return previous;
        const resolvedTimer = normalizeTimer(
          typeof nextTimer === 'function' ? nextTimer(task.timer || null, task) : nextTimer,
        );
        const resolvedPatch = typeof nextPatch === 'function' ? nextPatch(task) : (nextPatch || {});
        const nextGroups = patchTaskInGroups(groups, currentGroupBy, { ...task, ...resolvedPatch, timer: resolvedTimer });
        return { ...(previous || {}), data: { ...(prevData?.data || {}), groups: nextGroups }, meta: prevData?.meta || {} };
      });
    };

    const onAssigned = (payload) => {
      const task = payload?.data;
      if (!task) return;
      queryClient.setQueryData(queryKey, (previous) => {
        const prevData = previous?.data || previous || {};
        const groups = normalizeGroups(prevData?.data?.groups || prevData?.groups || prevData, currentGroupBy);
        const nextGroups = patchTaskInGroups(groups, currentGroupBy, task);
        const meta = prevData?.meta || {};
        return {
          ...(previous || {}),
          data: { ...(prevData?.data || {}), groups: nextGroups },
          meta: {
            ...meta,
            total: Math.max(Number(meta.total || 0), flattenGroups(nextGroups).length),
            openCount: Number(meta.openCount || 0) + 1,
          },
        };
      });
    };

    const onUpdated = (payload) => {
      const task = payload?.data;
      if (!task) return;
      queryClient.setQueryData(queryKey, (previous) => {
        const prevData = previous?.data || previous || {};
        const groups = normalizeGroups(prevData?.data?.groups || prevData?.groups || prevData, currentGroupBy);
        const nextGroups = patchTaskInGroups(groups, currentGroupBy, task);
        return { ...(previous || {}), data: { ...(prevData?.data || {}), groups: nextGroups }, meta: prevData?.meta || {} };
      });
    };

    const onDeleted = (payload) => {
      const removed = payload?.data;
      if (!removed?._id) return;
      queryClient.setQueryData(queryKey, (previous) => {
        const prevData = previous?.data || previous || {};
        const groups = normalizeGroups(prevData?.data?.groups || prevData?.groups || prevData, currentGroupBy);
        const nextGroups = removeTaskInGroups(groups, currentGroupBy, removed._id);
        const nextTotal = flattenGroups(nextGroups).length;
        return {
          ...(previous || {}),
          data: { ...(prevData?.data || {}), groups: nextGroups },
          meta: { ...(prevData?.meta || {}), total: nextTotal, openCount: Math.max(0, Number(prevData?.meta?.openCount || 0) - 1) },
        };
      });
    };

    const isOwnTimerEvent = (log) => {
      const eventUserId = log?.userId ? String(log.userId) : '';
      if (!eventUserId) return null;
      return eventUserId === String(userId);
    };

    const invalidateMyTasks = () => {
      queryClient.invalidateQueries({ queryKey: ['myTasks', workspaceId, userId] });
    };

    const clearScheduledTimerEvent = (taskId) => {
      const key = String(taskId || '');
      const existing = timerEventTimeoutsRef.current.get(key);
      if (existing) {
        window.clearTimeout(existing);
        timerEventTimeoutsRef.current.delete(key);
      }
    };

    const scheduleTimerEvent = (taskId, handler) => {
      const key = String(taskId || '');
      if (!key || typeof handler !== 'function') return;
      clearScheduledTimerEvent(key);
      const timeoutId = window.setTimeout(() => {
        timerEventTimeoutsRef.current.delete(key);
        handler();
      }, 120);
      timerEventTimeoutsRef.current.set(key, timeoutId);
    };

    const onTimerStarted = (payload) => {
      const log = payload?.data;
      const taskId = log?.taskId ? String(log.taskId) : '';
      if (!taskId) return;
      const ownEvent = isOwnTimerEvent(log);
      if (ownEvent === false) return;
      if (ownEvent === null) {
        invalidateMyTasks();
        return;
      }
      scheduleTimerEvent(taskId, () => patchTaskTimer(taskId, buildTimerFromLog(log), { status: 'in_progress' }));
    };

    const onTimerPaused = (payload) => {
      const log = payload?.data;
      const taskId = log?.taskId ? String(log.taskId) : '';
      if (!taskId) return;
      const ownEvent = isOwnTimerEvent(log);
      if (ownEvent === false) return;
      if (ownEvent === null) {
        invalidateMyTasks();
        return;
      }
      scheduleTimerEvent(taskId, () => patchTaskTimer(taskId, buildTimerFromLog(log)));
    };

    const onTimerResumed = (payload) => {
      const log = payload?.data;
      const taskId = log?.taskId ? String(log.taskId) : '';
      if (!taskId) return;
      const ownEvent = isOwnTimerEvent(log);
      if (ownEvent === false) return;
      if (ownEvent === null) {
        invalidateMyTasks();
        return;
      }
      scheduleTimerEvent(taskId, () => patchTaskTimer(taskId, buildTimerFromLog(log)));
    };

    const onTimerStopped = (payload) => {
      const log = payload?.data;
      const taskId = log?.taskId ? String(log.taskId) : '';
      if (!taskId) return;
      const logId = log?._id ? String(log._id) : '';
      const ownEvent = isOwnTimerEvent(log);
      if (ownEvent === false) return;
      if (ownEvent === null) {
        invalidateMyTasks();
        return;
      }
      if (logId && processedStopLogIdsRef.current.has(logId)) {
        processedStopLogIdsRef.current.delete(logId);
        scheduleTimerEvent(taskId, () => patchTaskTimer(taskId, null));
        return;
      }
      scheduleTimerEvent(taskId, () =>
        patchTaskTimer(taskId, null, (task) => {
          const sessionSeconds = getDurationSecondsFromLog(log);
          return {
            trackedSeconds: Math.max(0, getStoredTrackedSeconds(task) + sessionSeconds),
          };
        }),
      );
    };

    socket.on(EVENTS.TASK_ASSIGNED, onAssigned);
    socket.on(EVENTS.TASK_UPDATED, onUpdated);
    socket.on(EVENTS.TASK_DELETED, onDeleted);
    socket.on(EVENTS.TASK_UNASSIGNED, onDeleted);
    socket.on(EVENTS.TIMER_STARTED, onTimerStarted);
    socket.on(EVENTS.TIMER_PAUSED, onTimerPaused);
    socket.on(EVENTS.TIMER_RESUMED, onTimerResumed);
    socket.on(EVENTS.TIMER_STOPPED, onTimerStopped);

    return () => {
      socket.off(EVENTS.TASK_ASSIGNED, onAssigned);
      socket.off(EVENTS.TASK_UPDATED, onUpdated);
      socket.off(EVENTS.TASK_DELETED, onDeleted);
      socket.off(EVENTS.TASK_UNASSIGNED, onDeleted);
      socket.off(EVENTS.TIMER_STARTED, onTimerStarted);
      socket.off(EVENTS.TIMER_PAUSED, onTimerPaused);
      socket.off(EVENTS.TIMER_RESUMED, onTimerResumed);
      socket.off(EVENTS.TIMER_STOPPED, onTimerStopped);
      for (const timeoutId of timerEventTimeoutsRef.current.values()) {
        window.clearTimeout(timeoutId);
      }
      timerEventTimeoutsRef.current.clear();
    };
  }, [socket, workspaceId, userId, joinWorkspace, queryClient, queryKey, currentGroupBy]);

  const updateMutation = useMutation({
    mutationFn: ({ taskId, patch }) => myTasksApi.patch(workspaceId, taskId, patch),
    onMutate: async ({ taskId, patch }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData(queryKey);

      queryClient.setQueryData(queryKey, (current) => {
        const currentData = current?.data || current || {};
        const groups = normalizeGroups(currentData?.data?.groups || currentData?.groups || currentData, currentGroupBy);
        const task = flattenGroups(groups).find((item) => String(item._id) === String(taskId));
        if (!task) return current;
        const optimistic = { ...task, ...patch, updatedAt: new Date().toISOString() };
        const nextGroups = patchTaskInGroups(groups, currentGroupBy, optimistic);
        return { ...(current || {}), data: { ...(currentData?.data || {}), groups: nextGroups }, meta: currentData?.meta || {} };
      });

      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
    },
    onSuccess: (response) => {
      const task = response?.data;
      if (!task) return;
      queryClient.setQueryData(queryKey, (current) => {
        const currentData = current?.data || current || {};
        const groups = normalizeGroups(currentData?.data?.groups || currentData?.groups || currentData, currentGroupBy);
        const nextGroups = patchTaskInGroups(groups, currentGroupBy, task);
        return { ...(current || {}), data: { ...(currentData?.data || {}), groups: nextGroups }, meta: currentData?.meta || {} };
      });
    },
  });

  const quickCreateMutation = useMutation({
    mutationFn: (payload) => myTasksApi.quickCreate(workspaceId, payload),
    onSuccess: (response) => {
      const task = response?.data;
      if (!task) return;
      queryClient.setQueryData(queryKey, (current) => {
        const currentData = current?.data || current || {};
        const groups = normalizeGroups(currentData?.data?.groups || currentData?.groups || currentData, currentGroupBy);
        const nextGroups = patchTaskInGroups(groups, currentGroupBy, task);
        const nextTotal = flattenGroups(nextGroups).length;
        return {
          ...(current || {}),
          data: { ...(currentData?.data || {}), groups: nextGroups },
          meta: {
            ...(currentData?.meta || {}),
            total: nextTotal,
            openCount: Number(currentData?.meta?.openCount || 0) + 1,
          },
        };
      });
    },
  });

  const reorderMutation = useMutation({
    mutationFn: ({ taskId, newPosition, groupKey }) => myTasksApi.reorder(workspaceId, { taskId, newPosition, groupKey }),
    onMutate: async ({ taskId, newPosition, groupKey }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData(queryKey);
      queryClient.setQueryData(queryKey, (current) => {
        const currentData = current?.data || current || {};
        const groups = normalizeGroups(currentData?.data?.groups || currentData?.groups || currentData, currentGroupBy);
        const nextGroups = groups.map((group) => {
          if (String(group.key) !== String(groupKey)) return group;
          const items = [...(group.items || [])];
          const oldIndex = items.findIndex((item) => String(item._id) === String(taskId));
          const clamped = Math.max(0, Math.min(Number(newPosition) || 0, items.length - 1));
          if (oldIndex < 0 || oldIndex === clamped) return group;
          const [moved] = items.splice(oldIndex, 1);
          items.splice(clamped, 0, moved);
          const updatedItems = items.map((item, index) => ({ ...item, personalOrder: index }));
          return { ...group, items: updatedItems };
        });
        return { ...(current || {}), data: { ...(currentData?.data || {}), groups: nextGroups }, meta: currentData?.meta || {} };
      });
      return { previous };
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous);
    },
  });

  const bulkUpdateMutation = useMutation({
    mutationFn: ({ taskIds, updates, action }) => tasksApi.bulkUpdate(workspaceId, { taskIds, updates, action }),
    onMutate: async ({ taskIds, updates, action }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData(queryKey);
      queryClient.setQueryData(queryKey, (current) => {
        const currentData = current?.data || current || {};
        const groups = normalizeGroups(currentData?.data?.groups || currentData?.groups || currentData, currentGroupBy);
        if (action === 'delete') {
          const nextGroups = buildGroups(
            flattenGroups(groups).filter((task) => !taskIds.includes(String(task._id))),
            currentGroupBy,
          );
          return { ...(current || {}), data: { ...(currentData?.data || {}), groups: nextGroups }, meta: currentData?.meta || {} };
        }
        const updated = flattenGroups(groups).map((task) =>
          taskIds.includes(String(task._id)) ? { ...task, ...updates, updatedAt: new Date().toISOString() } : task,
        );
        const nextGroups = buildGroups(updated, currentGroupBy);
        return { ...(current || {}), data: { ...(currentData?.data || {}), groups: nextGroups }, meta: currentData?.meta || {} };
      });
      return { previous };
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous);
    },
  });

  const patchTaskTimerInCache = useCallback((taskId, nextTimer, nextPatch = null) => {
    queryClient.setQueryData(queryKey, (previous) => {
      const prevData = previous?.data || previous || {};
      const groups = normalizeGroups(prevData?.data?.groups || prevData?.groups || prevData, currentGroupBy);
      const task = flattenGroups(groups).find((item) => String(item._id) === String(taskId));
      if (!task) return previous;
      const resolvedTimer = normalizeTimer(
        typeof nextTimer === 'function' ? nextTimer(task.timer || null, task) : nextTimer,
      );
      const resolvedPatch = typeof nextPatch === 'function' ? nextPatch(task) : (nextPatch || {});
      const nextGroups = patchTaskInGroups(groups, currentGroupBy, { ...task, ...resolvedPatch, timer: resolvedTimer });
      return { ...(previous || {}), data: { ...(prevData?.data || {}), groups: nextGroups }, meta: prevData?.meta || {} };
    });
  }, [queryClient, queryKey, currentGroupBy]);

  const startTimerMutation = useMutation({
    mutationFn: ({ taskId, actorId }) =>
      tasksApi.startTimer(workspaceId, taskId, { userId: actorId }),
    onSuccess: async (response, variables) => {
      patchTaskTimerInCache(variables.taskId, buildTimerFromLog(response?.data || {}), { status: 'in_progress' });
      try {
        await tasksApi.updateStatus(workspaceId, variables.taskId, 'in_progress');
      } catch {
        // Optimistic status update already applied; avoid blocking timer start on status patch errors.
      }
      queryClient.invalidateQueries({ queryKey: ['myTasks', workspaceId, userId] });
    },
  });

  const stopTimerMutation = useMutation({
    mutationFn: ({ taskId, actorId }) =>
      tasksApi.stopTimer(workspaceId, taskId, { userId: actorId }),
    onSuccess: (response, variables) => {
      const stopLogId = response?.data?._id ? String(response.data._id) : '';
      if (stopLogId) {
        processedStopLogIdsRef.current.add(stopLogId);
        if (processedStopLogIdsRef.current.size > 200) {
          const first = processedStopLogIdsRef.current.values().next().value;
          if (first) processedStopLogIdsRef.current.delete(first);
        }
      }
      const sessionSeconds = getDurationSecondsFromLog(response?.data || {});
      patchTaskTimerInCache(variables.taskId, null, (task) => ({
        trackedSeconds: Math.max(0, getStoredTrackedSeconds(task) + sessionSeconds),
      }));
      queryClient.invalidateQueries({ queryKey: ['myTasks', workspaceId, userId] });
    },
    onError: (error, variables) => {
      if (error.message?.includes('No active timer found')) {
        patchTaskTimerInCache(variables.taskId, null);
      }
    },
  });

  const pauseTimerMutation = useMutation({
    mutationFn: ({ taskId, actorId }) =>
      tasksApi.pauseTimer(workspaceId, taskId, { userId: actorId }),
    onSuccess: (response, variables) => {
      patchTaskTimerInCache(variables.taskId, buildTimerFromLog(response?.data || {}));
      queryClient.invalidateQueries({ queryKey: ['myTasks', workspaceId, userId] });
    },
    onError: (error, variables) => {
      if (error.message?.includes('No active timer found')) {
        patchTaskTimerInCache(variables.taskId, null);
      }
    },
  });

  const resumeTimerMutation = useMutation({
    mutationFn: ({ taskId, actorId }) =>
      tasksApi.resumeTimer(workspaceId, taskId, { userId: actorId }),
    onSuccess: (response, variables) => {
      patchTaskTimerInCache(variables.taskId, buildTimerFromLog(response?.data || {}));
      queryClient.invalidateQueries({ queryKey: ['myTasks', workspaceId, userId] });
    },
    onError: (error, variables) => {
      if (error.message?.includes('No paused timer found')) {
        patchTaskTimerInCache(variables.taskId, null);
      }
    },
  });

  const fetchTasks = useCallback(async (overrides = {}) => {
    setQuery((current) => ({ ...current, ...overrides }));
  }, []);

  const groups = normalizeGroups(tasksQuery.data?.data?.groups || tasksQuery.data?.data || [], currentGroupBy);
  const flatTasks = flattenGroups(groups);

  useEffect(() => {
    const activeIds = new Set();
    const nowIso = new Date().toISOString();
    for (const task of flatTasks) {
      const taskId = String(task._id);
      const timer = task?.timer;
      if (!timer?.active) continue;
      activeIds.add(taskId);
      if (timer.snapshotAt) {
        timerSnapshotRef.current.set(taskId, timer.snapshotAt);
      } else if (!timerSnapshotRef.current.has(taskId)) {
        timerSnapshotRef.current.set(taskId, nowIso);
      }
    }
    for (const existingId of Array.from(timerSnapshotRef.current.keys())) {
      if (!activeIds.has(existingId)) {
        timerSnapshotRef.current.delete(existingId);
      }
    }
  }, [flatTasks]);

  const taskById = useMemo(
    () => new Map(flatTasks.map((task) => [String(task._id), task])),
    [flatTasks],
  );

  const hasRunningTimers = useMemo(
    () => flatTasks.some((task) => task?.timer?.active && !task?.timer?.paused),
    [flatTasks],
  );

  useEffect(() => {
    if (!hasRunningTimers) return undefined;
    const id = window.setInterval(() => setTimerTick(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [hasRunningTimers]);

  return useMemo(
    () => ({
      tasks: flatTasks,
      groups,
      loading: tasksQuery.isLoading,
      error: tasksQuery.error?.message || '',
      meta: tasksQuery.data?.meta || { total: flatTasks.length, openCount: 0, groupBy: currentGroupBy },
      fetchTasks,
      reorderTask: (payload) => reorderMutation.mutateAsync(payload),
      quickCreateTask: (payload) => quickCreateMutation.mutateAsync(payload).then((res) => res?.data || null),
      updateMyTask: (taskId, patch) => updateMutation.mutateAsync({ taskId, patch }).then((res) => res?.data || null),
      updateManyTasks: (taskIds, patch = {}, action = undefined) =>
        bulkUpdateMutation.mutateAsync({ taskIds, updates: patch, action }),
      isTimerActive: (taskId) => {
        const timer = taskById.get(String(taskId))?.timer;
        return Boolean(timer?.active && !timer?.paused);
      },
      isTimerPaused: (taskId) => {
        const timer = taskById.get(String(taskId))?.timer;
        return Boolean(timer?.active && timer?.paused);
      },
      getTaskElapsedSeconds: (taskId) => {
        const task = taskById.get(String(taskId));
        const timer = task?.timer;
        const snapshotAt = timerSnapshotRef.current.get(String(taskId)) || null;
        if (timer?.active) {
          return getElapsedSecondsForTimer(timer, timerTick, snapshotAt);
        }
        return getStoredTrackedSeconds(task);
      },
      startTaskTimer: (taskId, actorId) => startTimerMutation.mutateAsync({ taskId, actorId }),
      stopTaskTimer: (taskId, actorId) => stopTimerMutation.mutateAsync({ taskId, actorId }),
      pauseTaskTimer: (taskId, actorId) => pauseTimerMutation.mutateAsync({ taskId, actorId }),
      resumeTaskTimer: (taskId, actorId) => resumeTimerMutation.mutateAsync({ taskId, actorId }),
      quickCreateState: quickCreateMutation,
      updateState: updateMutation,
      bulkUpdateState: bulkUpdateMutation,
      timerState: {
        starting: startTimerMutation.isPending,
        stopping: stopTimerMutation.isPending,
        pausing: pauseTimerMutation.isPending,
        resuming: resumeTimerMutation.isPending,
        error: startTimerMutation.error?.message || stopTimerMutation.error?.message || pauseTimerMutation.error?.message || resumeTimerMutation.error?.message || '',
      },
      query: lastQueryRef.current,
    }),
    [
      flatTasks,
      groups,
      tasksQuery.isLoading,
      tasksQuery.error?.message,
      tasksQuery.data?.meta,
      fetchTasks,
      reorderMutation,
      quickCreateMutation,
      updateMutation,
      bulkUpdateMutation,
      taskById,
      timerTick,
      startTimerMutation,
      stopTimerMutation,
      pauseTimerMutation,
      resumeTimerMutation,
      currentGroupBy,
    ],
  );
}
