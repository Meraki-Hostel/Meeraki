import { AlertTriangle, BedDouble, Bell, CalendarCheck, Megaphone, MessageSquareWarning, Package, TrendingDown, UserCheck, Wallet, type LucideIcon } from 'lucide-react'
import type { AppData, Role, Session } from '../../lib/types'
import { compactINR, formatINR } from '../../lib/utils'
import { locationOf, propertyStats } from '../../store/selectors'

export interface NotificationItem {
  key: string
  title: string
  body?: string
  link: string
  at?: string
  icon: LucideIcon
  tone: string
  read: boolean
}

const T = {
  red: 'bg-rose-50 text-rose-600',
  amber: 'bg-amber-50 text-amber-600',
  brand: 'bg-brand-50 text-brand-600',
  green: 'bg-emerald-50 text-emerald-600',
  slate: 'bg-slate-100 text-slate-600',
}

export function buildNotifications(d: AppData, s: Session, role: Role): NotificationItem[] {
  const read = new Set(s.readNotifications)
  const out: Omit<NotificationItem, 'read'>[] = []

  if (role === 'student') {
    const st = d.students.find((x) => x.id === s.studentId)
    if (!st) return []
    const loc = locationOf(d, st)
    const items = d.studentNotifications
      .filter((n) => n.studentId === st.id)
      .map((n) => ({ key: n.id, title: n.title, body: n.body, link: n.link, at: n.at, icon: Bell, tone: T.brand, _read: n.read }))
    const recentAnn = d.announcements
      .filter((a) => a.propertyId === st.propertyId && a.createdAt.slice(0, 10) >= '2026-09-23')
      .filter((a) => a.audience === 'all' || (a.audience === 'floor' && loc && String(loc.room.floor) === a.audienceValue) || (a.audience === 'room' && loc?.room.id === a.audienceValue))
      .map((a) => ({ key: `ann:${a.id}`, title: 'New announcement', body: a.title, link: '/student/notices', at: a.createdAt, icon: Megaphone, tone: T.slate, _read: false }))
    return [...items, ...recentAnn]
      .filter((n) => !(n.key.startsWith('ann:') && items.some((m) => m.body.startsWith(n.body))))
      .sort((a, b) => (b.at ?? '').localeCompare(a.at ?? ''))
      .map(({ _read, ...n }) => ({ ...n, read: _read || read.has(n.key) }))
  }

  if (role === 'manager') {
    const pid = s.managerPropertyId
    const st = propertyStats(d, pid)
    for (const a of d.alerts.filter((x) => x.propertyId === pid && x.status === 'active')) {
      const who = d.students.find((x) => x.id === a.studentId)
      out.push({ key: `alert:${a.id}`, title: `Emergency alert — ${who?.name}`, body: `Room ${locationOf(d, who)?.label ?? '—'}${a.note ? ` · ${a.note}` : ''}`, link: '/manager', at: a.at, icon: AlertTriangle, tone: T.red })
    }
    if (st.newComplaints) out.push({ key: `complaints:${st.newComplaints}`, title: `${st.newComplaints} new complaints`, body: 'Waiting to be assigned or started', link: '/manager/complaints?status=open', icon: MessageSquareWarning, tone: T.amber })
    if (st.pendingLeaves) out.push({ key: `leave:${st.pendingLeaves}`, title: `${st.pendingLeaves} pending leave requests`, body: 'Approve or reject from Leave Requests', link: '/manager/leave', icon: CalendarCheck, tone: T.brand })
    if (st.overdueCount) out.push({ key: `overdue:${st.overdueCount}`, title: `${st.overdueCount} overdue payments`, body: `${formatINR(st.outstanding)} outstanding past due date`, link: '/manager/payments?tab=overdue', icon: Wallet, tone: T.red })
    if (st.pendingVisitors) out.push({ key: `visitors:${st.pendingVisitors}`, title: `${st.pendingVisitors} visitor requests`, body: 'Need approval', link: '/manager/visitors?tab=pending', icon: UserCheck, tone: T.brand })
    if (st.lowStock) out.push({ key: `stock:${st.lowStock}`, title: `${st.lowStock} inventory items low in stock`, body: 'Reorder before they run out', link: '/manager/inventory?filter=low', icon: Package, tone: T.amber })
    if (st.awaitingBed) out.push({ key: `bed:${st.awaitingBed}`, title: `${st.awaitingBed} students awaiting bed allocation`, link: '/manager/students?status=unassigned', icon: BedDouble, tone: T.slate })
  }

  if (role === 'owner') {
    for (const a of d.alerts.filter((x) => x.status === 'active')) {
      const who = d.students.find((x) => x.id === a.studentId)
      const p = d.properties.find((x) => x.id === a.propertyId)
      out.push({ key: `alert:${a.id}`, title: `Emergency at ${p?.name}`, body: `${who?.name} raised an alert`, link: `/owner/properties/${a.propertyId}`, at: a.at, icon: AlertTriangle, tone: T.red })
    }
    const all = propertyStats(d, 'all')
    if (all.outstanding) out.push({ key: `o-out:${all.overdueCount}`, title: `${compactINR(all.outstanding)} outstanding across properties`, body: `${all.overdueCount} overdue invoices`, link: '/owner/finance', icon: Wallet, tone: T.red })
    for (const p of d.properties) {
      const ps = propertyStats(d, p.id)
      if (ps.occupancy < 0.84) out.push({ key: `o-occ:${p.id}:${ps.occupied}`, title: `${p.name} occupancy at ${Math.round(ps.occupancy * 100)}%`, body: `${ps.available} beds available`, link: `/owner/properties/${p.id}`, icon: TrendingDown, tone: T.amber })
    }
    if (all.lowStock) out.push({ key: `o-stock:${all.lowStock}`, title: `${all.lowStock} inventory items low in stock`, body: 'Across all properties', link: '/owner/inventory', icon: Package, tone: T.amber })
    const highOpen = d.complaints.filter((c) => c.status !== 'resolved' && c.priority === 'high').length
    if (highOpen) out.push({ key: `o-high:${highOpen}`, title: `${highOpen} high-priority complaints open`, link: '/owner/complaints', icon: MessageSquareWarning, tone: T.amber })
  }

  return out.map((n) => ({ ...n, read: read.has(n.key) }))
}
