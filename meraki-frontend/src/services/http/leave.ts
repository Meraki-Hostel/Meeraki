import { http } from './client';
import type { ILeaveService, LeaveInput, LeaveView } from '../interfaces';
import type { ID, LeaveRequest } from '@/types/domain';

export const httpLeaveService: ILeaveService = {
  list: (filters = {}) => http.get<LeaveView[]>('/leave', filters),
  create: (input: LeaveInput) => http.post<LeaveRequest>('/leave', input),
  decide: (id: ID, decision: 'approved' | 'rejected', reason?: string) => http.post<LeaveRequest>(`/leave/${id}/decision`, { decision, reason }),
  cancel: (id: ID) => http.post<LeaveRequest>(`/leave/${id}/cancel`),
};
