import { createContext, useContext, useMemo } from 'react';
import { useNotifications } from '../hooks/useNotifications';

const NotificationContext = createContext(null);

export function NotificationProvider({ workspaceId, children }) {
  const value = useNotifications();

  const memoized = useMemo(
    () => ({
      workspaceId,
      ...value,
    }),
    [workspaceId, value],
  );

  return <NotificationContext.Provider value={memoized}>{children}</NotificationContext.Provider>;
}

export function useNotificationContext() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotificationContext must be used within NotificationProvider');
  }
  return context;
}

