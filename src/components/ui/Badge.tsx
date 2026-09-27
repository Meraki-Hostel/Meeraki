import type { ReactNode } from 'react'
import { cn } from '../../lib/utils'

export type Tone = 'neutral' | 'brand' | 'green' | 'amber' | 'red' | 'blue' | 'violet' | 'slate'

const TONES: Record<Tone, string> = {
  neutral: 'bg-slate-100 text-slate-700 ring-slate-200',
  slate: 'bg-slate-50 text-slate-500 ring-slate-200',
  brand: 'bg-brand-50 text-brand-700 ring-brand-200',
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  amber: 'bg-amber-50 text-amber-800 ring-amber-200',
  red: 'bg-rose-50 text-rose-700 ring-rose-200',
  blue: 'bg-sky-50 text-sky-700 ring-sky-200',
  violet: 'bg-violet-50 text-violet-700 ring-violet-200',
}
const DOTS: Record<Tone, string> = {
  neutral: 'bg-slate-400', slate: 'bg-slate-300', brand: 'bg-brand-500', green: 'bg-emerald-500', amber: 'bg-amber-500', red: 'bg-rose-500', blue: 'bg-sky-500', violet: 'bg-violet-500',
}

export function Badge({ tone = 'neutral', dot, children, className }: { tone?: Tone; dot?: boolean; children: ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset', TONES[tone], className)}>
      {dot && <span className={cn('size-1.5 rounded-full', DOTS[tone])} />}
      {children}
    </span>
  )
}

const STATUS: Record<string, [Tone, string]> = {
  // payments
  paid: ['green', 'Paid'], pending: ['blue', 'Pending'], partial: ['amber', 'Partial'], overdue: ['red', 'Overdue'],
  // complaints
  open: ['red', 'Open'], 'in-progress': ['amber', 'In Progress'], resolved: ['green', 'Resolved'],
  // leave
  approved: ['green', 'Approved'], rejected: ['neutral', 'Rejected'], away: ['violet', 'Away now'],
  // visitors
  'checked-in': ['brand', 'Checked in'], 'checked-out': ['slate', 'Checked out'],
  // beds
  occupied: ['brand', 'Occupied'], vacant: ['green', 'Available'], reserved: ['amber', 'Reserved'], maintenance: ['neutral', 'Maintenance'],
  // students
  active: ['green', 'Active'], 'checked-out-student': ['slate', 'Checked out'], unassigned: ['amber', 'Awaiting bed'], 'on-leave': ['violet', 'On leave'],
  // maintenance
  done: ['green', 'Done'],
  // inventory
  'stock-ok': ['green', 'In stock'], 'stock-low': ['amber', 'Low stock'], 'stock-out': ['red', 'Out of stock'],
  // events
  Planning: ['blue', 'Planning'], Confirmed: ['brand', 'Confirmed'], Completed: ['slate', 'Completed'], Cancelled: ['neutral', 'Cancelled'],
  // attendance
  present: ['green', 'Present'], absent: ['red', 'Absent'], leave: ['amber', 'On leave'],
  // priority
  high: ['red', 'High'], medium: ['amber', 'Medium'], low: ['slate', 'Low'],
}

export function StatusBadge({ status, label, className }: { status: string; label?: string; className?: string }) {
  const [tone, text] = STATUS[status] ?? ['neutral', status]
  return (
    <Badge tone={tone} dot className={className}>
      {label ?? text}
    </Badge>
  )
}

export function PriorityBadge({ priority }: { priority: 'low' | 'medium' | 'high' }) {
  const [tone, text] = STATUS[priority]!
  return <Badge tone={tone}>{text} priority</Badge>
}
