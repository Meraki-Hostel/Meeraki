import { http, uploadFile } from './client';
import type {
  IAnnouncementService, IComplaintService, IDocumentService, IEmergencyService, IEventService, IFeedbackService,
  IInventoryService, ILeaveService, IMaintenanceService, ISearchService, ISettingsService, IStaffService, IUploadService, IVisitorService,
  AnnouncementInput, AnnouncementView, ComplaintInput, ComplaintUpdate, ComplaintView, EmergencyAlertView, EventInput, EventView,
  FeedbackInput, FeedbackSummary, FeedbackView, InventoryItemInput, InventoryTxnView, InventoryView, LeaveInput, LeaveView,
  MaintenanceInput, MaintenanceUpdate, MaintenanceView, PlanUsage, SearchResult, StaffInput, StaffView, StockAdjustInput,
  VisitorInput, VisitorView, WalkInInput,
} from '../interfaces';
import type {
  Announcement, Complaint, DocumentRecord, EventStatus, Feedback, HostelEvent, ID, InventoryItem, LeaveRequest,
  MaintenanceTicket, OrganizationSettings, StaffMember, StaffStatus, VisitorRequest,
} from '@/types/domain';

export const httpStaffService: IStaffService = {
  list: (filters = {}) => http.get<StaffView[]>('/staff', filters),
  create: (input: StaffInput) => http.post<StaffMember>('/staff', input),
  update: (id: ID, input: Partial<StaffInput>) => http.patch<StaffMember>(`/staff/${id}`, input),
  setStatus: (id: ID, status: StaffStatus) => http.patch<StaffMember>(`/staff/${id}/status`, { status }),
};

export const httpComplaintService: IComplaintService = {
  list: (filters = {}) => http.get<ComplaintView[]>('/complaints', filters),
  get: (id: ID) => http.get<ComplaintView>(`/complaints/${id}`),
  async create(input: ComplaintInput) {
    // Files go to storage first; the complaint then claims them by upload id.
    const attachments: string[] = [];
    for (const file of input.attachments) attachments.push(await uploadFile('complaint', file));
    return http.post<Complaint>('/complaints', { ...input, attachments });
  },
  update: (id: ID, patch: ComplaintUpdate) => http.patch<Complaint>(`/complaints/${id}`, patch),
  addComment: (id: ID, body: string, internal: boolean) => http.post<Complaint>(`/complaints/${id}/comments`, { body, internal }),
};

export const httpLeaveService: ILeaveService = {
  list: (filters = {}) => http.get<LeaveView[]>('/leave', filters),
  create: (input: LeaveInput) => http.post<LeaveRequest>('/leave', input),
  decide: (id: ID, decision, reason) => http.post<LeaveRequest>(`/leave/${id}/decide`, { decision, reason }),
  cancel: (id: ID) => http.post<LeaveRequest>(`/leave/${id}/cancel`),
};

export const httpVisitorService: IVisitorService = {
  list: (filters = {}) => http.get<VisitorView[]>('/visitors', filters),
  create: (input: VisitorInput) => http.post<VisitorRequest>('/visitors', input),
  createWalkIn: (input: WalkInInput) => http.post<VisitorRequest>('/visitors/walk-in', input),
  decide: (id: ID, decision, reason) => http.post<VisitorRequest>(`/visitors/${id}/decide`, { decision, reason }),
  checkIn: (id: ID) => http.post<VisitorRequest>(`/visitors/${id}/check-in`),
  checkOut: (id: ID) => http.post<VisitorRequest>(`/visitors/${id}/check-out`),
  cancel: (id: ID) => http.post<VisitorRequest>(`/visitors/${id}/cancel`),
};

export const httpMaintenanceService: IMaintenanceService = {
  list: (filters = {}) => http.get<MaintenanceView[]>('/maintenance', filters),
  create: (input: MaintenanceInput) => http.post<MaintenanceTicket>('/maintenance', input),
  update: (id: ID, patch: MaintenanceUpdate) => http.patch<MaintenanceTicket>(`/maintenance/${id}`, patch),
};

