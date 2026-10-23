/**
 * Meraki domain model. All dates are ISO strings (YYYY-MM-DD for dates,
 * full ISO for timestamps). IDs are stable, prefixed strings (e.g. `prop_crown`).
 */

export type ID = string;
export type ISODate = string;
export type ISODateTime = string;

/* ---------- Identity ---------- */
export type Role = 'owner' | 'manager' | 'student';

export interface User {
  id: ID;
  name: string;
  email: string;
  phone: string;
  role: Role;
  title: string;
  /** Manager: assigned property. Student: resident property. */
  propertyId?: ID;
  studentId?: ID;
  staffId?: ID;
  preferences: UserPreferences;
}

export interface UserPreferences {
  emailDigest: boolean;
  smsAlerts: boolean;
  compactTables: boolean;
}

export interface Session {
  userId: ID;
  role: Role;
  startedAt: ISODateTime;
  method: 'demo' | 'password';
}

export type InvitationStatus = 'pending' | 'accepted' | 'expired';
export interface Invitation {
  token: string;
  name: string;
  email: string;
  role: Role | 'staff';
  propertyId?: ID;
  invitedBy: string;
  status: InvitationStatus;
  expiresAt: ISODateTime;
}

/* ---------- Organization ---------- */
export interface Organization {
  id: ID;
  name: string;
  planId: ID;
}

export interface OrganizationSettings {
  orgName: string;
  legalName: string;
  contactEmail: string;
  contactPhone: string;
  address: string;
  gstin: string;
  website: string;
  timezone: 'Asia/Kolkata';
  currency: 'INR';
  rentDueDay: number;
  lateFeePerDay: number;
  notifications: {
    paymentReceived: boolean;
    newComplaint: boolean;
    leaveRequests: boolean;
    lowStock: boolean;
    weeklySummary: boolean;
  };
  security: {
    twoFactor: boolean;
    sessionTimeoutMins: number;
  };
}

export type PlanTier = 'starter' | 'growth' | 'portfolio';
export interface SubscriptionPlan {
  id: ID;
  tier: PlanTier;
  name: string;
  pricePerMonth: number;
  propertyLimit: number;
  bedLimit: number;
  staffLimit: number;
  features: string[];
}

/* ---------- Property / rooms ---------- */
export type PropertyStatus = 'active' | 'onboarding' | 'inactive';
export type PropertyType = 'boys' | 'girls' | 'coed';

export interface Property {
  id: ID;
  name: string;
  code: string;
  type: PropertyType;
  status: PropertyStatus;
  city: string;
  locality: string;
  address: string;
  pincode: string;
  phone: string;
  managerStaffId?: ID;
  baseRent: number;
  amenities: string[];
  openedOn: ISODate;
  /** Index into the local illustrated facade palette. */
  imageVariant: number;
}

export type RoomType = 'single' | 'double' | 'triple' | 'quad';
export type RoomStatus = 'active' | 'maintenance';

export interface Room {
  id: ID;
  propertyId: ID;
  number: string;
  floor: number;
  type: RoomType;
  rent: number;
  ac: boolean;
  attachedBath: boolean;
  status: RoomStatus;
}

export type BedStatus = 'available' | 'occupied' | 'unavailable';
export interface Bed {
  id: ID;
  roomId: ID;
  propertyId: ID;
  label: string;
  status: BedStatus;
  studentId?: ID;
  unavailableReason?: string;
}

/* ---------- People ---------- */
export type StudentStatus = 'active' | 'notice' | 'pending' | 'moved_out';
export type Gender = 'male' | 'female' | 'other';

export interface StudentProfile {
  id: ID;
  studentCode: string;
  name: string;
  email: string;
  phone: string;
  gender: Gender;
  dob: ISODate;
  college: string;
  course: string;
  year: number;
  propertyId: ID;
  roomId?: ID;
  bedId?: ID;
  status: StudentStatus;
  joinedOn: ISODate;
  monthlyRent: number;
  address: string;
  bloodGroup: string;
  guardianName: string;
  guardianRelation: string;
  guardianPhone: string;
  emergencyName: string;
  emergencyPhone: string;
}

export type StaffRole = 'manager' | 'warden' | 'accountant' | 'housekeeping' | 'security' | 'cook' | 'maintenance';
export type StaffStatus = 'active' | 'invited' | 'on_leave' | 'inactive';
export type Shift = 'general' | 'morning' | 'evening' | 'night';

