import { useQuery, useQueryClient } from '@tanstack/react-query';
import { EVENTS } from '../socket/events';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { commentsApi, projectsApi, tasksApi, workflowApi } from '../api';
import { useSocket } from '../contexts/SocketContext';
import { toRealtimeEvent } from '../socket/realtime';

const TaskContext = createContext(null);

const EMPTY_BOARD = {
  project: null,
  columns: [],
  swimlanes: [],
  groupBy: 'none',
  viewState: {
    filter: { priority: 'all', assigneeId: 'all', query: '' },
    sort: { by: 'position', direction: 'asc' },
  },
  filterOptions: {
    priorities: ['all', 'critical', 'high', 'medium', 'low'],
    sorts: ['position', 'updatedAt', 'dueDate', 'priority', 'title'],
  },
  totals: { total: 0, version: 0 },
};

function normalizeTask(task) {
  const id = String(task?._id || task?.id || '');
  return {
    ...task,
    id,
    _id: id,
    assignees: task?.assignees || task?.assigneeIds || [],
  };
}

function normalizeBoard(raw) {
  const board = raw || EMPTY_BOARD;
  return {
    ...EMPTY_BOARD,
    ...board,
    columns: (board.columns || []).map((column) => ({
      ...column,
      tasks: (column.tasks || []).map(normalizeTask),
      count: (column.tasks || []).length,
    })),
    swimlanes: Array.isArray(board.swimlanes) ? board.swimlanes : [],
    groupBy: board.groupBy || 'none',
  };
}

function flattenBoardTasks(board) {
  return (board.columns || []).flatMap((column) => column.tasks || []);
}

function patchTaskInBoard(board, nextTask) {
  const normalized = normalizeTask(nextTask);
  if (!normalized.id) return board;

  const columns = (board.columns || []).map((column) => ({
    ...column,
    tasks: (column.tasks || []).filter((task) => String(task.id) !== String(normalized.id)),
  }));
  const targetIndex = columns.findIndex((column) => column.key === normalized.status);
  if (targetIndex >= 0) {
    const insertionIndex = Number.isFinite(Number(normalized.position))
      ? Math.max(0, Math.min(Number(normalized.position), columns[targetIndex].tasks.length))
      : 0;
    columns[targetIndex] = {
      ...columns[targetIndex],
      tasks: [
        ...columns[targetIndex].tasks.slice(0, insertionIndex),
        normalized,
        ...columns[targetIndex].tasks.slice(insertionIndex),
      ],
    };
  }

  return {
    ...board,
    columns: columns.map((column) => ({
      ...column,
      count: column.tasks.length,
      tasks: column.tasks.map((task, index) => ({ ...task, position: index })),
    })),
    totals: {
      ...(board.totals || {}),
      total: columns.reduce((sum, column) => sum + column.tasks.length, 0),
      version: Date.now(),
    },
  };
}

function moveTaskInBoard(board, taskId, toColumnKey, toPosition = 0) {
  const nextColumns = (board.columns || []).map((column) => ({
    ...column,
    tasks: [...(column.tasks || [])],
  }));

  let movingTask = null;
  for (const column of nextColumns) {
    const idx = column.tasks.findIndex((task) => String(task.id) === String(taskId));
    if (idx >= 0) {
      [movingTask] = column.tasks.splice(idx, 1);
      break;
    }
  }

  if (!movingTask) {
    return board;
  }

  const targetColumn = nextColumns.find((column) => column.key === toColumnKey);
  if (!targetColumn) {
    return board;
  }

  const safeIndex = Math.max(0, Math.min(Number(toPosition || 0), targetColumn.tasks.length));
  const nextTask = {
    ...movingTask,
    status: toColumnKey,
    position: safeIndex,
  };
  targetColumn.tasks.splice(safeIndex, 0, nextTask);

  return {
    ...board,
    columns: nextColumns.map((column) => ({
      ...column,
      count: column.tasks.length,
      tasks: column.tasks.map((task, index) => ({ ...task, position: index })),
    })),
    totals: {
      ...(board.totals || {}),
      total: nextColumns.reduce((sum, column) => sum + column.tasks.length, 0),
      version: Date.now(),
    },
  };
}

