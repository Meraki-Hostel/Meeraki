import type { AppData, Bed, Due, PaymentStatus, Room, Student, Transaction } from '../lib/types'
import { DEMO_TODAY, sum } from '../lib/utils'

export const CURRENT_CYCLE = '2026-10' // upcoming rent cycle (due 5 Oct)
export const THIS_MONTH = '2026-09' // month whose collections count as "this month"

interface Index {
  bed: Map<string, Bed>
  room: Map<string, Room>
  student: Map<string, Student>
  bedsByRoom: Map<string, Bed[]>
  duesByStudent: Map<string, Due[]>
  txnsByStudent: Map<string, Transaction[]>
  txnsByDue: Map<string, Transaction[]>
}

const cache = new WeakMap<AppData, Index>()

/** Lookup tables, rebuilt once per state snapshot. */
export function idx(d: AppData): Index {
  let i = cache.get(d)
  if (i) return i
  i = {
    bed: new Map(d.beds.map((b) => [b.id, b])),
    room: new Map(d.rooms.map((r) => [r.id, r])),
    student: new Map(d.students.map((s) => [s.id, s])),
    bedsByRoom: new Map(),
    duesByStudent: new Map(),
    txnsByStudent: new Map(),
    txnsByDue: new Map(),
  }
  for (const b of d.beds) push(i.bedsByRoom, b.roomId, b)
  for (const x of d.dues) push(i.duesByStudent, x.studentId, x)
  for (const t of d.transactions) {
    push(i.txnsByStudent, t.studentId, t)
    push(i.txnsByDue, t.dueId, t)
  }
  for (const list of i.duesByStudent.values()) list.sort((a, b) => b.cycle.localeCompare(a.cycle))
  for (const list of i.txnsByStudent.values()) list.sort((a, b) => b.date.localeCompare(a.date))
  cache.set(d, i)
  return i
}

function push<K, V>(m: Map<K, V[]>, k: K, v: V) {
  const l = m.get(k)
  if (l) l.push(v)
  else m.set(k, [v])
}

export function dueStatus(due: Due): PaymentStatus {
  if (due.paid >= due.amount) return 'paid'
  if (due.paid > 0) return 'partial'
  if (due.dueDate < DEMO_TODAY) return 'overdue'
  return 'pending'
}

export function isPastDue(due: Due) {
  return due.dueDate < DEMO_TODAY && due.paid < due.amount
}

export function studentPaymentStatus(d: AppData, studentId: string): PaymentStatus {
  const dues = idx(d).duesByStudent.get(studentId) ?? []
  if (!dues.length) return 'pending'
  const statuses = dues.map(dueStatus)
  if (statuses.includes('overdue')) return 'overdue'
  if (statuses.includes('partial')) return 'partial'
  if (statuses.includes('pending')) return 'pending'
  return 'paid'
}

export function studentOutstanding(d: AppData, studentId: string) {
  return sum(idx(d).duesByStudent.get(studentId) ?? [], (x) => x.amount - x.paid)
}

export interface Location {
  bed: Bed
  room: Room
  label: string // "204-B"
}

export function locationOf(d: AppData, s: Student | undefined | null): Location | null {
  if (!s?.bedId) return null
  const i = idx(d)
  const bed = i.bed.get(s.bedId)
  if (!bed) return null
  const room = i.room.get(bed.roomId)!
  return { bed, room, label: `${room.number}-${bed.label}` }
}

export function roomLabel(d: AppData, roomId: string | null | undefined) {
  if (!roomId) return '—'
  return idx(d).room.get(roomId)?.number ?? '—'
}

export function isAway(d: AppData, studentId: string) {
  return d.leaves.some((l) => l.studentId === studentId && l.status === 'approved' && l.from.slice(0, 10) <= DEMO_TODAY && l.to.slice(0, 10) >= DEMO_TODAY)
}

export interface PropertyStats {
  totalBeds: number
  occupied: number
  vacant: number
  reserved: number
  maintenance: number
  available: number
  occupancy: number
  activeStudents: number
  awaitingBed: number
  outstanding: number
  overdueCount: number
  partialCount: number
  expectedCurrent: number
  collectedCurrent: number
  collectedThisMonth: number
  expensesThisMonth: number
  maintenanceCostThisMonth: number
  openComplaints: number
  newComplaints: number
  pendingLeaves: number
  away: number
  pendingVisitors: number
  todayVisitors: number
  lowStock: number
  staffPresent: number
  staffTotal: number
  activeAlerts: number
  satisfaction: number
}

