import { createContext, useContext, useMemo } from 'react';
import { useRoadmap } from '../hooks/useRoadmap';

const RoadmapContext = createContext(null);

export function RoadmapProvider({ workspaceId, projectId, children }) {
  const value = useRoadmap(projectId);

  const memoized = useMemo(
    () => ({
      workspaceId,
      projectId,
      ...value,
    }),
    [workspaceId, projectId, value],
  );

  return <RoadmapContext.Provider value={memoized}>{children}</RoadmapContext.Provider>;
}

export function useRoadmapContext() {
  const context = useContext(RoadmapContext);
  if (!context) {
    throw new Error('useRoadmapContext must be used within RoadmapProvider');
  }
  return context;
}

