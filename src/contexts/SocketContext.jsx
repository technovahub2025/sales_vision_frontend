import { createContext, useContext, useEffect, useMemo, useRef } from 'react';
import { getSocket, joinWorkspace as joinWorkspaceSocket, leaveWorkspace as leaveWorkspaceSocket } from '../socket/socket';
import { createJoinManager } from '../socket/joinManager';

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const socket = useMemo(() => getSocket(), []);
  const reconnectListenersRef = useRef(new Set());
  const joinManager = useMemo(
    () =>
      createJoinManager({
        joinFn: (payload) => joinWorkspaceSocket(payload),
        leaveFn: (payload) => leaveWorkspaceSocket(payload),
      }),
    [],
  );

  useEffect(() => {
    if (!socket) return undefined;
    const onConnect = () => {
      reconnectListenersRef.current.forEach((listener) => {
        try {
          listener();
        } catch (error) {
          console.warn('[SocketContext] reconnect listener failed:', error);
        }
      });
    };
    socket.on('connect', onConnect);
    return () => {
      socket.off('connect', onConnect);
    };
  }, [socket]);

  const value = useMemo(
    () => ({
      socket,
      joinWorkspace: ({ workspaceId, projectId, taskId, userId, modules, entities }) => {
        if (!socket || !workspaceId) {
          return;
        }
        joinManager.join({ workspaceId, projectId, taskId, userId, modules, entities });
      },
      leaveWorkspace: ({ workspaceId, projectId, taskId, userId, modules, entities }) => {
        if (!socket || !workspaceId) {
          return;
        }
        joinManager.leave({ workspaceId, projectId, taskId, userId, modules, entities });
      },
      onReconnect: (callback) => {
        if (typeof callback !== 'function') {
          return () => {};
        }
        reconnectListenersRef.current.add(callback);
        return () => {
          reconnectListenersRef.current.delete(callback);
        };
      },
    }),
    [socket, joinManager],
  );

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}

export function useSocket() {
  const context = useContext(SocketContext);

  if (!context) {
    throw new Error('useSocket must be used within SocketProvider');
  }

  return context;
}
