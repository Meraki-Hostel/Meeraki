import type {
  ActivityCategory, ActivityLog, Announcement, AnnouncementAudience, AnnouncementCategory, Bed, BedStatus, ChargeStatus,
  ChargeWithBalance, Complaint, ComplaintCategory, ComplaintStatus, DocumentRecord, Feedback, FeedbackCategory, HostelEvent,
  EventCategory, EventStatus, ID, InventoryCategory, InventoryItem, InventoryTransaction, InventoryTxnType, Invitation,
  LeaveRequest, MaintenanceCategory, MaintenanceStatus, MaintenanceTicket, Notification, NotificationCategory,
  OrganizationSettings, Payment, PaymentMethod, Priority, Property, PropertyStatus, PropertyType, Receipt, Role, Room,
  RoomStatus, RoomType, Session, Shift, StaffMember, StaffRole, StaffStatus, StudentProfile, StudentStatus, SubscriptionPlan, User,
  UserPreferences, VisitorRequest,
} from '@/types/domain';

/* ---------------- Read models ---------------- */
export interface PropertyStats {
  rooms: number;
  beds: number;
  occupiedBeds: number;
  availableBeds: number;
  unavailableBeds: number;
  occupancyPct: number;
  students: number;
  expectedRent: number;
  collectedRent: number;
  openComplaints: number;
  managerName?: string;
}
export type PropertyWithStats = Property & { stats: PropertyStats };

export interface BedView extends Bed { studentName?: string; studentCode?: string }
export interface RoomWithBeds extends Room { beds: BedView[]; propertyName: string }

export interface StudentListItem extends StudentProfile {
  propertyName: string;
  roomNumber?: string;
  bedLabel?: string;
  balance: number;
}
export interface StudentDetail {
  student: StudentListItem;
  charges: ChargeWithBalance[];
  payments: Payment[];
  documents: DocumentRecord[];
  complaints: ComplaintView[];
  leaves: LeaveView[];
  visitors: VisitorView[];
}

export interface ChargeView extends ChargeWithBalance { studentName: string; studentCode: string; roomNumber?: string; propertyName: string }
export interface PaymentView extends Payment { studentName: string; studentCode: string; propertyName: string; period: string }
export interface CollectionSummary { expected: number; collected: number; pending: number; overdue: number; collectionPct: number; overdueCount: number; pendingCount: number }

export interface ComplaintView extends Complaint { studentName: string; propertyName: string; roomNumber?: string; assigneeName?: string }
export interface LeaveView extends LeaveRequest { studentName: string; roomNumber?: string; propertyName: string }
export interface VisitorView extends VisitorRequest { studentName: string; roomNumber?: string; propertyName: string }
export interface MaintenanceView extends MaintenanceTicket { propertyName: string; assigneeName?: string }
export interface InventoryView extends InventoryItem { propertyName: string; lowStock: boolean }
export interface InventoryTxnView extends InventoryTransaction { itemName: string; unit: string }
export interface AnnouncementView extends Announcement { propertyName: string; isRead?: boolean }
export interface EventView extends HostelEvent { propertyName: string }
export interface StaffView extends StaffMember { propertyName?: string }
export interface FeedbackView extends Feedback { studentName: string; propertyName: string }
export interface ActivityView extends ActivityLog { propertyName?: string }

export interface PersonaSummary { user: User; subtitle: string }
export interface SessionInfo { session: Session; user: User }

export interface SearchResult { id: string; kind: 'student' | 'room' | 'property' | 'complaint' | 'staff' | 'page' | 'notice' | 'payment'; title: string; subtitle: string; link: string }