function deleteTaskFromBoard(board, taskId) {
  const columns = (board.columns || []).map((column) => ({
    ...column,
    tasks: (column.tasks || []).filter((item) => String(item.id) !== String(taskId)),
  }));

  return {
    ...board,
    columns: columns.map((column) => ({
      ...column,
      count: column.tasks.length,
      tasks: column.tasks.map((task, index) => ({ ...task, position: index })),
    })),
    totals: {
      ...(board.totals || {}),
      total: columns.reduce((sum, column) => sum + column.tasks.length, 0),
      version: Date.now(),
    },
  };
}

function buildSwimlanes(board, groupBy) {
  if (!board || !Array.isArray(board.columns)) return [];
  if (!groupBy || groupBy === 'none') return [];

  const baseColumns = board.columns.map((column) => ({
    ...column,
    tasks: [],
    count: 0,
  }));
  const laneMap = new Map();
  const ensureLane = (key, label) => {
    if (!laneMap.has(key)) {
      laneMap.set(key, {
        key,
        label,
        columns: baseColumns.map((col) => ({ ...col, tasks: [], count: 0 })),
      });
    }
    return laneMap.get(key);
  };

  for (const task of flattenBoardTasks(board)) {
    let laneKey = 'unassigned';
    let laneLabel = 'Unassigned';
    if (groupBy === 'assignee') {
      const primary = (task.assignees || [])[0];
      if (primary?._id) {
        laneKey = primary._id;
        laneLabel = primary.displayName || 'Assignee';
      }
    } else if (groupBy === 'epic') {
      if (task.parentTaskId) {
        laneKey = String(task.parentTaskId);
        laneLabel = task.epicTitle || 'Epic';
      } else {
        laneKey = 'no_epic';
        laneLabel = 'No epic';
      }
    }

    const lane = ensureLane(laneKey, laneLabel);
    const column = lane.columns.find((col) => col.key === task.status);
    if (column) {
      column.tasks.push(task);
      column.count = column.tasks.length;
    }
  }

  return Array.from(laneMap.values());
}

function appendComment(list, comment) {
  if (!comment?._id) return list;
  const exists = (list || []).some((item) => String(item._id) === String(comment._id));
  return exists ? list : [...(list || []), comment];
}

function parsePayloadData(payload) {
  return payload?.data || payload?.task || payload?.comment || null;
}

