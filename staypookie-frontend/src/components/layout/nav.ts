import type { LucideIcon } from 'lucide-react';
import {
  Activity, BarChart3, BedDouble, Boxes, Building2, CalendarDays, ClipboardList, CreditCard, DoorOpen, FileText, Gauge,
  Home, IndianRupee, Landmark, LifeBuoy, Megaphone, MessageSquareWarning, Settings, Siren, Sparkles, Star, UserRound, Users, Wrench,
} from 'lucide-react';
import type { Role } from '@/types/domain';

export type BadgeKey = 'complaints' | 'leave' | 'visitors' | 'notices' | 'maintenance' | 'lowStock';
export interface NavItem { label: string; to: string; icon: LucideIcon; badge?: BadgeKey }
export interface NavGroup { heading?: string; items: NavItem[] }

/** Single typed source for each role's navigation. */
export const NAV: Record<Role, NavGroup[]> = {
  owner: [
    { items: [
      { label: 'Dashboard', to: '/owner/dashboard', icon: Gauge },
      { label: 'Properties', to: '/owner/properties', icon: Building2 },
      { label: 'Analytics', to: '/owner/analytics', icon: BarChart3 },
      { label: 'Finance', to: '/owner/finance', icon: IndianRupee },
    ] },
    { heading: 'Operations', items: [
      { label: 'Staff', to: '/owner/staff', icon: Users },
      { label: 'Complaints', to: '/owner/complaints', icon: MessageSquareWarning, badge: 'complaints' },
      { label: 'Events', to: '/owner/events', icon: CalendarDays },
      { label: 'Inventory', to: '/owner/inventory', icon: Boxes, badge: 'lowStock' },
    ] },
    { heading: 'Account', items: [
      { label: 'Payouts', to: '/owner/payouts', icon: Landmark },
      { label: 'Plans', to: '/owner/plans', icon: Sparkles },
      { label: 'Settings', to: '/owner/settings', icon: Settings },
    ] },
  ],
  manager: [
    { items: [
      { label: 'Dashboard', to: '/manager/dashboard', icon: Gauge },
      { label: 'Rooms & beds', to: '/manager/rooms', icon: BedDouble },
      { label: 'Students', to: '/manager/students', icon: Users },
      { label: 'Payments', to: '/manager/payments', icon: CreditCard },
    ] },
    { heading: 'Requests', items: [
      { label: 'Complaints', to: '/manager/complaints', icon: MessageSquareWarning, badge: 'complaints' },
      { label: 'Leave', to: '/manager/leave', icon: DoorOpen, badge: 'leave' },
      { label: 'Visitors', to: '/manager/visitors', icon: UserRound, badge: 'visitors' },
    ] },
    { heading: 'Operations', items: [
      { label: 'Maintenance', to: '/manager/maintenance', icon: Wrench, badge: 'maintenance' },
      { label: 'Inventory', to: '/manager/inventory', icon: Boxes, badge: 'lowStock' },
      { label: 'Staff', to: '/manager/staff', icon: ClipboardList },
    ] },
    { heading: 'Community', items: [
      { label: 'Announcements', to: '/manager/announcements', icon: Megaphone },
      { label: 'Events', to: '/manager/events', icon: CalendarDays },
      { label: 'Feedback', to: '/manager/feedback', icon: Star },
      { label: 'Activity', to: '/manager/activity', icon: Activity },
    ] },
  ],
  student: [
    { items: [
      { label: 'Home', to: '/student/home', icon: Home },
      { label: 'Rent & receipts', to: '/student/rent', icon: IndianRupee },
      { label: 'Notices', to: '/student/notices', icon: Megaphone, badge: 'notices' },
    ] },
    { heading: 'Requests', items: [
      { label: 'Complaints', to: '/student/complaints', icon: MessageSquareWarning },
      { label: 'Leave', to: '/student/leave', icon: DoorOpen },
      { label: 'Visitors', to: '/student/visitors', icon: UserRound },
    ] },
    { heading: 'My stay', items: [
      { label: 'Profile', to: '/student/profile', icon: UserRound },
      { label: 'Documents', to: '/student/documents', icon: FileText },
      { label: 'Feedback', to: '/student/feedback', icon: Star },
      { label: 'Emergency', to: '/student/emergency', icon: Siren },
    ] },
  ],
};

export const HELP_ITEM: NavItem = { label: 'Help & support', to: '/help', icon: LifeBuoy };