/* ---------------- Inputs ---------------- */
export interface PasswordLoginInput { role: Role; identifier: string; password: string; remember: boolean }
export interface PropertyInput { name: string; code: string; type: PropertyType; status: PropertyStatus; locality: string; city: string; address: string; pincode: string; phone: string; baseRent: number; amenities: string[]; managerStaffId?: ID }
export interface RoomInput { propertyId?: ID; number: string; floor: number; type: RoomType; rent: number; ac: boolean; attachedBath: boolean; status?: RoomStatus }
export interface StudentInput {
  name: string; email: string; phone: string; gender: StudentProfile['gender']; dob: string; studentCode: string;
  college: string; course: string; year: number; address: string; bloodGroup: string;
  guardianName: string; guardianRelation: string; guardianPhone: string; emergencyName: string; emergencyPhone: string;
  joinedOn: string; monthlyRent: number; bedId?: ID;
}
export type StudentSelfUpdate = Pick<StudentProfile, 'email' | 'phone' | 'address' | 'emergencyName' | 'emergencyPhone' | 'bloodGroup'>;
export interface RecordPaymentInput { chargeId: ID; amount: number; method: PaymentMethod; paidOn: string; reference: string; note?: string }
export interface ChargeFilters { studentId?: ID; propertyId?: ID; period?: string; status?: ChargeStatus }
export interface PaymentFilters { studentId?: ID; propertyId?: ID; method?: PaymentMethod; from?: string; to?: string }
export interface ComplaintInput { category: ComplaintCategory; title: string; description: string; priority: Priority; attachments: string[] }
export interface ComplaintUpdate { status?: ComplaintStatus; priority?: Priority; assigneeStaffId?: ID | null; note?: string }
export interface LeaveInput { from: string; to: string; destination: string; contactPhone: string; reason: string }
export interface VisitorInput { visitorName: string; visitorPhone: string; relation: string; visitDate: string; visitTime: string; purpose: string }
export interface WalkInInput extends VisitorInput { studentId: ID }
export interface MaintenanceInput { title: string; description: string; category: MaintenanceCategory; location: string; priority: Priority; assigneeStaffId?: ID; vendor?: string; estimatedCost: number; propertyId?: ID }
export interface MaintenanceUpdate { status?: MaintenanceStatus; priority?: Priority; assigneeStaffId?: ID | null; vendor?: string; estimatedCost?: number; actualCost?: number }
export interface InventoryItemInput { propertyId?: ID; name: string; sku: string; category: InventoryCategory; unit: string; quantity: number; reorderLevel: number; unitCost: number }
export interface StockAdjustInput { itemId: ID; type: InventoryTxnType; quantity: number; note: string }
export interface AnnouncementInput { title: string; body: string; category: AnnouncementCategory; audience: AnnouncementAudience }
export interface EventInput { propertyId?: ID; title: string; description: string; category: EventCategory; date: string; startTime: string; endTime: string; location: string; capacity: number; expectedAttendance: number }
export interface StaffInput { name: string; role: StaffRole; propertyId?: ID; phone: string; email: string; shift: Shift; status?: StaffStatus; sendInvite: boolean }
export interface FeedbackInput { category: FeedbackCategory; rating: Feedback['rating']; comment: string; anonymous: boolean }
export interface ActivityFilters { propertyId?: ID; category?: ActivityCategory; from?: string; to?: string; limit?: number }
export interface TrendFilters { propertyId?: ID; months: number }

export interface OwnerOverview {
  properties: number; activeProperties: number; rooms: number; beds: number; occupiedBeds: number; students: number;
  occupancyPct: number; expectedRent: number; collection: CollectionSummary; lastMonthCollectionPct: number;
}
export interface TrendPoint { period: string; label: string; occupancyPct: number; expected: number; collected: number; arrears: number; complaints: number }
export interface ManagerOverview {
  property: PropertyWithStats; collection: CollectionSummary; openComplaints: number; urgentComplaints: number;
  pendingLeaves: number; visitorsToday: number; openMaintenance: number; lowStock: number; departuresThisWeek: number;
}
export interface FeedbackSummary { average: number; total: number; byCategory: Array<{ category: FeedbackCategory; average: number; count: number }>; distribution: Array<{ rating: number; count: number }> }
export interface PlanUsage { plan: SubscriptionPlan; plans: SubscriptionPlan[]; properties: number; beds: number; staff: number }

