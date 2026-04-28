import { io } from 'socket.io-client';
import { EVENTS } from './events';

let socketInstance = null;
const socketUrl = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';
const ACCESS_TOKEN_STORAGE_KEY = 'salevision:accessToken';
const SUPER_ADMIN_ACCESS_TOKEN_STORAGE_KEY = 'salevision:superAdminAccessToken';

function readSocketToken() {
  return (
    window.localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY) ||
    window.localStorage.getItem(SUPER_ADMIN_ACCESS_TOKEN_STORAGE_KEY) ||
    ''
  );
}

export function getSocket() {
  if (socketInstance) {
    socketInstance.auth = { token: readSocketToken() };
    return socketInstance;
  }

  socketInstance = io(socketUrl, {
    autoConnect: true,
    withCredentials: true,
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 500,
    reconnectionDelayMax: 4000,
    auth: () => ({ token: readSocketToken() }),
  });

  return socketInstance;
}

export function joinWorkspace(payload) {
  const socket = getSocket();
  const workspaceId = payload?.workspaceId;
  if (!workspaceId) return;
  socket.emit(EVENTS.WORKSPACE_JOIN, payload);
}

export function leaveWorkspace(payload) {
  const socket = getSocket();
  const workspaceId = payload?.workspaceId;
  if (!workspaceId) return;
  socket.emit('workspace:leave', payload);          
}

export function joinRoom(room) {
  if (!room) return;
  if (typeof room === 'string') {
    joinWorkspace({ workspaceId: room });
    return;
  }
  joinWorkspace(room);
}

export function leaveRoom(room) {
  if (!room) return;
  if (typeof room === 'string') {
    leaveWorkspace({ workspaceId: room });
    return;
  }
  leaveWorkspace(room);
}
