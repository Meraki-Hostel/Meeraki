import { http } from './client';
import type { IActivityService, INotificationService, ActivityView } from '../interfaces';
import type { ID, Notification } from '@/types/domain';

export const httpNotificationService: INotificationService = {
  list: (filters = {}) => http.get<Notification[]>('/notifications', filters),
  markRead: async (id: ID, read: boolean) => { await http.patch(`/notifications/${id}`, { read }); },
  markAllRead: async () => { await http.patch('/notifications/read-all'); },
};

export const httpActivityService: IActivityService = {
  list: (filters = {}) => http.get<ActivityView[]>('/activity', filters),
};
