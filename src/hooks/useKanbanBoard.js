import { EVENTS } from '../socket/events';
import { useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { projectsApi, sprintsApi } from '../api';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { useSocket } from '../contexts/SocketContext';

function normalizeTask(task) {
  if (!task || typeof task !== 'object') return null;
  const id = String(task._id || task.id || '');
  if (!id) return null;
  return { ...task, _id: id, id };
}

function normalizeBoard(board) {
  if (!board || typeof board !== 'object') return null;
  return {
    ...board,
    columns: (board.columns || []).map((column) => ({
      ...column,
      tasks: (column.tasks || []).map(normalizeTask).filter(Boolean),
      count: Number(column.count || (column.tasks || []).length || 0),
    })),
  };
}

function patchTaskIntoBoard(board, rawTask) {
  const task = normalizeTask(rawTask);
  if (!board || !task) return board;

  const columns = (board.columns || []).map((column) => ({
    ...column,
    tasks: (column.tasks || []).filter((item) => String(item._id || item.id) !== task.id),
  }));

  const targetIndex = columns.findIndex((column) => String(column.key) === String(task.status));
  if (targetIndex >= 0) {
    const currentTasks = columns[targetIndex].tasks || [];
    const insertionIndex = Math.max(0, Math.min(Number(task.position || 0), currentTasks.length));
    const nextTasks = [...currentTasks];
    nextTasks.splice(insertionIndex, 0, task);
    columns[targetIndex] = { ...columns[targetIndex], tasks: nextTasks };
  }

  return {
    ...board,
    columns: columns.map((column) => ({
      ...column,
      count: (column.tasks || []).length,
      tasks: (column.tasks || []).map((item, index) => ({ ...item, position: index })),
    })),
  };
}

function removeTaskFromBoard(board, taskId) {
  if (!board || !taskId) return board;
  return {
    ...board,
    columns: (board.columns || []).map((column) => {
      const tasks = (column.tasks || []).filter((item) => String(item._id || item.id) !== String(taskId));
      return { ...column, tasks, count: tasks.length };
    }),
  };
}

function extractPayloadTask(payload) {
  return payload?.data || payload?.task || payload || null;
}

export function useKanbanBoard(projectIdArg, sprintId, params = {}) {
  const queryClient = useQueryClient();
  const { workspaceId, projectId: defaultProjectId } = useWorkspace();
  const { socket, joinWorkspace } = useSocket();
  const projectId = projectIdArg || defaultProjectId;
  const boardMode = sprintId ? `sprint:${sprintId}` : `project:${projectId}`;
  const queryKey = useMemo(() => ['workspace', workspaceId, 'kanban', boardMode], [workspaceId, boardMode]);

  const boardQuery = useQuery({
    queryKey,
    enabled: Boolean(workspaceId && projectId),
    staleTime: 30_000,
    queryFn: async () => {
      const response = sprintId
        ? await sprintsApi.board(workspaceId, sprintId)
        : await projectsApi.board(workspaceId, projectId, params);
      return normalizeBoard(response.data || null);
    },
  });

  useEffect(() => {
    if (!socket || !workspaceId) return;
    joinWorkspace({
      workspaceId,
      projectId,
      modules: ['projects', 'tasks', 'sprints'],
      entities: sprintId ? [{ module: 'tasks', id: sprintId }] : [],
    });

    const onBoardUpdated = (payload) => {
      const snapshot = normalizeBoard(payload?.data || payload?.board || null);
      if (!snapshot) return;
      if (snapshot.project?._id && String(snapshot.project._id) !== String(projectId)) return;
      queryClient.setQueryData(queryKey, snapshot);
    };

    const onTaskChanged = (payload) => {
      const task = extractPayloadTask(payload);
      if (!task || String(task.projectId) !== String(projectId)) return;
      queryClient.setQueryData(queryKey, (current) => patchTaskIntoBoard(current, task));
    };

    const onTaskDeleted = (payload) => {
      const task = extractPayloadTask(payload);
      const id = String(task?._id || task?.id || '');
      if (!id) return;
      queryClient.setQueryData(queryKey, (current) => removeTaskFromBoard(current, id));
    };

    socket.on(EVENTS.BOARD_UPDATED, onBoardUpdated);
    socket.on(EVENTS.TASK_CREATED, onTaskChanged);
    socket.on(EVENTS.TASK_UPDATED, onTaskChanged);
    socket.on(EVENTS.TASK_MOVED, onTaskChanged);
    socket.on(EVENTS.TASK_DELETED, onTaskDeleted);

    return () => {
      socket.off(EVENTS.BOARD_UPDATED, onBoardUpdated);
      socket.off(EVENTS.TASK_CREATED, onTaskChanged);
      socket.off(EVENTS.TASK_UPDATED, onTaskChanged);
      socket.off(EVENTS.TASK_MOVED, onTaskChanged);
      socket.off(EVENTS.TASK_DELETED, onTaskDeleted);
    };
  }, [socket, workspaceId, projectId, sprintId, joinWorkspace, queryClient, queryKey]);

  return useMemo(
    () => ({
      board: boardQuery.data || null,
      loading: boardQuery.isLoading,
      error: boardQuery.error?.message || '',
      refresh: boardQuery.refetch,
    }),
    [boardQuery.data, boardQuery.isLoading, boardQuery.error?.message, boardQuery.refetch],
  );
}