const statsCache = new WeakMap<AppData, Map<string, PropertyStats>>()

export function propertyStats(d: AppData, pid: string | 'all'): PropertyStats {
  let m = statsCache.get(d)
  if (!m) statsCache.set(d, (m = new Map()))
  const hit = m.get(pid)
  if (hit) return hit
  const inP = <T extends { propertyId: string }>(x: T) => pid === 'all' || x.propertyId === pid
  const beds = d.beds.filter(inP)
  const occupied = beds.filter((b) => b.status === 'occupied').length
  const reserved = beds.filter((b) => b.status === 'reserved').length
  const maintenance = beds.filter((b) => b.status === 'maintenance').length
  const dues = d.dues.filter(inP)
  const pastDue = dues.filter(isPastDue)
  const current = dues.filter((x) => x.cycle === CURRENT_CYCLE)
  const txnsMonth = d.transactions.filter((t) => inP(t) && t.date.slice(0, 7) === THIS_MONTH)
  const exp = d.expenses.filter((e) => inP(e) && e.date.slice(0, 7) === THIS_MONTH)
  const students = d.students.filter((s) => inP(s) && s.status === 'active')
  const staff = d.staff.filter(inP)
  const fb = d.feedback.filter((f) => inP(f) && f.month === THIS_MONTH)
  const s: PropertyStats = {
    totalBeds: beds.length,
    occupied,
    reserved,
    maintenance,
    vacant: beds.length - occupied,
    available: beds.length - occupied - reserved - maintenance,
    occupancy: beds.length ? occupied / beds.length : 0,
    activeStudents: students.filter((x) => x.bedId).length,
    awaitingBed: students.filter((x) => !x.bedId).length,
    outstanding: sum(pastDue, (x) => x.amount - x.paid),
    overdueCount: pastDue.filter((x) => x.paid === 0).length,
    partialCount: dues.filter((x) => dueStatus(x) === 'partial').length,
    expectedCurrent: sum(current, (x) => x.amount),
    collectedCurrent: sum(current, (x) => x.paid),
    collectedThisMonth: sum(txnsMonth, (t) => t.amount),
    expensesThisMonth: sum(exp, (e) => e.amount),
    maintenanceCostThisMonth: sum(exp.filter((e) => e.category === 'Maintenance'), (e) => e.amount),
    openComplaints: d.complaints.filter((c) => inP(c) && c.status !== 'resolved').length,
    newComplaints: d.complaints.filter((c) => inP(c) && c.status === 'open').length,
    pendingLeaves: d.leaves.filter((l) => inP(l) && l.status === 'pending').length,
    away: d.leaves.filter((l) => inP(l) && l.status === 'approved' && l.from.slice(0, 10) <= DEMO_TODAY && l.to.slice(0, 10) >= DEMO_TODAY).length,
    pendingVisitors: d.visitors.filter((v) => inP(v) && v.status === 'pending').length,
    todayVisitors: d.visitors.filter((v) => inP(v) && v.expectedAt.slice(0, 10) === DEMO_TODAY && v.status !== 'rejected').length,
    lowStock: d.inventory.filter((it) => inP(it) && it.stock < it.min).length,
    staffPresent: staff.filter((x) => x.attendance === 'present').length,
    staffTotal: staff.length,
    activeAlerts: d.alerts.filter((a) => inP(a) && a.status === 'active').length,
    satisfaction: fb.length ? sum(fb, (f) => avgRating(f.ratings)) / fb.length : 0,
  }
  m.set(pid, s)
  return s
}

export function avgRating(r: Record<string, number>) {
  const v = Object.values(r)
  return v.reduce((a, b) => a + b, 0) / v.length
}

export function inventoryStatus(stock: number, min: number): 'out' | 'low' | 'ok' {
  if (stock <= 0) return 'out'
  if (stock < min) return 'low'
  return 'ok'
}

export function propertyName(d: AppData, pid: string) {
  return d.properties.find((p) => p.id === pid)?.name ?? '—'
}

export function dueLabel(cycle: string, long = false) {
  if (cycle === 'deposit') return 'Security deposit'
  const [y, m] = cycle.split('-').map(Number)
  const names = long
    ? ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
    : ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${names[m! - 1]} ${y} rent`
}
