import { createContext, useContext, useMemo } from 'react';
import { useSprints as useSprintsHook } from '../hooks/useSprints';
import { useBacklog as useBacklogHook } from '../hooks/useBacklog';
import { useKanbanBoard as useKanbanBoardHook } from '../hooks/useKanbanBoard';

const SprintContext = createContext(null);

export function SprintProvider({ workspaceId, projectId, children }) {
  const sprints = useSprintsHook(projectId);
  const backlog = useBacklogHook(projectId);
  const board = useKanbanBoardHook(projectId);

  const value = useMemo(
    () => ({
      workspaceId,
      projectId,
      ...sprints,
      backlogItems: backlog.items,
      backlogLoading: backlog.loading,
      backlogError: backlog.error,
      refreshBacklog: backlog.refresh,
      reorderBacklog: backlog.reorder,
      addBacklogToSprint: backlog.addToSprint,
      board,
    }),
    [workspaceId, projectId, sprints, backlog, board],
  );

  return <SprintContext.Provider value={value}>{children}</SprintContext.Provider>;
}

export function useSprintContext() {
  const context = useContext(SprintContext);
  if (!context) {
    throw new Error('useSprintContext must be used within SprintProvider');
  }
  return context;
}

