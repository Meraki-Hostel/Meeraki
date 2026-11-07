import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { DATA_VERSION, createSeedData } from '../data/seed'
import type {
  Activity, Announcement, AppData, BedStatus, Complaint, ComplaintCategory, ComplaintStatus, Expense,
  Feedback, FeedbackCategory, HostelEvent, InventoryLog, LeaveRequest, MaintenanceTask, PaymentMethod, PlanTier,
  Priority, Role, Session, Staff, Student, StudentDocument, Transaction, Visitor, VisitorStatus, Attendance, OrgSettings, InventoryItem,
} from '../lib/types'
import { DEMO_TODAY, cycleLabel, formatINR, nowIso, uid } from '../lib/utils'
import { CURRENT_CYCLE, locationOf } from './selectors'

const DATA_KEY = 'staypookie.prototype.data'
const SESSION_KEY = 'staypookie.prototype.session'
export const OWNER_NAME = 'Pawan Kushwah'

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string }

function loadData(): AppData {
  try {
    const raw = localStorage.getItem(DATA_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as AppData
      if (parsed.version === DATA_VERSION) return parsed
    }
  } catch {
    /* fall through to seed */
  }
  return createSeedData()
}

const DEFAULT_SESSION: Session = { role: 'manager', studentId: 's-rahul', managerPropertyId: 'p1', readNotifications: [] }

function loadSession(): Session {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (raw) return { ...DEFAULT_SESSION, ...(JSON.parse(raw) as Session) }
  } catch {
    /* ignore */
  }
  return DEFAULT_SESSION
}

export interface NewStudentInput {
  name: string
  phone: string
  email: string
  guardianName: string
  guardianPhone: string
  college: string
  course: string
  idNumber: string
  gender: 'M' | 'F'
  bedId: string
  monthlyRent: number
  deposit: number
  joinDate: string
  depositPaid: boolean
}