export const httpInventoryService: IInventoryService = {
  list: (filters = {}) => http.get<InventoryView[]>('/inventory', { ...filters, lowStockOnly: filters.lowStockOnly ? 'true' : undefined }),
  transactions: (filters = {}) => http.get<InventoryTxnView[]>('/inventory/transactions', filters),
  create: (input: InventoryItemInput) => http.post<InventoryItem>('/inventory', input),
  adjust: (input: StockAdjustInput) => http.post<InventoryItem>('/inventory/adjust', input),
};

export const httpAnnouncementService: IAnnouncementService = {
  list: (filters = {}) => http.get<AnnouncementView[]>('/announcements', filters),
  create: (input: AnnouncementInput, publish: boolean) => http.post<Announcement>('/announcements', { ...input, publish }),
  update: (id: ID, input: AnnouncementInput) => http.patch<Announcement>(`/announcements/${id}`, input),
  publish: (id: ID) => http.post<Announcement>(`/announcements/${id}/publish`),
  archive: (id: ID) => http.post<Announcement>(`/announcements/${id}/archive`),
  markRead: async (id: ID, read: boolean) => { await http.post(`/announcements/${id}/read`, { read }); },
  markAllRead: async () => { await http.post('/announcements/read-all'); },
};

export const httpEventService: IEventService = {
  list: (filters = {}) => http.get<EventView[]>('/events', filters),
  create: (input: EventInput) => http.post<HostelEvent>('/events', input),
  update: (id: ID, input: Partial<EventInput>) => http.patch<HostelEvent>(`/events/${id}`, input),
  setStatus: (id: ID, status: EventStatus) => http.patch<HostelEvent>(`/events/${id}/status`, { status }),
};

export const httpFeedbackService: IFeedbackService = {
  list: (filters = {}) => http.get<FeedbackView[]>('/feedback', filters),
  mine: () => http.get<FeedbackView[]>('/feedback/mine'),
  submit: (input: FeedbackInput) => http.post<Feedback>('/feedback', input),
  summary: () => http.get<FeedbackSummary>('/feedback/summary'),
};

export const httpDocumentService: IDocumentService = {
  mine: () => http.get<DocumentRecord[]>('/documents/mine'),
  forStudent: (studentId: ID) => http.get<DocumentRecord[]>('/documents', { studentId }),
  async upload(docId: ID, file: File) {
    const uploadId = await uploadFile('document', file);
    return http.post<DocumentRecord>(`/documents/${docId}/upload`, { uploadId });
  },
  remove: (docId: ID) => http.post<DocumentRecord>(`/documents/${docId}/remove`),
  review: (docId: ID, decision, note) => http.post<DocumentRecord>(`/documents/${docId}/review`, { decision, note }),
  fileUrl: async (docId: ID) => (await http.get<{ url: string }>(`/documents/${docId}/file`)).url,
};

export const httpEmergencyService: IEmergencyService = {
  list: (filters = {}) => http.get<EmergencyAlertView[]>('/emergency', filters),
  raise: (input) => http.post<EmergencyAlertView>('/emergency', input),
  acknowledge: (id: ID) => http.post<EmergencyAlertView>(`/emergency/${id}/acknowledge`),
  resolve: (id: ID, note?: string) => http.post<EmergencyAlertView>(`/emergency/${id}/resolve`, { note }),
};

export const httpUploadService: IUploadService = {
  fileUrl: async (uploadId: ID) => (await http.get<{ url: string }>(`/uploads/${uploadId}/url`)).url,
};

export const httpSettingsService: ISettingsService = {
  get: () => http.get<OrganizationSettings>('/settings'),
  update: (patch: Partial<OrganizationSettings>) => http.patch<OrganizationSettings>('/settings', patch),
  planUsage: () => http.get<PlanUsage>('/settings/plan'),
  changePlan: (planId: ID) => http.post<PlanUsage>('/settings/plan', { planId }),
};

export const httpSearchService: ISearchService = {
  search: (query: string) => http.get<SearchResult[]>('/search', { q: query }),
};