export function TaskProvider({ workspaceId, projectId, taskId, children }) {
  const queryClient = useQueryClient();
  const { socket, joinWorkspace, leaveWorkspace, onReconnect } = useSocket();
  const [drawerState, setDrawerState] = useState({ open: false, mode: 'task' });
  const [dragState, setDragState] = useState({ taskId: null, fromColumn: null });
  const [boardGroupBy, setBoardGroupBy] = useState('none');
  const [error, setError] = useState('');
  const mountedRef = useRef(false);

  const boardQueryKey = useMemo(
    () => ['task-board', workspaceId, projectId, boardGroupBy],
    [workspaceId, projectId, boardGroupBy],
  );

  const boardQuery = useQuery({
    queryKey: boardQueryKey,
    queryFn: async () => {
      const response = await projectsApi.board(workspaceId, projectId, boardGroupBy && boardGroupBy !== 'none' ? { groupBy: boardGroupBy } : undefined);
      const normalized = normalizeBoard(response.data);
      if (boardGroupBy && boardGroupBy !== 'none') {
        return { ...normalized, swimlanes: normalized.swimlanes?.length ? normalized.swimlanes : buildSwimlanes(normalized, boardGroupBy) };
      }
      return normalized;
    },
    enabled: Boolean(workspaceId && projectId),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    placeholderData: (previousData) => previousData,
  });

  const board = boardQuery.data || EMPTY_BOARD;
  const selectedTaskId = useMemo(() => {
    if (taskId) return String(taskId);
    return String(board.columns?.find((column) => column.tasks?.length)?.tasks?.[0]?.id || '');
  }, [taskId, board]);

  const taskQueryKey = useMemo(() => ['task-detail', workspaceId, selectedTaskId], [workspaceId, selectedTaskId]);
  const commentsQueryKey = useMemo(() => ['task-comments', workspaceId, selectedTaskId], [workspaceId, selectedTaskId]);
  const workflowQueryKey = useMemo(() => ['task-workflow', workspaceId], [workspaceId]);

  const taskQuery = useQuery({
    queryKey: taskQueryKey,
    queryFn: async () => {
      const response = await tasksApi.get(workspaceId, selectedTaskId);
      return normalizeTask(response.data || null);
    },
    enabled: Boolean(workspaceId && selectedTaskId),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });

  const commentsQuery = useQuery({
    queryKey: commentsQueryKey,
    queryFn: async () => {
      const response = await commentsApi.listByTask(workspaceId, selectedTaskId);
      return response.data || [];
    },
    enabled: Boolean(workspaceId && selectedTaskId),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    initialData: [],
  });

  const workflowQuery = useQuery({
    queryKey: workflowQueryKey,
    queryFn: async () => {
      await workflowApi.ensureDefault(workspaceId);
      const workflowsRes = await workflowApi.list(workspaceId, { entityType: 'task' });
      const defaultWorkflow = (workflowsRes.data || [])[0] || null;
      if (!defaultWorkflow?._id) {
        return { workflowId: '', statuses: [] };
      }
      const statusesRes = await workflowApi.listStatuses(workspaceId, defaultWorkflow._id);
      return {
        workflowId: String(defaultWorkflow._id),
        statuses: statusesRes.data || [],
      };
    },
    enabled: Boolean(workspaceId),
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    initialData: { workflowId: '', statuses: [] },
  });

  const tasks = useMemo(() => flattenBoardTasks(board), [board]);
  const task = taskQuery.data || null;
  const comments = useMemo(() => commentsQuery.data || [], [commentsQuery.data]);
  const taskStatuses = useMemo(() => workflowQuery.data?.statuses || [], [workflowQuery.data?.statuses]);
  const taskWorkflowId = workflowQuery.data?.workflowId || '';

  const boardLoading = boardQuery.isLoading || (boardQuery.isFetching && !boardQuery.data);
  const loading =
    boardLoading ||
    workflowQuery.isLoading ||
    (Boolean(selectedTaskId) && (taskQuery.isLoading || commentsQuery.isLoading));

  const combinedError =
    error ||
    boardQuery.error?.message ||
    taskQuery.error?.message ||
    commentsQuery.error?.message ||
    workflowQuery.error?.message ||
    '';

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    setError('');
  }, [workspaceId, projectId, taskId]);

  const refreshBoard = useCallback(async () => {
    if (!workspaceId || !projectId) return normalizeBoard(EMPTY_BOARD);
    const next = await boardQuery.refetch();
    return normalizeBoard(next.data || EMPTY_BOARD);
  }, [workspaceId, projectId, boardQuery]);

  const refreshTask = useCallback(async () => {
    if (!workspaceId || !selectedTaskId) return;
    await Promise.all([taskQuery.refetch(), commentsQuery.refetch()]);
  }, [workspaceId, selectedTaskId, taskQuery, commentsQuery]);

  const hydrate = useCallback(async () => {
    if (!workspaceId || !projectId) return;
    setError('');
    await Promise.all([boardQuery.refetch(), workflowQuery.refetch()]);
    if (selectedTaskId) {
      await Promise.all([taskQuery.refetch(), commentsQuery.refetch()]);
    }
  }, [workspaceId, projectId, selectedTaskId, boardQuery, workflowQuery, taskQuery, commentsQuery]);

  const removeTask = useCallback(
    async (removingTaskId) => {
      const previous = queryClient.getQueryData(boardQueryKey) || EMPTY_BOARD;
      const optimistic = deleteTaskFromBoard(previous, removingTaskId);
      const withSwimlanes = previous.groupBy && previous.groupBy !== 'none'
        ? { ...optimistic, swimlanes: buildSwimlanes(optimistic, previous.groupBy) }
        : optimistic;
      queryClient.setQueryData(boardQueryKey, withSwimlanes);
      try {
        await projectsApi.removeBoardTask(workspaceId, projectId, removingTaskId);
      } catch (err) {
        queryClient.setQueryData(boardQueryKey, previous);
        setError(err.message || 'Failed to remove task');
        throw err;
      }
    },
    [queryClient, boardQueryKey, workspaceId, projectId],
  );

  const removeColumn = useCallback(
    async (columnKey) => {
      const previous = queryClient.getQueryData(boardQueryKey) || EMPTY_BOARD;
      const fallbackColumn = (previous.columns || []).find((column) => column.key !== columnKey);
      if (!fallbackColumn) {
        throw new Error('No fallback column available');
      }

      const movedFromDeleted = (previous.columns || []).find((column) => column.key === columnKey)?.tasks || [];
      const optimistic = {
        ...previous,
        columns: (previous.columns || [])
          .filter((column) => column.key !== columnKey)
          .map((column, index) => {
            if (column.key !== fallbackColumn.key) {
              return { ...column, order: index, count: (column.tasks || []).length };
            }
            const nextTasks = [...(column.tasks || []), ...movedFromDeleted.map((taskItem) => ({ ...taskItem, status: fallbackColumn.key }))]
              .map((item, itemIndex) => ({ ...item, position: itemIndex }));
            return { ...column, order: index, tasks: nextTasks, count: nextTasks.length };
          }),
      };
      const withSwimlanes = previous.groupBy && previous.groupBy !== 'none'
        ? { ...optimistic, swimlanes: buildSwimlanes(optimistic, previous.groupBy) }
        : optimistic;
      queryClient.setQueryData(boardQueryKey, withSwimlanes);

      try {
        await projectsApi.removeBoardColumn(workspaceId, projectId, columnKey, {
          targetColumnKey: fallbackColumn.key,
        });
      } catch (err) {
        queryClient.setQueryData(boardQueryKey, previous);
        setError(err.message || 'Failed to remove column');
        throw err;
      }
    },
    [queryClient, boardQueryKey, workspaceId, projectId],
  );

  const addComment = useCallback(
    async (entityTaskId, body) => {
      const response = await commentsApi.createForTask(workspaceId, entityTaskId, { body, type: 'comment' });
      const created = response.data;
      if (String(entityTaskId) === String(selectedTaskId)) {
        queryClient.setQueryData(commentsQueryKey, (current = []) => appendComment(current, created));
      }
      return created;
    },
    [workspaceId, selectedTaskId, queryClient, commentsQueryKey],
  );

  const updateStatus = useCallback(
    async (id, status) => {
      const previousBoard = queryClient.getQueryData(boardQueryKey) || EMPTY_BOARD;
      const previousTask = queryClient.getQueryData(taskQueryKey) || null;
      const optimisticBoard = moveTaskInBoard(previousBoard, id, status, 0);
      const optimisticWithSwimlanes = previousBoard.groupBy && previousBoard.groupBy !== 'none'
        ? { ...optimisticBoard, swimlanes: buildSwimlanes(optimisticBoard, previousBoard.groupBy) }
        : optimisticBoard;
      queryClient.setQueryData(boardQueryKey, optimisticWithSwimlanes);
      queryClient.setQueryData(taskQueryKey, (current) =>
        current && String(current._id) === String(id) ? { ...current, status } : current,
      );

      try {
        const matchedStatus = (taskStatuses || []).find((item) => item.key === status);
        const response = await tasksApi.updateStatus(workspaceId, id, {
          workflowId: taskWorkflowId || undefined,
          statusId: matchedStatus?._id || undefined,
          status,
        });
        const updated = normalizeTask(response.data || null);
        queryClient.setQueryData(boardQueryKey, (current = EMPTY_BOARD) => {
          const next = patchTaskInBoard(current, updated);
          if (current.groupBy && current.groupBy !== 'none') {
            return { ...next, swimlanes: buildSwimlanes(next, current.groupBy) };
          }
          return next;
        });
        queryClient.setQueryData(taskQueryKey, (current) =>
          current && String(current._id || current.id) === String(updated._id || updated.id)
            ? { ...current, ...updated }
            : current,
        );
        return updated;
      } catch (err) {
        queryClient.setQueryData(boardQueryKey, previousBoard);
        queryClient.setQueryData(taskQueryKey, previousTask);
        setError(err.message || 'Failed to update status');
        throw err;
      }
    },
    [queryClient, boardQueryKey, taskQueryKey, taskStatuses, taskWorkflowId, workspaceId],
  );

  const persistViewState = useCallback(
    async (partialView) => {
      const previous = queryClient.getQueryData(boardQueryKey) || EMPTY_BOARD;
      const nextView = {
        filter: { ...(previous.viewState?.filter || {}), ...(partialView?.filter || {}) },
        sort: { ...(previous.viewState?.sort || {}), ...(partialView?.sort || {}) },
      };

      queryClient.setQueryData(boardQueryKey, {
        ...previous,
        viewState: nextView,
        totals: { ...(previous.totals || {}), version: Date.now() },
      });

      try {
        await projectsApi.updateBoardView(workspaceId, projectId, nextView);
      } catch (err) {
        queryClient.setQueryData(boardQueryKey, previous);
        setError(err.message || 'Failed to save board view');
        throw err;
      }
    },
    [queryClient, boardQueryKey, workspaceId, projectId],
  );

  const addColumn = useCallback(
    async (title) => {
      const response = await projectsApi.addBoardColumn(workspaceId, projectId, { title });
      const column = response.data?.column;
      if (column) {
        queryClient.setQueryData(boardQueryKey, (current = EMPTY_BOARD) => {
          const next = {
            ...current,
            columns: [
              ...(current.columns || []),
              {
                ...column,
                tasks: [],
                count: 0,
              },
            ],
            totals: { ...(current.totals || {}), version: Date.now() },
          };
          if (current.groupBy && current.groupBy !== 'none') {
            return { ...next, swimlanes: buildSwimlanes(next, current.groupBy) };
          }
          return next;
        });
      }
      return column;
    },
    [workspaceId, projectId, queryClient, boardQueryKey],
  );

  const createTask = useCallback(
    async (payload) => {
      const response = await projectsApi.createBoardTask(workspaceId, projectId, payload);
      const created = response.data?.task;
      if (created) {
        queryClient.setQueryData(boardQueryKey, (current = EMPTY_BOARD) => {
          const next = patchTaskInBoard(current, created);
          if (current.groupBy && current.groupBy !== 'none') {
            return { ...next, swimlanes: buildSwimlanes(next, current.groupBy) };
          }
          return next;
        });
      }
      return created;
    },
    [workspaceId, projectId, queryClient, boardQueryKey],
  );

  const moveTask = useCallback(
    async ({ taskId: movingTaskId, toColumnKey, toPosition }) => {
      const previous = queryClient.getQueryData(boardQueryKey) || EMPTY_BOARD;
      const optimistic = moveTaskInBoard(previous, movingTaskId, toColumnKey, toPosition);
      const withSwimlanes = previous.groupBy && previous.groupBy !== 'none'
        ? { ...optimistic, swimlanes: buildSwimlanes(optimistic, previous.groupBy) }
        : optimistic;
      queryClient.setQueryData(boardQueryKey, withSwimlanes);
      try {
        await projectsApi.moveBoardTask(workspaceId, projectId, movingTaskId, { toColumnKey, toPosition });
      } catch (err) {
        queryClient.setQueryData(boardQueryKey, previous);
        setError(err.message || 'Failed to move task');
        throw err;
      }
    },
    [workspaceId, projectId, queryClient, boardQueryKey],
  );

  useEffect(() => {
    if (!socket || !workspaceId || !projectId) return;

    const joinPayload = {
      workspaceId,
      projectId,
      taskId: selectedTaskId,
      modules: ['tasks', 'comments', 'projects', 'board'],
    };
    joinWorkspace(joinPayload);

    const handleBoardViewUpdated = (payload) => {
      const data = parsePayloadData(payload);
      if (String(data?.projectId || '') !== String(projectId)) return;
      if (!data?.viewState) return;

      queryClient.setQueryData(boardQueryKey, (current = EMPTY_BOARD) => {
        const next = {
          ...current,
          viewState: {
            ...(current.viewState || {}),
            ...data.viewState,
          },
          totals: { ...(current.totals || {}), version: Date.now() },
        };
        if (current.groupBy && current.groupBy !== 'none') {
          return { ...next, swimlanes: buildSwimlanes(next, current.groupBy) };
        }
        return next;
      });
    };

    const handleBoardColumnCreated = (payload) => {
      const data = parsePayloadData(payload);
      if (String(data?.projectId || '') !== String(projectId) || !data?.column) return;

      queryClient.setQueryData(boardQueryKey, (current = EMPTY_BOARD) => {
        const exists = (current.columns || []).some((column) => column.key === data.column.key);
        if (exists) return current;
        return {
          ...current,
          columns: [
            ...(current.columns || []),
            {
              ...data.column,
              tasks: [],
              count: 0,
            },
          ],
          totals: { ...(current.totals || {}), version: Date.now() },
        };
      });
    };

    const handleBoardColumnUpdated = (payload) => {
      const data = parsePayloadData(payload);
      if (String(data?.projectId || '') !== String(projectId)) return;
      if (!Array.isArray(data?.columns)) return;

      queryClient.setQueryData(boardQueryKey, (current = EMPTY_BOARD) => {
        const taskMap = new Map((current.columns || []).map((column) => [column.key, column.tasks || []]));
        const nextColumns = data.columns.map((column) => {
          const tasksInColumn = taskMap.get(column.key) || [];
          return {
            ...column,
            tasks: tasksInColumn,
            count: tasksInColumn.length,
          };
        });

        const next = {
          ...current,
          columns: nextColumns,
          totals: {
            ...(current.totals || {}),
            total: nextColumns.reduce((sum, column) => sum + (column.tasks || []).length, 0),
            version: Date.now(),
          },
        };
        if (current.groupBy && current.groupBy !== 'none') {
          return { ...next, swimlanes: buildSwimlanes(next, current.groupBy) };
        }
        return next;
      });
    };

    const handleBoardColumnDeleted = (payload) => {
      const data = parsePayloadData(payload);
      if (String(data?.projectId || '') !== String(projectId)) return;
      const deletedKey = data?.columnKey;
      const targetKey = data?.targetColumnKey;
      if (!deletedKey || !targetKey) return;

      queryClient.setQueryData(boardQueryKey, (current = EMPTY_BOARD) => {
        const sourceTasks = (current.columns || []).find((column) => column.key === deletedKey)?.tasks || [];
        const columns = (current.columns || [])
          .filter((column) => column.key !== deletedKey)
          .map((column, index) => {
            if (column.key !== targetKey) {
              return {
                ...column,
                order: index,
                count: (column.tasks || []).length,
              };
            }

            const merged = [...(column.tasks || []), ...sourceTasks.map((taskItem) => ({ ...taskItem, status: targetKey }))].map(
              (item, itemIndex) => ({ ...item, position: itemIndex }),
            );

            return {
              ...column,
              order: index,
              tasks: merged,
              count: merged.length,
            };
          });

        const next = {
          ...current,
          columns,
          totals: {
            ...(current.totals || {}),
            total: columns.reduce((sum, column) => sum + (column.tasks || []).length, 0),
            version: Date.now(),
          },
        };
        if (current.groupBy && current.groupBy !== 'none') {
          return { ...next, swimlanes: buildSwimlanes(next, current.groupBy) };
        }
        return next;
      });
    };

    const handleTaskPatch = (payload) => {
      const nextTask = parsePayloadData(payload);
      if (!nextTask || String(nextTask.projectId) !== String(projectId)) {
        return;
      }
      const normalized = normalizeTask(nextTask);
      queryClient.setQueryData(boardQueryKey, (current = EMPTY_BOARD) => {
        const next = patchTaskInBoard(current, normalized);
        if (current.groupBy && current.groupBy !== 'none') {
          return { ...next, swimlanes: buildSwimlanes(next, current.groupBy) };
        }
        return next;
      });
      queryClient.setQueryData(taskQueryKey, (current) => {
        if (!current) return current;
        return String(current._id || current.id) === String(normalized._id || normalized.id)
          ? { ...current, ...normalized }
          : current;
      });
    };

    const handleTaskMove = (payload) => {
      const movedTask = parsePayloadData(payload);
      if (!movedTask || String(movedTask.projectId) !== String(projectId)) {
        return;
      }
      queryClient.setQueryData(boardQueryKey, (current = EMPTY_BOARD) => {
        const next = moveTaskInBoard(current, movedTask._id || movedTask.id, movedTask.status, movedTask.position || 0);
        if (current.groupBy && current.groupBy !== 'none') {
          return { ...next, swimlanes: buildSwimlanes(next, current.groupBy) };
        }
        return next;
      });
    };

    const handleTaskDelete = (payload) => {
      const removedTask = parsePayloadData(payload);
      if (!removedTask || String(removedTask.projectId) !== String(projectId)) {
        return;
      }
      const removedId = removedTask._id || removedTask.id;
      queryClient.setQueryData(boardQueryKey, (current = EMPTY_BOARD) => {
        const next = deleteTaskFromBoard(current, removedId);
        if (current.groupBy && current.groupBy !== 'none') {
          return { ...next, swimlanes: buildSwimlanes(next, current.groupBy) };
        }
        return next;
      });
      if (String(selectedTaskId || '') === String(removedId)) {
        queryClient.setQueryData(taskQueryKey, null);
        queryClient.setQueryData(commentsQueryKey, []);
      }
    };

    const handleCommentCreated = (payload) => {
      const created = parsePayloadData(payload);
      if (!created) return;
      if (String(created.taskId || '') !== String(selectedTaskId || '')) return;
      queryClient.setQueryData(commentsQueryKey, (current = []) => appendComment(current, created));
    };

    const handleRealtimeEvent = (raw) => {
      const evt = toRealtimeEvent(raw);
      if (String(evt.workspaceId || '') !== String(workspaceId)) return;
      if (!evt.event) return;
      if (evt.event === 'task:created' || evt.event === 'task:updated') {
        handleTaskPatch(raw);
      } else if (evt.event === 'task:moved') {
        handleTaskMove(raw);
      } else if (evt.event === 'task:deleted') {
        handleTaskDelete(raw);
      } else if (evt.event === 'comment:created') {
        handleCommentCreated(raw);
      } else if (evt.event === 'board:view_updated') {
        handleBoardViewUpdated(raw);
      } else if (evt.event === 'board:column_created') {
        handleBoardColumnCreated(raw);
      } else if (evt.event === 'board:column_deleted') {
        handleBoardColumnDeleted(raw);
      } else if (evt.event === 'board:column_updated') {
        handleBoardColumnUpdated(raw);
      }
    };

    socket.on(EVENTS.BOARD_VIEW_UPDATED, handleBoardViewUpdated);
    socket.on(EVENTS.BOARD_COLUMN_CREATED, handleBoardColumnCreated);
    socket.on(EVENTS.BOARD_COLUMN_DELETED, handleBoardColumnDeleted);
    socket.on('board:column_updated', handleBoardColumnUpdated);
    socket.on(EVENTS.TASK_CREATED, handleTaskPatch);
    socket.on(EVENTS.TASK_UPDATED, handleTaskPatch);
    socket.on(EVENTS.TASK_MOVED, handleTaskMove);
    socket.on(EVENTS.TASK_DELETED, handleTaskDelete);
    socket.on(EVENTS.COMMENT_CREATED, handleCommentCreated);
    socket.on('comment:added', handleCommentCreated);
    socket.on(EVENTS.REALTIME_EVENT, handleRealtimeEvent);
    const unsubscribeReconnect = onReconnect(() => {
      boardQuery.refetch();
      if (selectedTaskId) {
        taskQuery.refetch();
        commentsQuery.refetch();
      }
    });

    return () => {
      leaveWorkspace(joinPayload);
      socket.off(EVENTS.BOARD_VIEW_UPDATED, handleBoardViewUpdated);
      socket.off(EVENTS.BOARD_COLUMN_CREATED, handleBoardColumnCreated);
      socket.off(EVENTS.BOARD_COLUMN_DELETED, handleBoardColumnDeleted);
      socket.off('board:column_updated', handleBoardColumnUpdated);
      socket.off(EVENTS.TASK_CREATED, handleTaskPatch);
      socket.off(EVENTS.TASK_UPDATED, handleTaskPatch);
      socket.off(EVENTS.TASK_MOVED, handleTaskMove);
      socket.off(EVENTS.TASK_DELETED, handleTaskDelete);
      socket.off(EVENTS.COMMENT_CREATED, handleCommentCreated);
      socket.off('comment:added', handleCommentCreated);
      socket.off(EVENTS.REALTIME_EVENT, handleRealtimeEvent);
      unsubscribeReconnect();
    };
  }, [
    socket,
    workspaceId,
    projectId,
    selectedTaskId,
    joinWorkspace,
    leaveWorkspace,
    queryClient,
    boardQueryKey,
    taskQueryKey,
    commentsQueryKey,
    onReconnect,
    boardQuery,
    taskQuery,
    commentsQuery,
  ]);

  const updateColumn = useCallback(
    async (columnKey, updates) => {
      const previous = queryClient.getQueryData(boardQueryKey) || EMPTY_BOARD;
      const optimistic = {
        ...previous,
        columns: (previous.columns || []).map((column) =>
          column.key === columnKey ? { ...column, ...updates } : column,
        ),
        totals: { ...(previous.totals || {}), version: Date.now() },
      };
      queryClient.setQueryData(boardQueryKey, optimistic);
      try {
        await projectsApi.updateBoardColumn(workspaceId, projectId, columnKey, updates);
      } catch (err) {
        queryClient.setQueryData(boardQueryKey, previous);
        setError(err.message || 'Failed to update column');
        throw err;
      }
    },
    [queryClient, boardQueryKey, workspaceId, projectId],
  );

  const reorderColumns = useCallback(
    async (columnKey, newIndex) => {
      const previous = queryClient.getQueryData(boardQueryKey) || EMPTY_BOARD;
      const columns = [...(previous.columns || [])];
      const fromIndex = columns.findIndex((column) => column.key === columnKey);
      if (fromIndex < 0) return;
      const [moved] = columns.splice(fromIndex, 1);
      const targetIndex = Math.max(0, Math.min(Number(newIndex) || 0, columns.length));
      columns.splice(targetIndex, 0, moved);
      const ordered = columns.map((column, index) => ({ ...column, order: index }));
      const optimistic = { ...previous, columns: ordered, totals: { ...(previous.totals || {}), version: Date.now() } };
      queryClient.setQueryData(boardQueryKey, optimistic);
      try {
        await projectsApi.updateBoardColumn(workspaceId, projectId, columnKey, { order: targetIndex });
      } catch (err) {
        queryClient.setQueryData(boardQueryKey, previous);
        setError(err.message || 'Failed to reorder columns');
        throw err;
      }
    },
    [queryClient, boardQueryKey, workspaceId, projectId],
  );

  const duplicateTask = useCallback(
    async (taskIdToDuplicate) => {
      const response = await tasksApi.duplicate(workspaceId, taskIdToDuplicate);
      const duplicated = response.data;
      if (duplicated?._id) {
        queryClient.setQueryData(boardQueryKey, (current = EMPTY_BOARD) => {
          const next = patchTaskInBoard(current, duplicated);
          if (current.groupBy && current.groupBy !== 'none') {
            return { ...next, swimlanes: buildSwimlanes(next, current.groupBy) };
          }
          return next;
        });
      }
      return duplicated;
    },
    [workspaceId, queryClient, boardQueryKey],
  );

  const archiveTask = useCallback(
    async (archivingTaskId) => {
      const previous = queryClient.getQueryData(boardQueryKey) || EMPTY_BOARD;
      const optimistic = deleteTaskFromBoard(previous, archivingTaskId);
      const withSwimlanes = previous.groupBy && previous.groupBy !== 'none'
        ? { ...optimistic, swimlanes: buildSwimlanes(optimistic, previous.groupBy) }
        : optimistic;
      queryClient.setQueryData(boardQueryKey, withSwimlanes);
      try {
        await tasksApi.update(workspaceId, archivingTaskId, { archived: true });
      } catch (err) {
        queryClient.setQueryData(boardQueryKey, previous);
        setError(err.message || 'Failed to archive task');
        throw err;
      }
    },
    [workspaceId, queryClient, boardQueryKey],
  );

  const value = useMemo(
    () => ({
      tasks,
      task,
      comments,
      board,
      boardGroupBy,
      boardLoading,
      drawerState,
      dragState,
      loading,
      error: combinedError,
      taskStatuses,
      updateStatus,
      moveTask,
      createTask,
      addColumn,
      updateColumn,
      reorderColumns,
      removeColumn,
      removeTask,
      duplicateTask,
      archiveTask,
      persistViewState,
      addComment,
      hydrate,
      refreshBoard,
      refreshTask,
      setDrawerState,
      setDragState,
      setBoardGroupBy,
    }),
    [
      tasks,
      task,
      comments,
      board,
      boardGroupBy,
      boardLoading,
      drawerState,
      dragState,
      loading,
      combinedError,
      taskStatuses,
      updateStatus,
      moveTask,
      createTask,
      addColumn,
      updateColumn,
      reorderColumns,
      removeColumn,
      removeTask,
      duplicateTask,
      archiveTask,
      persistViewState,
      addComment,
      hydrate,
      refreshBoard,
      refreshTask,
      setBoardGroupBy,
    ],
  );

  return <TaskContext.Provider value={value}>{children}</TaskContext.Provider>;
}

export function useTasks() {
  const context = useContext(TaskContext);
  if (!context) throw new Error('useTasks must be used within TaskProvider');
  return context;
}
