import { createContext, useContext, useMemo } from 'react';
import { useTeams } from '../hooks/useTeams';

const TeamContext = createContext(null);

export function TeamProvider({ workspaceId, children }) {
  const value = useTeams();

  const memoized = useMemo(
    () => ({
      workspaceId,
      ...value,
    }),
    [workspaceId, value],
  );

  return <TeamContext.Provider value={memoized}>{children}</TeamContext.Provider>;
}

export function useTeamContext() {
  const context = useContext(TeamContext);
  if (!context) {
    throw new Error('useTeamContext must be used within TeamProvider');
  }
  return context;
}

