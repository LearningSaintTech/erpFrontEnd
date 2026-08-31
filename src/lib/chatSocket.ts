import { io, type Socket } from 'socket.io-client';
import { getSocketBaseUrl } from '../services/chat';

let socket: Socket | null = null;
let activeFactoryId: string | null = null;

export function connectChatSocket(token: string, factoryId: string): Socket {
  if (socket?.connected && activeFactoryId === factoryId) {
    return socket;
  }
  socket?.disconnect();
  activeFactoryId = factoryId;
  socket = io(getSocketBaseUrl(), {
    auth: { token, factoryId },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 8,
  });
  return socket;
}

export function getChatSocket(): Socket | null {
  return socket;
}

export function disconnectChatSocket() {
  socket?.disconnect();
  socket = null;
  activeFactoryId = null;
}

export function joinChatRoom(roomId: string) {
  socket?.emit('chat:join', { roomId });
}

export function leaveChatRoom(roomId: string) {
  socket?.emit('chat:leave', { roomId });
}

export function emitTyping(roomId: string, isTyping: boolean) {
  socket?.emit('chat:typing', { roomId, isTyping });
}

export function emitMarkRead(roomId: string) {
  socket?.emit('chat:read', { roomId });
}
