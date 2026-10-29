import { http } from './client';
import type { IComplaintService, ComplaintInput, ComplaintUpdate, ComplaintView } from '../interfaces';
import type { Complaint, ID } from '@/types/domain';

export const httpComplaintService: IComplaintService = {
  list: (filters = {}) => http.get<ComplaintView[]>('/complaints', filters),
  get: (id: ID) => http.get<ComplaintView>(`/complaints/${id}`),
  create: (input: ComplaintInput) => http.post<Complaint>('/complaints', input),
  update: (id: ID, patch: ComplaintUpdate) => http.patch<Complaint>(`/complaints/${id}`, patch),
  addComment: (id: ID, body: string, internal: boolean) => http.post<Complaint>(`/complaints/${id}/comments`, { body, internal }),
};
