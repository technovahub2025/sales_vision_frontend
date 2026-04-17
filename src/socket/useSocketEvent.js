import { useEffect } from 'react';
import { useSocket } from '../contexts/SocketContext';

export function useSocketEvent(event, handler) {
  const { socket } = useSocket();

  useEffect(() => {
    if (!socket || !event || !handler) return undefined;
    socket.on(event, handler);

    return () => {
      socket.off(event, handler);
    };
  }, [socket, event, handler]);
}
