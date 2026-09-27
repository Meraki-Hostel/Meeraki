import {
  BedDouble, Building2, CalendarCheck, ChartColumn, FileText, Gem, History, House, IdCard, IndianRupee, LayoutDashboard,
  Megaphone, MessageSquareWarning, Package, PartyPopper, Settings, Siren, Star, User, UserCheck, Users, Wallet, Wrench, type LucideIcon,
} from 'lucide-react'
import type { AppData, Role } from '../../lib/types'
import { propertyStats } from '../../store/selectors'

export interface NavItem {
  label: string
  to: string
  icon: LucideIcon
  end?: boolean
  badge?: (d: AppData, ctx: { propertyId: string; studentId: string }) => number
  tone?: 'danger'
}
export interface NavGroup {
  label?: string
  items: NavItem[]
}

export const NAV: Record<Role, NavGroup[]> = {
  manager: [
    { items: [{ label: 'Dashboard', to: '/manager', icon: LayoutDashboard, end: true }] },
    {
      label: 'Residents',
      items: [
        { label: 'Students', to: '/manager/students', icon: Users },
        { label: 'Rooms & Beds', to: '/manager/rooms', icon: BedDouble },
        { label: 'Payments', to: '/manager/payments', icon: Wallet, badge: (d, c) => propertyStats(d, c.propertyId).overdueCount },
      ],
    },
    {
      label: 'Requests',
      items: [
        { label: 'Complaints', to: '/manager/complaints', icon: MessageSquareWarning, badge: (d, c) => propertyStats(d, c.propertyId).newComplaints },
        { label: 'Leave Requests', to: '/manager/leave', icon: CalendarCheck, badge: (d, c) => propertyStats(d, c.propertyId).pendingLeaves },
        { label: 'Visitors', to: '/manager/visitors', icon: UserCheck, badge: (d, c) => propertyStats(d, c.propertyId).pendingVisitors },
      ],
    },
    {
      label: 'Operations',
      items: [
        { label: 'Staff', to: '/manager/staff', icon: IdCard },
        { label: 'Maintenance', to: '/manager/maintenance', icon: Wrench },
        { label: 'Inventory', to: '/manager/inventory', icon: Package, badge: (d, c) => propertyStats(d, c.propertyId).lowStock },
      ],
    },
    {
      label: 'Community',
      items: [
        { label: 'Announcements', to: '/manager/announcements', icon: Megaphone },
        { label: 'Events', to: '/manager/events', icon: PartyPopper },
        { label: 'Feedback', to: '/manager/feedback', icon: Star },
        { label: 'Activity', to: '/manager/activity', icon: History },
      ],
    },
  ],
  owner: [
    { items: [{ label: 'Overview', to: '/owner', icon: LayoutDashboard, end: true }] },
    {
      label: 'Portfolio',
      items: [
        { label: 'Properties', to: '/owner/properties', icon: Building2 },
        { label: 'Students', to: '/owner/students', icon: Users },
        { label: 'Finance', to: '/owner/finance', icon: IndianRupee },
        { label: 'Analytics', to: '/owner/analytics', icon: ChartColumn },
      ],
    },
    {
      label: 'Operations',
      items: [
        { label: 'Complaints', to: '/owner/complaints', icon: MessageSquareWarning },
        { label: 'Staff', to: '/owner/staff', icon: IdCard },
        { label: 'Inventory', to: '/owner/inventory', icon: Package, badge: (d) => propertyStats(d, 'all').lowStock },
        { label: 'Events', to: '/owner/events', icon: PartyPopper },
      ],
    },
    {
      label: 'Account',
      items: [
        { label: 'Plans', to: '/owner/plans', icon: Gem },
        { label: 'Settings', to: '/owner/settings', icon: Settings },
      ],
    },
  ],
  student: [
    {
      items: [
        { label: 'Home', to: '/student', icon: House, end: true },
        { label: 'Rent & Fees', to: '/student/rent', icon: Wallet },
        { label: 'Complaints', to: '/student/complaints', icon: MessageSquareWarning },
        { label: 'Leave & Outing', to: '/student/leave', icon: CalendarCheck },
        { label: 'Visitors', to: '/student/visitors', icon: UserCheck },
        { label: 'Notices & Events', to: '/student/notices', icon: Megaphone },
        { label: 'Documents', to: '/student/documents', icon: FileText },
        { label: 'Monthly Feedback', to: '/student/feedback', icon: Star },
        { label: 'Profile', to: '/student/profile', icon: User },
      ],
    },
    { items: [{ label: 'Emergency', to: '/student/emergency', icon: Siren, tone: 'danger' }] },
  ],
}

export const STUDENT_TABS = [
  { label: 'Home', to: '/student', icon: House, end: true },
  { label: 'Rent', to: '/student/rent', icon: Wallet },
  { label: 'Complaints', to: '/student/complaints', icon: MessageSquareWarning },
  { label: 'Leave', to: '/student/leave', icon: CalendarCheck },
]
