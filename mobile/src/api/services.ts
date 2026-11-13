import { http } from './client';
import { tokens } from './tokens';
import { uploadFile } from './files';
import type {
  AnnouncementInput, AnnouncementView, ChargeView, CollectionSummary, ComplaintUpdate, ComplaintView, EmergencyAlertView,
  EventView, FeedbackInput, FeedbackView, IAnalyticsService, IAnnouncementService, IComplaintService, IDocumentService,
  IEmergencyService, IEventService, IFeedbackService, IInventoryService, ILeaveService, IMaintenanceService,
  INotificationService, IPaymentService, IPropertyService, IRoomService, IStaffService, IStudentService, IVisitorService,
  InventoryView, LeaveInput, LeaveView, MaintenanceUpdate, MaintenanceView, ManagerOverview, OnlinePaymentResult,
  OwnerOverview, PaymentView, PropertyWithStats, RecordPaymentInput, RoomWithBeds, SessionInfo, StaffView,
  StockAdjustInput, StudentDetail, StudentListItem, StudentSelfUpdate, TrendPoint, VisitorInput, VisitorView, WalkInInput,
} from '@/contract/interfaces';
import type {
  Announcement, Complaint, DocumentRecord, Feedback, InventoryItem, LeaveRequest, MaintenanceTicket, Notification,
  Payment, PendingOnlinePayment, Receipt, Role, StudentProfile, User, VisitorRequest,
} from '@/contract/domain';
import type { AppConfig, DeviceRegistration, DeviceView, LocalFile, MobileComplaintInput } from '@/contract/mobile';

// Typed against the web contract: each method's type comes from the matching
// I*Service in contract/interfaces.ts, so a contract change breaks typecheck
// here instead of failing at runtime. Only the calls the app makes are listed.

type LoginResponse = SessionInfo & { accessToken: string; refreshToken: string };
async function keepTokens(r: LoginResponse): Promise<SessionInfo> {
  await tokens.set({ accessToken: r.accessToken, refreshToken: r.refreshToken });
  return { session: r.session, user: r.user };
}

export const auth = {
  async login(input: { role: Role; identifier: string; password: string }): Promise<SessionInfo> {
    return keepTokens(await http.post<LoginResponse>('/auth/login', input, false));
  },
  session: () => http.get<SessionInfo>('/auth/session'),
  async logout(): Promise<void> {
    const refreshToken = await tokens.refreshToken();
    try { if (refreshToken) await http.post('/auth/logout', { refreshToken }, false); } finally { await tokens.clear(); }
  },
  async logoutAll(): Promise<void> {
    try { await http.post('/auth/logout-all'); } finally { await tokens.clear(); }
  },
  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    // Every other session ends; the API hands this phone a fresh one.
    await keepTokens(await http.post<LoginResponse>('/auth/change-password', { currentPassword, newPassword }));
  },
  updateProfile: (patch: { name?: string; phone?: string }) => http.patch<User>('/auth/profile', patch),
};

export const app = {
  config: () => http.get<AppConfig>('/app/config', undefined, false),
  registerDevice: (input: DeviceRegistration) => http.post<DeviceView>('/devices', input),
  unregisterDevice: (pushToken: string) => http.del<{ removed: number }>(`/devices/${encodeURIComponent(pushToken)}`),
};

export const properties: Pick<IPropertyService, 'list' | 'get'> = {
  list: (filters = {}) => http.get<PropertyWithStats[]>('/properties', filters),
  get: (id) => http.get<PropertyWithStats>(`/properties/${id}`),
};

export const rooms: Pick<IRoomService, 'list'> = {
  list: (filters = {}) => http.get<RoomWithBeds[]>('/rooms', filters),
};

export const students: Pick<IStudentService, 'list' | 'get' | 'me' | 'updateSelf'> = {
  list: (filters = {}) => http.get<StudentListItem[]>('/students', filters),
  get: (id) => http.get<StudentDetail>(`/students/${id}`),
  me: () => http.get<StudentDetail>('/students/me'),
  updateSelf: (patch: StudentSelfUpdate) => http.patch<StudentProfile>('/students/self', patch),
};

export const payments: Pick<IPaymentService,
  'listCharges' | 'listPayments' | 'summary' | 'recordPayment' | 'getReceipt' | 'sendReminders' | 'payNow' | 'verifyOnlinePayment'> = {
  listCharges: (filters = {}) => http.get<ChargeView[]>('/charges', filters),
  listPayments: (filters = {}) => http.get<PaymentView[]>('/payments', filters),
  summary: (filters = {}) => http.get<CollectionSummary>('/payments/summary', filters),
  recordPayment: (input: RecordPaymentInput) => http.post<Payment>('/payments/record', input),
  getReceipt: (paymentId) => http.get<Receipt>(`/payments/${paymentId}/receipt`),
  sendReminders: (chargeIds) => http.post<number>('/payments/reminders', { chargeIds }),
  payNow: (chargeId, method) => http.post<Payment | PendingOnlinePayment>('/payments/pay-now', { chargeId, method }),
  verifyOnlinePayment: (input) => http.post<OnlinePaymentResult>('/payments/verify', input),
};
export const receiptPdfPath = (paymentId: string) => `/payments/${paymentId}/receipt.pdf`;

