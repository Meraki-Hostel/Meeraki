export type Role = 'student' | 'manager' | 'owner'

export type PlanTier = 'Starter' | 'Professional' | 'Enterprise'

export interface Property {
  id: string
  name: string
  city: string
  area: string
  address: string
  plan: PlanTier
  managerName: string
  managerPhone: string
  buildings: string[]
  colleges: string[]
  established: number
}

export interface Room {
  id: string
  propertyId: string
  building: string
  floor: number
  number: string
  type: 'Single' | 'Double' | 'Triple' | 'Quad'
  rent: number
  amenities: string[]
}

export type BedStatus = 'occupied' | 'vacant' | 'reserved' | 'maintenance'

export interface Bed {
  id: string
  roomId: string
  propertyId: string
  label: string
  status: BedStatus
  studentId: string | null
}

export type StudentStatus = 'active' | 'checked-out'

export interface Student {
  id: string
  propertyId: string
  name: string
  gender: 'M' | 'F'
  phone: string
  email: string
  guardianName: string
  guardianPhone: string
  college: string
  course: string
  idNumber: string
  bedId: string | null
  status: StudentStatus
  joinDate: string
  checkoutDate?: string
  monthlyRent: number
  deposit: number
  bloodGroup: string
  hometown: string
}

/** A monthly rent invoice. Status is derived from paid/amount/dueDate. */
export interface Due {
  id: string
  studentId: string
  propertyId: string
  cycle: string // "2026-10"
  amount: number
  paid: number
  dueDate: string
}

export type PaymentMethod = 'Cash' | 'UPI' | 'Bank Transfer' | 'Online (UPI)' | 'Online (Card)'

export interface Transaction {
  id: string
  receiptNo: string
  dueId: string
  studentId: string
  propertyId: string
  amount: number
  method: PaymentMethod
  reference?: string
  date: string
  recordedBy: string
}

export type PaymentStatus = 'paid' | 'pending' | 'partial' | 'overdue'

export type ComplaintStatus = 'open' | 'in-progress' | 'resolved'
export type ComplaintCategory = 'Electrical' | 'Plumbing' | 'Cleaning' | 'WiFi' | 'Food' | 'Room' | 'Other'
export type Priority = 'low' | 'medium' | 'high'

export interface ComplaintEvent {
  at: string
  status: ComplaintStatus | 'assigned' | 'created'
  note: string
  by: string
}

export interface Complaint {
  id: string
  number: number
  propertyId: string
  studentId: string | null
  roomId: string | null
  category: ComplaintCategory
  title: string
  description: string
  priority: Priority
  status: ComplaintStatus
  assignedTo: string | null
  hasImage: boolean
  createdAt: string
  updatedAt: string
  history: ComplaintEvent[]
}

export type LeaveStatus = 'pending' | 'approved' | 'rejected'

export interface LeaveRequest {
  id: string
  studentId: string
  propertyId: string
  type: 'Leave' | 'Outing'
  from: string // ISO datetime
  to: string
  reason: string
  status: LeaveStatus
  createdAt: string
  decidedAt?: string
  decisionNote?: string
}

export type VisitorStatus = 'pending' | 'approved' | 'rejected' | 'checked-in' | 'checked-out'

export interface Visitor {
  id: string
  studentId: string
  propertyId: string
  name: string
  phone: string
  relation: string
  purpose: string
  expectedAt: string
  status: VisitorStatus
  checkInAt?: string
  checkOutAt?: string
  createdAt: string
}

export type Attendance = 'present' | 'absent' | 'leave'

export interface Staff {
  id: string
  propertyId: string
  name: string
  role: 'Manager' | 'Warden' | 'Cleaner' | 'Security' | 'Cook' | 'Electrician' | 'Plumber' | 'Housekeeping' | 'Maintenance'
  phone: string
  shift: 'Morning' | 'Evening' | 'Night' | 'General'
  attendance: Attendance
  joinedOn: string
  salary: number
  permissions: string[]
}

export interface StaffRequirement {
  id: string
  propertyId: string
  title: string
  openings: number
  note: string
  createdAt: string
}

export type MaintenanceStatus = 'open' | 'in-progress' | 'done'