function useStoreValue() {
  const [data, setData] = useState<AppData>(loadData)
  const [session, setSession] = useState<Session>(loadSession)
  const ref = useRef(data)
  const sessionRef = useRef(session)
  sessionRef.current = session

  // Persist (debounced)
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        localStorage.setItem(DATA_KEY, JSON.stringify(data))
      } catch {
        /* storage full or blocked – prototype keeps working in memory */
      }
    }, 250)
    return () => clearTimeout(t)
  }, [data])
  useEffect(() => {
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(session))
    } catch {
      /* ignore */
    }
  }, [session])

  const mutate = useCallback(<T,>(fn: (d: AppData) => T): T => {
    const next = structuredClone(ref.current)
    const res = fn(next)
    ref.current = next
    setData(next)
    return res
  }, [])

  const actor = useCallback((d: AppData, pid?: string) => {
    const s = sessionRef.current
    if (s.role === 'student') return d.students.find((x) => x.id === s.studentId)?.name ?? 'Student'
    if (s.role === 'owner') return OWNER_NAME
    return d.properties.find((p) => p.id === (pid ?? s.managerPropertyId))?.managerName ?? 'Manager'
  }, [])

  const actions = useMemo(() => {
    const log = (d: AppData, a: Omit<Activity, 'id' | 'at' | 'actor'> & { actor?: string }) => {
      d.activity.unshift({ id: uid('a'), at: nowIso(), actor: a.actor ?? actor(d, a.propertyId), ...a })
    }
    const notify = (d: AppData, studentId: string | null, title: string, body: string, link: string) => {
      if (!studentId) return
      d.studentNotifications.unshift({ id: uid('sn'), studentId, title, body, link, at: nowIso(), read: false })
    }
    const roomNo = (d: AppData, roomId: string | null) => (roomId ? d.rooms.find((r) => r.id === roomId)?.number ?? '' : '')
    const bedLabel = (d: AppData, bedId: string) => {
      const bed = d.beds.find((b) => b.id === bedId)!
      return `${roomNo(d, bed.roomId)}-${bed.label}`
    }
    const ensureCurrentDue = (d: AppData, s: Student) => {
      if (!d.dues.some((x) => x.studentId === s.id)) {
        d.dues.push({ id: uid('d'), studentId: s.id, propertyId: s.propertyId, cycle: CURRENT_CYCLE, amount: s.monthlyRent, paid: 0, dueDate: `${CURRENT_CYCLE}-05` })
      }
    }
    const addTxn = (d: AppData, dueId: string, amount: number, method: PaymentMethod, reference?: string, recordedBy?: string): Transaction => {
      const due = d.dues.find((x) => x.id === dueId)!
      due.paid = Math.min(due.amount, due.paid + amount)
      const t: Transaction = {
        id: uid('t'), receiptNo: `REC-${d.counters.receipt++}`, dueId, studentId: due.studentId, propertyId: due.propertyId,
        amount, method, reference, date: nowIso(), recordedBy: recordedBy ?? actor(d, due.propertyId),
      }
      d.transactions.push(t)
      return t
    }

    return {
      // ---------------------------------------------------------------- students
      addStudent(input: NewStudentInput): Result<{ studentId: string; receiptTxnId?: string }> {
        return mutate((d) => {
          const bed = d.beds.find((b) => b.id === input.bedId)
          if (!bed) return { ok: false, error: 'Please select a bed.' }
          if (bed.status === 'occupied') return { ok: false, error: 'Bed is already occupied.' }
          const id = uid('s')
          const s: Student = {
            id, propertyId: bed.propertyId, name: input.name.trim(), gender: input.gender, phone: input.phone.replace(/\D/g, ''),
            email: input.email.trim(), guardianName: input.guardianName.trim(), guardianPhone: input.guardianPhone.replace(/\D/g, ''),
            college: input.college.trim(), course: input.course.trim(), idNumber: input.idNumber.trim() || '—', bedId: bed.id,
            status: 'active', joinDate: input.joinDate, monthlyRent: input.monthlyRent, deposit: input.deposit,
            bloodGroup: '—', hometown: '—',
          }
          d.students.push(s)
          bed.status = 'occupied'
          bed.studentId = id
          d.dues.push({ id: uid('d'), studentId: id, propertyId: s.propertyId, cycle: CURRENT_CYCLE, amount: s.monthlyRent, paid: 0, dueDate: `${CURRENT_CYCLE}-05` })
          let receiptTxnId: string | undefined
          if (input.depositPaid && input.deposit > 0) {
            const depDue = { id: uid('d'), studentId: id, propertyId: s.propertyId, cycle: 'deposit', amount: input.deposit, paid: 0, dueDate: input.joinDate }
            d.dues.push(depDue)
            receiptTxnId = addTxn(d, depDue.id, input.deposit, 'UPI', undefined).id
          }
          const label = bedLabel(d, bed.id)
          log(d, { propertyId: s.propertyId, kind: 'student', message: `New student added: ${s.name}`, studentId: id })
          log(d, { propertyId: s.propertyId, kind: 'room', message: `${s.name} assigned to Room ${label}`, studentId: id, roomId: bed.roomId })
          return { ok: true, studentId: id, receiptTxnId }
        })
      },
      updateStudent(id: string, patch: Partial<Student>) {
        mutate((d) => {
          const s = d.students.find((x) => x.id === id)!
          Object.assign(s, patch)
          log(d, { propertyId: s.propertyId, kind: 'student', message: `Profile updated for ${s.name}`, studentId: id })
        })
      },
      assignBed(studentId: string, bedId: string): Result {
        return mutate((d) => {
          const s = d.students.find((x) => x.id === studentId)!
          const bed = d.beds.find((b) => b.id === bedId)
          if (!bed) return { ok: false, error: 'Please select a bed.' }
          if (bed.status === 'occupied') return { ok: false, error: 'Bed is already occupied.' }
          if (s.bedId) {
            const old = d.beds.find((b) => b.id === s.bedId)
            if (old) {
              old.status = 'vacant'
              old.studentId = null
            }
          }
          bed.status = 'occupied'
          bed.studentId = s.id
          s.bedId = bed.id
          s.status = 'active'
          ensureCurrentDue(d, s)
          const label = bedLabel(d, bed.id)
          log(d, { propertyId: s.propertyId, kind: 'room', message: `${s.name} assigned to Room ${label}`, studentId: s.id, roomId: bed.roomId })
          notify(d, s.id, 'Bed allocated', `You have been allocated Room ${label}.`, '/student/profile')
          return { ok: true }
        })
      },
      transferStudent(studentId: string, bedId: string): Result<{ from: string; to: string }> {
        return mutate((d) => {
          const s = d.students.find((x) => x.id === studentId)!
          const bed = d.beds.find((b) => b.id === bedId)
          if (!bed) return { ok: false, error: 'Please select a bed.' }
          if (bed.status === 'occupied') return { ok: false, error: 'Bed is already occupied.' }
          const old = d.beds.find((b) => b.id === s.bedId)
          const from = old ? bedLabel(d, old.id) : '—'
          if (old) {
            old.status = 'vacant'
            old.studentId = null
          }
          bed.status = 'occupied'
          bed.studentId = s.id
          s.bedId = bed.id
          const to = bedLabel(d, bed.id)
          log(d, { propertyId: s.propertyId, kind: 'room', message: `${s.name} transferred from ${from} to ${to}`, studentId: s.id, roomId: bed.roomId })
          if (old) log(d, { propertyId: s.propertyId, kind: 'room', message: `Bed ${from} vacated (transfer of ${s.name})`, roomId: old.roomId })
          notify(d, s.id, 'Room transferred', `Your bed has changed from ${from} to ${to}.`, '/student/profile')
          return { ok: true, from, to }
        })
      },
      checkoutStudent(studentId: string) {
        return mutate((d) => {
          const s = d.students.find((x) => x.id === studentId)!
          const bed = d.beds.find((b) => b.id === s.bedId)
          const label = bed ? bedLabel(d, bed.id) : ''
          if (bed) {
            bed.status = 'vacant'
            bed.studentId = null
          }
          s.bedId = null
          s.status = 'checked-out'
          s.checkoutDate = DEMO_TODAY
          // Drop unpaid future invoices
          d.dues = d.dues.filter((x) => !(x.studentId === s.id && x.paid === 0 && x.dueDate > DEMO_TODAY))
          log(d, { propertyId: s.propertyId, kind: 'student', message: `${s.name} checked out${label ? ` — Bed ${label} is now vacant` : ''}`, studentId: s.id, roomId: bed?.roomId })
          return label
        })
      },
      setBedStatus(bedId: string, status: Exclude<BedStatus, 'occupied'>) {
        mutate((d) => {
          const bed = d.beds.find((b) => b.id === bedId)!
          if (bed.status === 'occupied') return
          bed.status = status
          log(d, { propertyId: bed.propertyId, kind: 'room', message: `Bed ${bedLabel(d, bedId)} marked ${status === 'vacant' ? 'available' : status}`, roomId: bed.roomId })
        })
      },
      setRoomMaintenance(roomId: string, on: boolean) {
        return mutate((d) => {
          let n = 0
          for (const b of d.beds.filter((x) => x.roomId === roomId && x.status !== 'occupied')) {
            if (on && b.status !== 'maintenance') {
              b.status = 'maintenance'
              n++
            } else if (!on && b.status === 'maintenance') {
              b.status = 'vacant'
              n++
            }
          }
          const room = d.rooms.find((r) => r.id === roomId)!
          if (n) log(d, { propertyId: room.propertyId, kind: 'room', message: `Room ${room.number}: ${n} bed${n > 1 ? 's' : ''} ${on ? 'marked under maintenance' : 'back to available'}`, roomId })
          return n
        })
      },

      // ---------------------------------------------------------------- payments
      recordPayment(dueId: string, amount: number, method: PaymentMethod, reference?: string): Result<{ txnId: string }> {
        return mutate((d) => {
          const due = d.dues.find((x) => x.id === dueId)
          if (!due) return { ok: false, error: 'Invoice not found.' }
          const remaining = due.amount - due.paid
          if (amount <= 0) return { ok: false, error: 'Enter an amount greater than zero.' }
          if (amount > remaining) return { ok: false, error: `Amount exceeds the remaining ${formatINR(remaining)}.` }
          const online = method.startsWith('Online')
          const t = addTxn(d, dueId, amount, method, reference, online ? 'Student app' : undefined)
          const s = d.students.find((x) => x.id === due.studentId)!
          const what = due.cycle === 'deposit' ? 'security deposit' : cycleLabel(due.cycle)
          log(d, { propertyId: s.propertyId, kind: 'payment', message: `${s.name} paid ${formatINR(amount)} for ${what}${due.paid < due.amount ? ` (${formatINR(due.amount - due.paid)} remaining)` : ''}`, studentId: s.id, actor: online ? s.name : undefined })
          if (!online) notify(d, s.id, 'Payment received', `${formatINR(amount)} received for ${what}. Receipt ${t.receiptNo}.`, '/student/rent')
          return { ok: true, txnId: t.id }
        })
      },

      // ---------------------------------------------------------------- complaints
      createComplaint(input: { propertyId: string; studentId: string | null; roomId: string | null; category: ComplaintCategory; title: string; description: string; priority: Priority; hasImage: boolean }) {
        return mutate((d) => {
          const by = actor(d, input.propertyId)
          const c: Complaint = {
            id: uid('c'), number: d.counters.complaint++, ...input, status: 'open', assignedTo: null,
            createdAt: nowIso(), updatedAt: nowIso(), history: [{ at: nowIso(), status: 'created', note: 'Complaint submitted', by }],
          }
          d.complaints.unshift(c)
          const s = d.students.find((x) => x.id === input.studentId)
          log(d, { propertyId: input.propertyId, kind: 'complaint', message: `${s?.name ?? by} submitted a complaint: ${c.title}`, studentId: s?.id, roomId: c.roomId ?? undefined })
          return c
        })
      },
      assignComplaint(id: string, staffId: string) {
        mutate((d) => {
          const c = d.complaints.find((x) => x.id === id)!
          const st = d.staff.find((x) => x.id === staffId)!
          c.assignedTo = staffId
          c.updatedAt = nowIso()
          c.history.push({ at: nowIso(), status: 'assigned', note: `Assigned to ${st.name} (${st.role})`, by: actor(d, c.propertyId) })
          log(d, { propertyId: c.propertyId, kind: 'complaint', message: `Complaint #${c.number} assigned to ${st.name}`, roomId: c.roomId ?? undefined })
          notify(d, c.studentId, 'Complaint assigned', `${st.name} will look into “${c.title}”.`, '/student/complaints')
        })
      },
      setComplaintStatus(id: string, status: ComplaintStatus, note?: string) {
        mutate((d) => {
          const c = d.complaints.find((x) => x.id === id)!
          c.status = status
          c.updatedAt = nowIso()
          const text = note?.trim() || (status === 'in-progress' ? 'Work started' : status === 'resolved' ? 'Marked as resolved' : 'Reopened')
          c.history.push({ at: nowIso(), status, note: text, by: actor(d, c.propertyId) })
          const verb = status === 'in-progress' ? 'work started' : status === 'resolved' ? 'resolved' : 'reopened'
          log(d, { propertyId: c.propertyId, kind: 'complaint', message: `Complaint #${c.number} “${c.title}” ${verb}`, roomId: c.roomId ?? undefined })
          notify(d, c.studentId, status === 'resolved' ? 'Complaint resolved' : 'Complaint update', `“${c.title}” is now ${status === 'in-progress' ? 'In Progress' : status === 'resolved' ? 'Resolved' : 'Open'}.`, '/student/complaints')
          // Close linked maintenance tasks when the complaint is resolved
          if (status === 'resolved') {
            for (const m of d.maintenance.filter((x) => x.complaintId === id && x.status !== 'done')) {
              m.status = 'done'
              m.completedAt = nowIso()
              if (m.cost > 0) d.expenses.push({ id: uid('ex'), propertyId: m.propertyId, category: 'Maintenance', amount: m.cost, date: DEMO_TODAY, description: m.title })
            }
          }
        })
      },

      // ---------------------------------------------------------------- leave
      createLeave(input: Omit<LeaveRequest, 'id' | 'status' | 'createdAt'>) {
        mutate((d) => {
          d.leaves.unshift({ ...input, id: uid('lv'), status: 'pending', createdAt: nowIso() })
          const s = d.students.find((x) => x.id === input.studentId)!
          log(d, { propertyId: s.propertyId, kind: 'leave', message: `${s.name} requested ${input.type === 'Outing' ? 'an outing' : 'leave'} (${input.reason})`, studentId: s.id })
        })
      },
      decideLeave(id: string, approve: boolean, note?: string) {
        mutate((d) => {
          const l = d.leaves.find((x) => x.id === id)!
          l.status = approve ? 'approved' : 'rejected'
          l.decidedAt = nowIso()
          l.decisionNote = note?.trim() || undefined
          const s = d.students.find((x) => x.id === l.studentId)!
          log(d, { propertyId: l.propertyId, kind: 'leave', message: `${l.type} request of ${s.name} ${approve ? 'approved' : 'rejected'}`, studentId: s.id })
          notify(d, s.id, approve ? 'Leave approved' : 'Leave rejected', approve ? `Your ${l.type.toLowerCase()} request has been approved.` : `Your ${l.type.toLowerCase()} request was rejected${l.decisionNote ? `: ${l.decisionNote}` : '.'}`, '/student/leave')
        })
      },
      cancelLeave(id: string) {
        mutate((d) => {
          d.leaves = d.leaves.filter((x) => x.id !== id)
        })
      },

      // ---------------------------------------------------------------- visitors
      addVisitor(input: Omit<Visitor, 'id' | 'createdAt' | 'status'>, status: VisitorStatus = 'pending') {
        mutate((d) => {
          d.visitors.unshift({ ...input, id: uid('v'), status, createdAt: nowIso(), checkInAt: status === 'checked-in' ? nowIso() : undefined })
          const s = d.students.find((x) => x.id === input.studentId)!
          log(d, { propertyId: s.propertyId, kind: 'visitor', message: status === 'checked-in' ? `Walk-in visitor ${input.name} checked in for ${s.name}` : `${s.name} registered visitor ${input.name} (${input.relation})`, studentId: s.id })
        })
      },
      setVisitorStatus(id: string, status: VisitorStatus) {
        mutate((d) => {
          const v = d.visitors.find((x) => x.id === id)!
          v.status = status
          if (status === 'checked-in') v.checkInAt = nowIso()
          if (status === 'checked-out') v.checkOutAt = nowIso()
          const s = d.students.find((x) => x.id === v.studentId)!
          const verb = { pending: 'pending', approved: 'approved', rejected: 'rejected', 'checked-in': 'checked in', 'checked-out': 'checked out' }[status]
          log(d, { propertyId: v.propertyId, kind: 'visitor', message: `Visitor ${v.name} (for ${s.name}) ${verb}`, studentId: s.id })
          if (status === 'approved' || status === 'rejected') notify(d, s.id, `Visitor ${verb}`, `${v.name}’s visit has been ${verb}.`, '/student/visitors')
          if (status === 'checked-in') notify(d, s.id, 'Your visitor has arrived', `${v.name} is at the reception.`, '/student/visitors')
        })
      },

      // ---------------------------------------------------------------- staff
      setAttendance(staffId: string, attendance: Attendance) {
        mutate((d) => {
          const st = d.staff.find((x) => x.id === staffId)!
          st.attendance = attendance
        })
      },
      addStaff(input: Omit<Staff, 'id'>) {
        mutate((d) => {
          d.staff.push({ ...input, id: uid('st') })
          log(d, { propertyId: input.propertyId, kind: 'staff', message: `${input.name} added as ${input.role}` })
        })
      },
      addRequirement(propertyId: string, title: string, openings: number, note: string) {
        mutate((d) => {
          d.requirements.unshift({ id: uid('rq'), propertyId, title, openings, note, createdAt: nowIso() })
          log(d, { propertyId, kind: 'staff', message: `Staff requirement posted: ${title} (${openings})` })
        })
      },
      closeRequirement(id: string) {
        mutate((d) => {
          d.requirements = d.requirements.filter((x) => x.id !== id)
        })
      },

      // ---------------------------------------------------------------- maintenance
      addMaintenance(input: Omit<MaintenanceTask, 'id' | 'createdAt' | 'status'>) {
        mutate((d) => {
          d.maintenance.unshift({ ...input, id: uid('m'), status: 'open', createdAt: nowIso() })
          log(d, { propertyId: input.propertyId, kind: 'maintenance', message: `Maintenance task created: ${input.title}`, roomId: input.roomId ?? undefined })
          if (input.complaintId) {
            const c = d.complaints.find((x) => x.id === input.complaintId)
            if (c && input.assignedTo && !c.assignedTo) c.assignedTo = input.assignedTo
          }
        })
      },
      updateMaintenance(id: string, patch: Partial<MaintenanceTask>) {
        mutate((d) => {
          const m = d.maintenance.find((x) => x.id === id)!
          const wasDone = m.status === 'done'
          Object.assign(m, patch)
          if (patch.status === 'in-progress' && !wasDone) {
            log(d, { propertyId: m.propertyId, kind: 'maintenance', message: `Work started: ${m.title}`, roomId: m.roomId ?? undefined })
            const c = d.complaints.find((x) => x.id === m.complaintId)
            if (c && c.status === 'open') {
              c.status = 'in-progress'
              c.updatedAt = nowIso()
              c.history.push({ at: nowIso(), status: 'in-progress', note: `Maintenance started: ${m.title}`, by: actor(d, m.propertyId) })
              notify(d, c.studentId, 'Complaint update', `“${c.title}” is now In Progress.`, '/student/complaints')
            }
          }
          if (patch.status === 'done' && !wasDone) {
            m.completedAt = nowIso()
            if (m.cost > 0) d.expenses.push({ id: uid('ex'), propertyId: m.propertyId, category: 'Maintenance', amount: m.cost, date: DEMO_TODAY, description: m.title })
            log(d, { propertyId: m.propertyId, kind: 'maintenance', message: `${m.title} completed (${formatINR(m.cost)})`, roomId: m.roomId ?? undefined })
            const c = d.complaints.find((x) => x.id === m.complaintId)
            if (c && c.status !== 'resolved') {
              c.status = 'resolved'
              c.updatedAt = nowIso()
              c.history.push({ at: nowIso(), status: 'resolved', note: `Resolved via maintenance: ${m.title}`, by: actor(d, m.propertyId) })
              log(d, { propertyId: c.propertyId, kind: 'complaint', message: `Complaint #${c.number} “${c.title}” resolved`, roomId: c.roomId ?? undefined })
              notify(d, c.studentId, 'Complaint resolved', `“${c.title}” has been resolved.`, '/student/complaints')
            }
          }
        })
      },

      // ---------------------------------------------------------------- inventory
      adjustStock(itemId: string, delta: number, kind: InventoryLog['kind'], note: string, cost?: number) {
        mutate((d) => {
          const it = d.inventory.find((x) => x.id === itemId)!
          it.stock = Math.max(0, it.stock + delta)
          it.log.unshift({ id: uid('l'), delta, kind, note, date: nowIso() })
          if (kind === 'purchased' && cost && cost > 0) {
            d.expenses.push({ id: uid('ex'), propertyId: it.propertyId, category: 'Supplies', amount: cost, date: DEMO_TODAY, description: `Purchase: ${delta} × ${it.name}` })
          }
          const verb = kind === 'purchased' ? `+${delta} added` : kind === 'issued' ? `${-delta} issued` : kind === 'damaged' ? `${-delta} marked damaged` : `adjusted by ${delta}`
          log(d, { propertyId: it.propertyId, kind: 'inventory', message: `${it.name}: ${verb}${note ? ` — ${note}` : ''} (now ${it.stock})` })
        })
      },
      saveItem(item: Omit<InventoryItem, 'log' | 'id'> & { id?: string }) {
        mutate((d) => {
          if (item.id) {
            const it = d.inventory.find((x) => x.id === item.id)!
            Object.assign(it, item)
            log(d, { propertyId: it.propertyId, kind: 'inventory', message: `Inventory item updated: ${it.name}` })
          } else {
            d.inventory.push({ ...item, id: uid('inv'), log: [{ id: uid('l'), delta: item.stock, kind: 'adjusted', note: 'Opening stock', date: nowIso() }] })
            log(d, { propertyId: item.propertyId, kind: 'inventory', message: `New inventory item: ${item.name} (${item.stock})` })
          }
        })
      },

      // ---------------------------------------------------------------- announcements & events
      publishAnnouncement(input: Omit<Announcement, 'id' | 'createdAt' | 'author'>) {
        mutate((d) => {
          const a: Announcement = { ...input, id: uid('an'), createdAt: nowIso(), author: actor(d, input.propertyId) }
          if (a.pinned) d.announcements.forEach((x) => x.propertyId === a.propertyId && (x.pinned = false))
          d.announcements.unshift(a)
          log(d, { propertyId: a.propertyId, kind: 'announcement', message: `Announcement published: ${a.title}` })
        })
      },
      deleteAnnouncement(id: string) {
        mutate((d) => {
          const a = d.announcements.find((x) => x.id === id)
          d.announcements = d.announcements.filter((x) => x.id !== id)
          if (a) log(d, { propertyId: a.propertyId, kind: 'announcement', message: `Announcement deleted: ${a.title}` })
        })
      },
      saveEvent(ev: Omit<HostelEvent, 'id' | 'rsvps'> & { id?: string }) {
        mutate((d) => {
          if (ev.id) {
            const e = d.events.find((x) => x.id === ev.id)!
            Object.assign(e, ev)
            log(d, { propertyId: e.propertyId, kind: 'event', message: `Event updated: ${e.name}` })
          } else {
            d.events.push({ ...ev, id: uid('e'), rsvps: [] })
            log(d, { propertyId: ev.propertyId, kind: 'event', message: `Event created: ${ev.name}` })
          }
        })
      },
      toggleRsvp(eventId: string, studentId: string) {
        mutate((d) => {
          const e = d.events.find((x) => x.id === eventId)!
          if (e.rsvps.includes(studentId)) {
            e.rsvps = e.rsvps.filter((x) => x !== studentId)
            e.participants--
          } else {
            e.rsvps.push(studentId)
            e.participants++
          }
        })
      },

      // ---------------------------------------------------------------- feedback
      submitFeedback(studentId: string, month: string, ratings: Record<FeedbackCategory, number>, comment: string) {
        mutate((d) => {
          const s = d.students.find((x) => x.id === studentId)!
          d.feedback = d.feedback.filter((f) => !(f.studentId === studentId && f.month === month))
          const f: Feedback = { id: uid('fb'), studentId, propertyId: s.propertyId, month, ratings, comment, createdAt: nowIso() }
          d.feedback.push(f)
          log(d, { propertyId: s.propertyId, kind: 'feedback', message: `${s.name} submitted monthly feedback`, studentId })
        })
      },

      // ---------------------------------------------------------------- finance / owner
      addExpense(input: Omit<Expense, 'id'>) {
        mutate((d) => {
          d.expenses.push({ ...input, id: uid('ex') })
          log(d, { propertyId: input.propertyId, kind: 'expense', message: `Expense added: ${input.category} ${formatINR(input.amount)}${input.description ? ` — ${input.description}` : ''}` })
        })
      },
      setPlan(propertyId: string, plan: PlanTier) {
        mutate((d) => {
          d.properties.find((p) => p.id === propertyId)!.plan = plan
        })
      },
      updateSettings(patch: Partial<OrgSettings>) {
        mutate((d) => {
          Object.assign(d.settings, patch)
        })
      },

      // ---------------------------------------------------------------- emergency, docs, notifications
      sendEmergency(studentId: string, note: string) {
        mutate((d) => {
          const s = d.students.find((x) => x.id === studentId)!
          d.alerts.unshift({ id: uid('al'), studentId, propertyId: s.propertyId, at: nowIso(), note, status: 'active' })
          const loc = locationOf(d, s)
          log(d, { propertyId: s.propertyId, kind: 'emergency', message: `EMERGENCY alert from ${s.name}${loc ? ` (Room ${loc.label})` : ''}${note ? `: ${note}` : ''}`, studentId })
        })
      },
      acknowledgeEmergency(id: string) {
        mutate((d) => {
          const a = d.alerts.find((x) => x.id === id)!
          a.status = 'acknowledged'
          a.acknowledgedAt = nowIso()
          const s = d.students.find((x) => x.id === a.studentId)!
          log(d, { propertyId: a.propertyId, kind: 'emergency', message: `Emergency alert from ${s.name} acknowledged`, studentId: s.id })
          notify(d, s.id, 'Help is on the way', `${actor(d, a.propertyId)} acknowledged your emergency alert.`, '/student/emergency')
        })
      },
      uploadDocument(studentId: string, name: string, kind: StudentDocument['kind'], size: string) {
        mutate((d) => {
          d.documents.push({ id: uid('doc'), studentId, name, kind, size, uploadedAt: nowIso() })
          const s = d.students.find((x) => x.id === studentId)!
          log(d, { propertyId: s.propertyId, kind: 'student', message: `Document uploaded for ${s.name}: ${name}`, studentId })
        })
      },
      markStudentNotificationsRead(studentId: string) {
        mutate((d) => {
          d.studentNotifications.forEach((n) => n.studentId === studentId && (n.read = true))
        })
      },
      resetDemo() {
        const fresh = createSeedData()
        ref.current = fresh
        setData(fresh)
        setSession(DEFAULT_SESSION)
      },
    }
  }, [mutate, actor])

  const sessionActions = useMemo(
    () => ({
      setRole: (role: Role) => setSession((s) => ({ ...s, role })),
      setStudentPersona: (studentId: string) => setSession((s) => ({ ...s, studentId })),
      setManagerProperty: (managerPropertyId: string) => setSession((s) => ({ ...s, managerPropertyId })),
      markNotificationsRead: (keys: string[]) => setSession((s) => ({ ...s, readNotifications: Array.from(new Set([...s.readNotifications, ...keys])) })),
    }),
    [],
  )

  return { data, session, ...actions, ...sessionActions }
}

type Store = ReturnType<typeof useStoreValue>
const Ctx = createContext<Store | null>(null)

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const value = useStoreValue()
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useStore() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useStore outside provider')
  return v
}

/** Current student persona (student role) */
export function useCurrentStudent() {
  const { data, session } = useStore()
  return data.students.find((s) => s.id === session.studentId) ?? data.students[0]!
}

export function useManagerProperty() {
  const { data, session } = useStore()
  return data.properties.find((p) => p.id === session.managerPropertyId) ?? data.properties[0]!
}

