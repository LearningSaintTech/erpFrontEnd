import api, { API_URL } from './api';
import type { ApiListMeta, ChatMessage, ChatRoom, ChatStats } from '../types/api';

const unwrap = <T>(res: { data: { data: T } }) => res.data.data;
const unwrapList = <T>(res: { data: { data: T[]; meta: ApiListMeta } }) => ({
  items: res.data.data,
  meta: res.data.meta,
});

export const chatApi = {
  catalog: () => api.get<{ data: Record<string, unknown> }>('/chat/catalog').then(unwrap),
  stats: () => api.get<{ data: ChatStats }>('/chat/stats').then(unwrap),
  listRooms: (params?: { page?: number; limit?: number }) =>
    api.get<{ data: ChatRoom[]; meta: ApiListMeta }>('/chat/rooms', { params }).then(unwrapList),
  createDirect: (userId: string) =>
    api.post<{ data: ChatRoom }>('/chat/rooms/direct', { userId }).then(unwrap),
  createGroup: (body: { name: string; memberIds: string[] }) =>
    api.post<{ data: ChatRoom }>('/chat/rooms/group', body).then(unwrap),
  getRoom: (id: string) => api.get<{ data: ChatRoom }>(`/chat/rooms/${id}`).then(unwrap),
  listMessages: (roomId: string, params?: { page?: number; limit?: number }) =>
    api.get<{ data: ChatMessage[]; meta: ApiListMeta }>(`/chat/rooms/${roomId}/messages`, { params }).then(unwrapList),
  sendMessage: (roomId: string, body: { body: string; replyToId?: string }) =>
    api.post<{ data: ChatMessage }>(`/chat/rooms/${roomId}/messages`, body).then(unwrap),
  markRead: (roomId: string) => api.patch(`/chat/rooms/${roomId}/read`).then(unwrap),
  listAdminRooms: (params?: { page?: number; limit?: number }) =>
    api.get<{ data: ChatRoom[]; meta: ApiListMeta }>('/chat/admin/rooms', { params }).then(unwrapList),
  listAdminMessages: (roomId: string, params?: { page?: number; limit?: number }) =>
    api.get<{ data: ChatMessage[]; meta: ApiListMeta }>(`/chat/admin/rooms/${roomId}/messages`, { params }).then(unwrapList),
};

export function getSocketBaseUrl() {
  return API_URL.replace(/\/api\/v1\/?$/, '');
}
