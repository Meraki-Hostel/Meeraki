import { http } from './client';
import type { IVisitorService, VisitorInput, VisitorView, WalkInInput } from '../interfaces';
import type { ID, VisitorRequest } from '@/types/domain';

export const httpVisitorService: IVisitorService = {
  list: (filters = {}) => http.get<VisitorView[]>('/visitors', filters),
  create: (input: VisitorInput) => http.post<VisitorRequest>('/visitors', input),
  createWalkIn: (input: WalkInInput) => http.post<VisitorRequest>('/visitors/walk-ins', input),
  decide: (id: ID, decision: 'approved' | 'rejected', reason?: string) => http.post<VisitorRequest>(`/visitors/${id}/decision`, { decision, reason }),
  checkIn: (id: ID) => http.post<VisitorRequest>(`/visitors/${id}/check-in`),
  checkOut: (id: ID) => http.post<VisitorRequest>(`/visitors/${id}/check-out`),
  cancel: (id: ID) => http.post<VisitorRequest>(`/visitors/${id}/cancel`),
};