export interface StaffMember {
  id: ID;
  name: string;
  role: StaffRole;
  propertyId?: ID;
  phone: string;
  email: string;
  shift: Shift;
  status: StaffStatus;
  joinedOn: ISODate;
}

/* ---------- Money ---------- */
export type ChargeStatus = 'paid' | 'partial' | 'pending' | 'overdue';
export interface RentCharge {
  id: ID;
  studentId: ID;
  propertyId: ID;
  /** Billing period, YYYY-MM. */
  period: string;
  amount: number;
  dueDate: ISODate;
  description: string;
}

export type PaymentMethod = 'upi' | 'cash' | 'bank_transfer' | 'card';
export interface Payment {
  id: ID;
  chargeId: ID;
  studentId: ID;
  propertyId: ID;
  amount: number;
  method: PaymentMethod;
  paidOn: ISODate;
  reference: string;
  receiptNo: string;
  recordedBy: string;
  note?: string;
}

/** Derived read model: a charge with its payment totals. */
export interface ChargeWithBalance extends RentCharge {
  paid: number;
  balance: number;
  status: ChargeStatus;
}

export interface Receipt {
  receiptNo: string;
  payment: Payment;
  charge: RentCharge;
  student: Pick<StudentProfile, 'id' | 'name' | 'studentCode' | 'phone'>;
  property: Pick<Property, 'id' | 'name' | 'address'>;
  roomLabel: string;
}

/* ---------- Requests ---------- */
export type Priority = 'low' | 'medium' | 'high' | 'urgent';
export type ComplaintStatus = 'open' | 'in_progress' | 'resolved' | 'closed';
export type ComplaintCategory = 'electrical' | 'plumbing' | 'cleaning' | 'internet' | 'food' | 'furniture' | 'security' | 'other';

export interface ComplaintComment {
  id: ID;
  authorName: string;
  authorRole: Role;
  body: string;
  internal: boolean;
  createdAt: ISODateTime;
}

export interface ComplaintStatusHistory {
  id: ID;
  status: ComplaintStatus;
  changedBy: string;
  note?: string;
  at: ISODateTime;
}