export const complaints: Pick<IComplaintService, 'list' | 'get' | 'update' | 'addComment'> & {
  create(input: MobileComplaintInput): Promise<Complaint>;
} = {
  list: (filters = {}) => http.get<ComplaintView[]>('/complaints', filters),
  get: (id) => http.get<ComplaintView>(`/complaints/${id}`),
  async create(input) {
    // Files go to storage first; the complaint then claims them by upload id.
    const attachments: string[] = [];
    for (const f of input.attachments) attachments.push(await uploadFile('complaint', f));
    return http.post<Complaint>('/complaints', { ...input, attachments });
  },
  update: (id, patch: ComplaintUpdate) => http.patch<Complaint>(`/complaints/${id}`, patch),
  addComment: (id, body, internal) => http.post<Complaint>(`/complaints/${id}/comments`, { body, internal }),
};

export const leave: ILeaveService = {
  list: (filters = {}) => http.get<LeaveView[]>('/leave', filters),
  create: (input: LeaveInput) => http.post<LeaveRequest>('/leave', input),
  decide: (id, decision, reason) => http.post<LeaveRequest>(`/leave/${id}/decide`, { decision, reason }),
  cancel: (id) => http.post<LeaveRequest>(`/leave/${id}/cancel`),
};

export const visitors: IVisitorService = {
  list: (filters = {}) => http.get<VisitorView[]>('/visitors', filters),
  create: (input: VisitorInput) => http.post<VisitorRequest>('/visitors', input),
  createWalkIn: (input: WalkInInput) => http.post<VisitorRequest>('/visitors/walk-in', input),
  decide: (id, decision, reason) => http.post<VisitorRequest>(`/visitors/${id}/decide`, { decision, reason }),
  checkIn: (id) => http.post<VisitorRequest>(`/visitors/${id}/check-in`),
  checkOut: (id) => http.post<VisitorRequest>(`/visitors/${id}/check-out`),
  cancel: (id) => http.post<VisitorRequest>(`/visitors/${id}/cancel`),
};

export const maintenance: Pick<IMaintenanceService, 'list' | 'update'> = {
  list: (filters = {}) => http.get<MaintenanceView[]>('/maintenance', filters),
  update: (id, patch: MaintenanceUpdate) => http.patch<MaintenanceTicket>(`/maintenance/${id}`, patch),
};

export const inventory: Pick<IInventoryService, 'list' | 'adjust'> = {
  list: (filters = {}) => http.get<InventoryView[]>('/inventory', { ...filters, lowStockOnly: filters.lowStockOnly ? 'true' : undefined }),
  adjust: (input: StockAdjustInput) => http.post<InventoryItem>('/inventory/adjust', input),
};

export const announcements: Pick<IAnnouncementService, 'list' | 'create' | 'markRead'> = {
  list: (filters = {}) => http.get<AnnouncementView[]>('/announcements', filters),
  create: (input: AnnouncementInput, publish) => http.post<Announcement>('/announcements', { ...input, publish }),
  markRead: async (id, read) => { await http.post(`/announcements/${id}/read`, { read }); },
};

export const events: Pick<IEventService, 'list'> = {
  list: (filters = {}) => http.get<EventView[]>('/events', filters),
};

export const staff: Pick<IStaffService, 'list'> = {
  list: (filters = {}) => http.get<StaffView[]>('/staff', filters),
};

export const feedback: Pick<IFeedbackService, 'mine' | 'submit'> = {
  mine: () => http.get<FeedbackView[]>('/feedback/mine'),
  submit: (input: FeedbackInput) => http.post<Feedback>('/feedback', input),
};

export const documents: Pick<IDocumentService, 'mine' | 'fileUrl' | 'remove'> & {
  upload(docId: string, file: LocalFile): Promise<DocumentRecord>;
} = {
  mine: () => http.get<DocumentRecord[]>('/documents/mine'),
  async upload(docId, file) {
    const uploadId = await uploadFile('document', file);
    return http.post<DocumentRecord>(`/documents/${docId}/upload`, { uploadId });
  },
  remove: (docId) => http.post<DocumentRecord>(`/documents/${docId}/remove`),
  fileUrl: async (docId) => (await http.get<{ url: string }>(`/documents/${docId}/file`)).url,
};

export const emergency: IEmergencyService = {
  list: (filters = {}) => http.get<EmergencyAlertView[]>('/emergency', filters),
  raise: (input) => http.post<EmergencyAlertView>('/emergency', input),
  acknowledge: (id) => http.post<EmergencyAlertView>(`/emergency/${id}/acknowledge`),
  resolve: (id, note) => http.post<EmergencyAlertView>(`/emergency/${id}/resolve`, { note }),
};

export const notifications: INotificationService = {
  list: (filters = {}) => http.get<Notification[]>('/notifications', filters),
  markRead: async (id, read) => { await http.patch(`/notifications/${id}`, { read }); },
  markAllRead: async () => { await http.patch('/notifications/read-all'); },
};

export const analytics: IAnalyticsService = {
  ownerOverview: (period) => http.get<OwnerOverview>('/analytics/owner-overview', { period }),
  trends: (filters) => http.get<TrendPoint[]>('/analytics/trends', filters),
  propertyComparison: () => http.get<PropertyWithStats[]>('/analytics/property-comparison'),
  managerOverview: () => http.get<ManagerOverview>('/analytics/manager-overview'),
};