/* ---------------- Services ---------------- */
export interface IAuthService {
  getSession(): Promise<SessionInfo | null>;
  listPersonas(): Promise<PersonaSummary[]>;
  loginWithPassword(input: PasswordLoginInput): Promise<SessionInfo>;
  loginAsPersona(userId: ID): Promise<SessionInfo>;
  logout(): Promise<void>;
  requestPasswordReset(identifier: string): Promise<{ maskedDestination: string }>;
  resetPassword(token: string, password: string): Promise<void>;
  getInvitation(token: string): Promise<Invitation>;
  acceptInvitation(token: string, password: string): Promise<void>;
  updateProfile(patch: { name?: string; phone?: string; preferences?: Partial<UserPreferences> }): Promise<User>;
}
export interface IPropertyService {
  list(filters?: { search?: string; status?: PropertyStatus; type?: PropertyType }): Promise<PropertyWithStats[]>;
  get(id: ID): Promise<PropertyWithStats>;
  create(input: PropertyInput): Promise<Property>;
  update(id: ID, input: Partial<PropertyInput>): Promise<Property>;
  setStatus(id: ID, status: PropertyStatus): Promise<Property>;
}
export interface IRoomService {
  list(filters?: { propertyId?: ID }): Promise<RoomWithBeds[]>;
  create(input: RoomInput): Promise<Room>;
  update(id: ID, input: Partial<RoomInput>): Promise<Room>;
  setBedStatus(bedId: ID, status: Exclude<BedStatus, 'occupied'>, reason?: string): Promise<Bed>;
  assignBed(studentId: ID, bedId: ID): Promise<void>;
  vacateBed(studentId: ID): Promise<void>;
}
export interface IStudentService {
  list(filters?: { search?: string; status?: StudentStatus; propertyId?: ID }): Promise<StudentListItem[]>;
  get(id: ID): Promise<StudentDetail>;
  me(): Promise<StudentDetail>;
  create(input: StudentInput): Promise<StudentProfile>;
  update(id: ID, patch: Partial<StudentInput>): Promise<StudentProfile>;
  setStatus(id: ID, status: StudentStatus): Promise<StudentProfile>;
  updateSelf(patch: StudentSelfUpdate): Promise<StudentProfile>;
  nextStudentCode(): Promise<string>;
}
export interface IPaymentService {
  listCharges(filters?: ChargeFilters): Promise<ChargeView[]>;
  listPayments(filters?: PaymentFilters): Promise<PaymentView[]>;
  summary(filters?: { propertyId?: ID; period?: string }): Promise<CollectionSummary>;
  recordPayment(input: RecordPaymentInput): Promise<Payment>;
  getReceipt(paymentId: ID): Promise<Receipt>;
  sendReminders(chargeIds: ID[]): Promise<number>;
  payNow(chargeId: ID, method: 'upi' | 'card' | 'netbanking'): Promise<Payment>;
}
export interface IComplaintService {
  list(filters?: { status?: ComplaintStatus; priority?: Priority; propertyId?: ID; category?: ComplaintCategory }): Promise<ComplaintView[]>;
  get(id: ID): Promise<ComplaintView>;
  create(input: ComplaintInput): Promise<Complaint>;
  update(id: ID, patch: ComplaintUpdate): Promise<Complaint>;
  addComment(id: ID, body: string, internal: boolean): Promise<Complaint>;
}
export interface ILeaveService {
  list(filters?: { status?: LeaveRequest['status'] }): Promise<LeaveView[]>;
  create(input: LeaveInput): Promise<LeaveRequest>;
  decide(id: ID, decision: 'approved' | 'rejected', reason?: string): Promise<LeaveRequest>;
  cancel(id: ID): Promise<LeaveRequest>;
}
export interface IVisitorService {
  list(filters?: { status?: VisitorRequest['status']; date?: string }): Promise<VisitorView[]>;
  create(input: VisitorInput): Promise<VisitorRequest>;
  createWalkIn(input: WalkInInput): Promise<VisitorRequest>;
  decide(id: ID, decision: 'approved' | 'rejected', reason?: string): Promise<VisitorRequest>;
  checkIn(id: ID): Promise<VisitorRequest>;
  checkOut(id: ID): Promise<VisitorRequest>;
  cancel(id: ID): Promise<VisitorRequest>;
}
export interface IMaintenanceService {
  list(filters?: { status?: MaintenanceStatus; priority?: Priority }): Promise<MaintenanceView[]>;
  create(input: MaintenanceInput): Promise<MaintenanceTicket>;
  update(id: ID, patch: MaintenanceUpdate): Promise<MaintenanceTicket>;
}
export interface IInventoryService {
  list(filters?: { propertyId?: ID; category?: InventoryCategory; lowStockOnly?: boolean }): Promise<InventoryView[]>;
  transactions(filters?: { itemId?: ID; propertyId?: ID }): Promise<InventoryTxnView[]>;
  create(input: InventoryItemInput): Promise<InventoryItem>;
  adjust(input: StockAdjustInput): Promise<InventoryItem>;
}
export interface IAnnouncementService {
  list(filters?: { status?: Announcement['status'] }): Promise<AnnouncementView[]>;
  create(input: AnnouncementInput, publish: boolean): Promise<Announcement>;
  update(id: ID, input: AnnouncementInput): Promise<Announcement>;
  publish(id: ID): Promise<Announcement>;
  archive(id: ID): Promise<Announcement>;
  markRead(id: ID, read: boolean): Promise<void>;
  markAllRead(): Promise<void>;
}
export interface IEventService {
  list(filters?: { propertyId?: ID; status?: EventStatus }): Promise<EventView[]>;
  create(input: EventInput): Promise<HostelEvent>;
  update(id: ID, input: Partial<EventInput>): Promise<HostelEvent>;
  setStatus(id: ID, status: EventStatus): Promise<HostelEvent>;
}
export interface IStaffService {
  list(filters?: { propertyId?: ID; role?: StaffRole; status?: StaffStatus }): Promise<StaffView[]>;
  create(input: StaffInput): Promise<StaffMember>;
  update(id: ID, input: Partial<StaffInput>): Promise<StaffMember>;
  setStatus(id: ID, status: StaffStatus): Promise<StaffMember>;
}
export interface IFeedbackService {
  list(filters?: { category?: FeedbackCategory }): Promise<FeedbackView[]>;
  mine(): Promise<FeedbackView[]>;
  submit(input: FeedbackInput): Promise<Feedback>;
  summary(): Promise<FeedbackSummary>;
}
export interface IDocumentService {
  mine(): Promise<DocumentRecord[]>;
  upload(docId: ID, file: { name: string; sizeKb: number }): Promise<DocumentRecord>;
  remove(docId: ID): Promise<DocumentRecord>;
  review(docId: ID, decision: 'verified' | 'rejected', note?: string): Promise<DocumentRecord>;
}
export interface INotificationService {
  list(filters?: { category?: NotificationCategory; unreadOnly?: boolean }): Promise<Notification[]>;
  markRead(id: ID, read: boolean): Promise<void>;
  markAllRead(): Promise<void>;
}
export interface IActivityService { list(filters?: ActivityFilters): Promise<ActivityView[]> }
export interface IAnalyticsService {
  ownerOverview(period?: string): Promise<OwnerOverview>;
  trends(filters: TrendFilters): Promise<TrendPoint[]>;
  propertyComparison(): Promise<PropertyWithStats[]>;
  managerOverview(): Promise<ManagerOverview>;
}
export interface ISettingsService {
  get(): Promise<OrganizationSettings>;
  update(patch: Partial<OrganizationSettings>): Promise<OrganizationSettings>;
  planUsage(): Promise<PlanUsage>;
  changePlan(planId: ID): Promise<PlanUsage>;
  resetDemoData(): Promise<void>;
}
export interface ISearchService { search(query: string): Promise<SearchResult[]> }

export interface Services {
  auth: IAuthService; properties: IPropertyService; rooms: IRoomService; students: IStudentService; payments: IPaymentService;
  complaints: IComplaintService; leave: ILeaveService; visitors: IVisitorService; maintenance: IMaintenanceService;
  inventory: IInventoryService; announcements: IAnnouncementService; events: IEventService; staff: IStaffService;
  feedback: IFeedbackService; documents: IDocumentService; notifications: INotificationService; activity: IActivityService;
  analytics: IAnalyticsService; settings: ISettingsService; search: ISearchService;
}