export interface Complaint {
  id: ID;
  ticketNo: string;
  propertyId: ID;
  studentId: ID;
  roomId?: ID;
  category: ComplaintCategory;
  title: string;
  description: string;
  priority: Priority;
  status: ComplaintStatus;
  assigneeStaffId?: ID;
  attachments: string[];
  comments: ComplaintComment[];
  history: ComplaintStatusHistory[];
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';
export interface LeaveRequest {
  id: ID;
  studentId: ID;
  propertyId: ID;
  from: ISODate;
  to: ISODate;
  destination: string;
  contactPhone: string;
  reason: string;
  status: LeaveStatus;
  decisionReason?: string;
  decidedBy?: string;
  decidedAt?: ISODateTime;
  createdAt: ISODateTime;
}

export type VisitorStatus = 'pending' | 'approved' | 'rejected' | 'checked_in' | 'checked_out' | 'cancelled';
export type VisitorSource = 'request' | 'walk_in';
export interface VisitorRequest {
  id: ID;
  studentId: ID;
  propertyId: ID;
  source: VisitorSource;
  visitorName: string;
  visitorPhone: string;
  relation: string;
  visitDate: ISODate;
  visitTime: string;
  purpose: string;
  status: VisitorStatus;
  decisionReason?: string;
  checkInAt?: ISODateTime;
  checkOutAt?: ISODateTime;
  createdAt: ISODateTime;
}
/** A visitor log row is a request that has reached check-in. */
export type VisitorLog = VisitorRequest & { checkInAt: ISODateTime };

export type MaintenanceStatus = 'open' | 'assigned' | 'in_progress' | 'on_hold' | 'completed';
export type MaintenanceCategory = 'electrical' | 'plumbing' | 'carpentry' | 'painting' | 'appliance' | 'civil' | 'pest_control';
export interface MaintenanceTicket {
  id: ID;
  ticketNo: string;
  propertyId: ID;
  title: string;
  description: string;
  category: MaintenanceCategory;
  location: string;
  priority: Priority;
  status: MaintenanceStatus;
  assigneeStaffId?: ID;
  vendor?: string;
  estimatedCost: number;
  actualCost?: number;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

/* ---------- Inventory ---------- */
export type InventoryCategory = 'linen' | 'furniture' | 'kitchen' | 'cleaning' | 'electrical' | 'stationery' | 'safety';
export interface InventoryItem {
  id: ID;
  propertyId: ID;
  name: string;
  sku: string;
  category: InventoryCategory;
  unit: string;
  quantity: number;
  reorderLevel: number;
  unitCost: number;
  updatedAt: ISODateTime;
}

export type InventoryTxnType = 'in' | 'out';
export interface InventoryTransaction {
  id: ID;
  itemId: ID;
  propertyId: ID;
  type: InventoryTxnType;
  quantity: number;
  note: string;
  by: string;
  at: ISODateTime;
}

/* ---------- Communication ---------- */
export type AnnouncementStatus = 'draft' | 'published' | 'archived';
export type AnnouncementCategory = 'general' | 'maintenance' | 'mess' | 'event' | 'urgent';
export interface AnnouncementAudience {
  type: 'all' | 'floors' | 'rooms';
  values: string[];
}
export interface Announcement {
  id: ID;
  propertyId: ID;
  title: string;
  body: string;
  category: AnnouncementCategory;
  audience: AnnouncementAudience;
  status: AnnouncementStatus;
  author: string;
  createdAt: ISODateTime;
  publishedAt?: ISODateTime;
  /** Student IDs who marked this as read. */
  readBy: ID[];
}

export type EventStatus = 'scheduled' | 'completed' | 'cancelled';
export type EventCategory = 'cultural' | 'sports' | 'workshop' | 'festival' | 'meeting' | 'health';
export interface HostelEvent {
  id: ID;
  propertyId: ID;
  title: string;
  description: string;
  category: EventCategory;
  date: ISODate;
  startTime: string;
  endTime: string;
  location: string;
  capacity: number;
  expectedAttendance: number;
  status: EventStatus;
  createdBy: string;
}

export type FeedbackCategory = 'food' | 'cleanliness' | 'staff' | 'facilities' | 'security' | 'internet' | 'other';
export interface Feedback {
  id: ID;
  propertyId: ID;
  studentId: ID;
  category: FeedbackCategory;
  rating: 1 | 2 | 3 | 4 | 5;
  comment: string;
  anonymous: boolean;
  createdAt: ISODateTime;
}

export type DocumentType = 'id_proof' | 'admission_letter' | 'photo' | 'police_verification' | 'rent_agreement' | 'medical';
export type DocumentStatus = 'missing' | 'uploaded' | 'verified' | 'rejected';
export interface DocumentRecord {
  id: ID;
  studentId: ID;
  type: DocumentType;
  status: DocumentStatus;
  fileName?: string;
  fileSizeKb?: number;
  uploadedAt?: ISODateTime;
  note?: string;
}

export type NotificationCategory = 'payment' | 'complaint' | 'leave' | 'visitor' | 'notice' | 'event' | 'maintenance' | 'inventory' | 'system';
export interface Notification {
  id: ID;
  recipientUserId: ID;
  title: string;
  body: string;
  category: NotificationCategory;
  link?: string;
  read: boolean;
  createdAt: ISODateTime;
}

export type ActivityCategory =
  | 'student' | 'payment' | 'complaint' | 'leave' | 'visitor' | 'maintenance'
  | 'inventory' | 'announcement' | 'event' | 'room' | 'property' | 'staff' | 'settings' | 'feedback';
export interface ActivityLog {
  id: ID;
  propertyId?: ID;
  actorName: string;
  actorRole: Role | 'system';
  category: ActivityCategory;
  message: string;
  link?: string;
  createdAt: ISODateTime;
}

/** Monthly snapshot used for analytics history before the live month. */
export interface MonthlySnapshot {
  propertyId: ID;
  period: string;
  occupancyPct: number;
  expected: number;
  collected: number;
  complaints: number;
}

/* ---------- Persisted demo state ---------- */
export interface DemoState {
  organization: Organization;
  settings: OrganizationSettings;
  plans: SubscriptionPlan[];
  users: User[];
  invitations: Invitation[];
  session: Session | null;
  properties: Property[];
  rooms: Room[];
  beds: Bed[];
  students: StudentProfile[];
  staff: StaffMember[];
  charges: RentCharge[];
  payments: Payment[];
  complaints: Complaint[];
  leaves: LeaveRequest[];
  visitors: VisitorRequest[];
  maintenance: MaintenanceTicket[];
  inventory: InventoryItem[];
  inventoryTxns: InventoryTransaction[];
  announcements: Announcement[];
  events: HostelEvent[];
  feedback: Feedback[];
  documents: DocumentRecord[];
  notifications: Notification[];
  activity: ActivityLog[];
  history: MonthlySnapshot[];
  counters: Record<string, number>;
}