export interface MaintenanceTask {
  id: string
  propertyId: string
  title: string
  roomId: string | null
  complaintId: string | null
  assignedTo: string | null
  priority: Priority
  cost: number
  status: MaintenanceStatus
  createdAt: string
  completedAt?: string
}

export interface InventoryLog {
  id: string
  delta: number
  kind: 'purchased' | 'issued' | 'damaged' | 'adjusted'
  note: string
  date: string
}

export interface InventoryItem {
  id: string
  propertyId: string
  name: string
  category: 'Furniture' | 'Bedding' | 'Electrical' | 'Cleaning' | 'Kitchen' | 'Hardware'
  stock: number
  min: number
  unit: string
  unitCost: number
  log: InventoryLog[]
}

export type AnnouncementCategory = 'General' | 'Maintenance' | 'Event' | 'Important'

export interface Announcement {
  id: string
  propertyId: string
  title: string
  message: string
  category: AnnouncementCategory
  audience: 'all' | 'floor' | 'room'
  audienceValue?: string // floor number or roomId
  pinned: boolean
  createdAt: string
  author: string
}

export type EventStatus = 'Planning' | 'Confirmed' | 'Completed' | 'Cancelled'

export interface HostelEvent {
  id: string
  propertyId: string
  name: string
  date: string
  location: string
  description: string
  participants: number
  budget: number
  status: EventStatus
  rsvps: string[]
}

export const FEEDBACK_CATEGORIES = ['cleanliness', 'food', 'maintenance', 'staff', 'safety', 'wifi'] as const
export type FeedbackCategory = (typeof FEEDBACK_CATEGORIES)[number]

export interface Feedback {
  id: string
  studentId: string
  propertyId: string
  month: string // "2026-09"
  ratings: Record<FeedbackCategory, number>
  comment: string
  createdAt: string
}

export interface Expense {
  id: string
  propertyId: string
  category: 'Salaries' | 'Electricity' | 'Water' | 'Groceries' | 'Maintenance' | 'Internet' | 'Supplies' | 'Events' | 'Other'
  amount: number
  date: string
  description: string
}

export type ActivityKind =
  | 'student' | 'payment' | 'complaint' | 'leave' | 'visitor' | 'room'
  | 'inventory' | 'announcement' | 'event' | 'staff' | 'maintenance' | 'emergency' | 'expense' | 'feedback'

export interface Activity {
  id: string
  propertyId: string
  kind: ActivityKind
  message: string
  at: string
  actor: string
  studentId?: string
  roomId?: string
}

export interface EmergencyAlert {
  id: string
  studentId: string
  propertyId: string
  at: string
  note: string
  status: 'active' | 'acknowledged'
  acknowledgedAt?: string
}

export interface StudentNotification {
  id: string
  studentId: string
  title: string
  body: string
  link: string
  at: string
  read: boolean
}

export interface StudentDocument {
  id: string
  studentId: string
  name: string
  kind: 'ID Proof' | 'Agreement' | 'Photo' | 'Other'
  size: string
  uploadedAt: string
}

export interface OrgSettings {
  orgName: string
  gstin: string
  lateFeePerDay: number
  rentDueDay: number
  notifyOverdue: boolean
  notifyEmergency: boolean
  notifyWeeklyDigest: boolean
}

export interface AppData {
  version: number
  properties: Property[]
  rooms: Room[]
  beds: Bed[]
  students: Student[]
  dues: Due[]
  transactions: Transaction[]
  complaints: Complaint[]
  leaves: LeaveRequest[]
  visitors: Visitor[]
  staff: Staff[]
  requirements: StaffRequirement[]
  maintenance: MaintenanceTask[]
  inventory: InventoryItem[]
  announcements: Announcement[]
  events: HostelEvent[]
  feedback: Feedback[]
  expenses: Expense[]
  activity: Activity[]
  alerts: EmergencyAlert[]
  studentNotifications: StudentNotification[]
  documents: StudentDocument[]
  settings: OrgSettings
  counters: { receipt: number; complaint: number }
}

export interface Session {
  role: Role
  studentId: string
  managerPropertyId: string
  readNotifications: string[]
}
