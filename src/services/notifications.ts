import api from './api';
import type {
  ApiListMeta,
  NotificationCatalog,
  NotificationItem,
  NotificationStats,
} from '../types/api';

const unwrap = <T>(res: { data: { data: T } }) => res.data.data;

const unwrapList = <T>(res: { data: { data: T[]; meta: ApiListMeta } }) => ({
  items: res.data.data,
  meta: res.data.meta,
});

export const notificationApi = {
  catalog: () => api.get<{ data: NotificationCatalog }>('/notifications/catalog').then(unwrap),
  stats: () => api.get<{ data: NotificationStats }>('/notifications/stats').then(unwrap),
  listPage: (params?: object) =>
    api.get<{ data: NotificationItem[]; meta: ApiListMeta }>('/notifications', { params }).then(unwrapList),
  list: (params?: object) =>
    api.get<{ data: NotificationItem[]; meta: ApiListMeta }>('/notifications', { params: { limit: 50, ...params } })
      .then(unwrapList).then((r) => r.items),
  recent: (limit = 8) =>
    api.get<{ data: NotificationItem[] }>('/notifications/recent', { params: { limit } }).then(unwrap),
  unreadCount: () => api.get<{ data: { count: number } }>('/notifications/unread-count').then(unwrap),
  markRead: (id: string) => api.patch<{ data: NotificationItem }>(`/notifications/${id}/read`).then(unwrap),
  markAllRead: () => api.patch<{ data: { success: boolean } }>('/notifications/read-all').then(unwrap),
};
