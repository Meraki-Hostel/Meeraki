import type { IComplaintService, ILeaveService, IVisitorService } from '../interfaces';
import type { Complaint, LeaveRequest, VisitorRequest } from '@/types/domain';
import { ServiceError, forbidden, invalid, notFound } from '../errors';
import { assertPropertyAccess, bumpCounter, clone, ctx, db, delay, logActivity, mutate, newId, notifyStaff, notifyStudent, requireRole, scopeProperty, staffName, studentName, type Ctx } from './base';
import { complaintView, leaveView, visitorView } from './views';
import { isIndianPhone, normalizePhone } from '@/lib/validation';
import { addDays, nowISO, todayISO } from '@/lib/clock';
import { formatDate, sentenceCase } from '@/lib/format';

const scopeFilter = (c: Ctx) => (x: { propertyId: string; studentId: string }) =>
  c.role === 'student' ? x.studentId === c.studentId : c.role === 'owner' || x.propertyId === c.propertyId;

function ownRecord<T extends { propertyId: string; studentId: string }>(c: Ctx, rec: T | undefined, what: string): T {
  if (!rec) throw notFound(what);
  if (c.role === 'student' && rec.studentId !== c.studentId) throw forbidden();
  if (c.role !== 'student') assertPropertyAccess(c, rec.propertyId);
  return rec;
}

/* ---------------- Complaints ---------------- */
export const mockComplaintService: IComplaintService = {
  async list(filters = {}) {
    await delay();
    const c = ctx();
    const s = db();
    const pid = c.role === 'owner' ? scopeProperty(c, filters.propertyId) : undefined;
    return s.complaints
      .filter(scopeFilter(c))
      .filter((x) => !pid || x.propertyId === pid)
      .filter((x) => !filters.status || x.status === filters.status)
      .filter((x) => !filters.priority || x.priority === filters.priority)
      .filter((x) => !filters.category || x.category === filters.category)
      .map((x) => complaintView(s, x, c.role !== 'student'))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  },
  async get(id) {
    await delay(80);
    const c = ctx();
    const s = db();
    return complaintView(s, ownRecord(c, s.complaints.find((x) => x.id === id), 'Complaint'), c.role !== 'student');
  },
  async create(input) {
    await delay(320);
    const c = ctx();
    requireRole(c, 'student');
    const e: Record<string, string> = {};
    if (input.title.trim().length < 5) e.title = 'Title must be at least 5 characters';
    if (input.title.trim().length > 80) e.title = 'Keep the title under 80 characters';
    if (input.description.trim().length < 15) e.description = 'Describe the issue in at least 15 characters';
    if (Object.keys(e).length) throw invalid(e);
    const st = db().students.find((x) => x.id === c.studentId)!;
    const id = newId('cmp');
    mutate((s) => {
      const n = bumpCounter(s, 'complaint', 1040);
      const at = nowISO();
      const cmp: Complaint = {
        id, ticketNo: `CMP-${String(n).padStart(4, '0')}`, propertyId: st.propertyId, studentId: st.id, roomId: st.roomId,
        category: input.category, title: input.title.trim(), description: input.description.trim(), priority: input.priority, status: 'open',
        attachments: input.attachments, comments: [], history: [{ id: newId('ch'), status: 'open', changedBy: st.name, at }], createdAt: at, updatedAt: at,
      };
      s.complaints.push(cmp);
      logActivity(s, c, 'complaint', `Raised complaint ${cmp.ticketNo}: ${cmp.title}`, st.propertyId, '/manager/complaints');
      notifyStaff(s, st.propertyId, `New ${input.priority} complaint`, `${st.name}: ${cmp.title}`, 'complaint', '/manager/complaints', input.priority === 'urgent' ? '/owner/complaints' : undefined);
    });
    return clone(db().complaints.find((x) => x.id === id)!);
  },
  async update(id, patch) {
    await delay(240);
    const c = ctx();
    requireRole(c, 'owner', 'manager');
    const cmp = ownRecord(c, db().complaints.find((x) => x.id === id), 'Complaint');
    if (patch.assigneeStaffId) {
      const staff = db().staff.find((x) => x.id === patch.assigneeStaffId);
      if (!staff || staff.propertyId !== cmp.propertyId) throw invalid({ assigneeStaffId: 'Assignee must be staff at this property' });
    }
    mutate((s) => {
      const x = s.complaints.find((y) => y.id === id)!;
      const at = nowISO();
      const changes: string[] = [];
      if (patch.priority && patch.priority !== x.priority) { changes.push(`priority → ${patch.priority}`); x.priority = patch.priority; }
      if (patch.assigneeStaffId !== undefined && (patch.assigneeStaffId ?? undefined) !== x.assigneeStaffId) {
        x.assigneeStaffId = patch.assigneeStaffId ?? undefined;
        changes.push(`assigned to ${staffName(s, x.assigneeStaffId) ?? 'nobody'}`);
      }
      if (patch.status && patch.status !== x.status) {
        x.status = patch.status;
        x.history.push({ id: newId('ch'), status: patch.status, changedBy: c.user.name, note: patch.note?.trim() || undefined, at });
        changes.push(`status → ${sentenceCase(patch.status)}`);
        notifyStudent(s, x.studentId, 'Complaint update', `“${x.title}” is now ${sentenceCase(patch.status).toLowerCase()}.`, 'complaint', '/student/complaints');
      } else if (patch.note?.trim()) {
        x.comments.push({ id: newId('cc'), authorName: c.user.name, authorRole: c.role, body: patch.note.trim(), internal: false, createdAt: at });
        notifyStudent(s, x.studentId, 'New reply on your complaint', patch.note.trim().slice(0, 90), 'complaint', '/student/complaints');
      }
      x.updatedAt = at;
      if (changes.length) logActivity(s, c, 'complaint', `${x.ticketNo}: ${changes.join(', ')}`, x.propertyId, '/manager/complaints');
    });
    return clone(db().complaints.find((x) => x.id === id)!);
  },
  async addComment(id, body, internal) {
    await delay(200);
    const c = ctx();
    const cmp = ownRecord(c, db().complaints.find((x) => x.id === id), 'Complaint');
    if (body.trim().length < 2) throw invalid({ body: 'Write a comment first' });
    if (c.role === 'student' && internal) throw forbidden('Students cannot add internal notes.');
    if (c.role === 'student' && cmp.status === 'closed') throw new ServiceError('CONFLICT', 'This complaint is closed. Raise a new one if the issue is back.');
    mutate((s) => {
      const x = s.complaints.find((y) => y.id === id)!;
      x.comments.push({ id: newId('cc'), authorName: c.user.name, authorRole: c.role, body: body.trim(), internal, createdAt: nowISO() });
      x.updatedAt = nowISO();
      if (c.role === 'student') notifyStaff(s, x.propertyId, `Reply on ${x.ticketNo}`, `${c.user.name}: ${body.trim().slice(0, 80)}`, 'complaint', '/manager/complaints');
      else if (!internal) notifyStudent(s, x.studentId, 'New reply on your complaint', body.trim().slice(0, 90), 'complaint', '/student/complaints');
    });
    return clone(db().complaints.find((x) => x.id === id)!);
  },
};

/* ---------------- Leave ---------------- */
export const mockLeaveService: ILeaveService = {
  async list(filters = {}) {
    await delay();
    const c = ctx();
    requireRole(c, 'manager', 'student', 'owner');
    const s = db();
    return s.leaves.filter(scopeFilter(c)).filter((x) => !filters.status || x.status === filters.status)
      .map((x) => leaveView(s, x)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
  async create(input) {
    await delay(300);
    const c = ctx();
    requireRole(c, 'student');
    const e: Record<string, string> = {};
    if (!input.from) e.from = 'Choose a departure date';
    else if (input.from < todayISO()) e.from = 'Departure cannot be in the past';
    if (!input.to) e.to = 'Choose a return date';
    else if (input.from && input.to < input.from) e.to = 'Return must be on or after departure';
    else if (input.from && input.to > addDays(input.from, 30)) e.to = 'Leave longer than 30 days needs office approval';
    if (input.destination.trim().length < 2) e.destination = 'Destination is required';
    if (!isIndianPhone(input.contactPhone)) e.contactPhone = 'Enter a 10-digit Indian mobile number';
    if (input.reason.trim().length < 5) e.reason = 'Add a short reason (min 5 characters)';
    const overlap = db().leaves.some((l) => l.studentId === c.studentId && (l.status === 'pending' || l.status === 'approved') && !(input.to < l.from || input.from > l.to));
    if (!e.from && !e.to && overlap) e.from = 'You already have a leave request for these dates';
    if (Object.keys(e).length) throw invalid(e);
    const st = db().students.find((x) => x.id === c.studentId)!;
    const id = newId('lv');
    mutate((s) => {
      const l: LeaveRequest = { id, studentId: st.id, propertyId: st.propertyId, from: input.from, to: input.to, destination: input.destination.trim(), contactPhone: normalizePhone(input.contactPhone), reason: input.reason.trim(), status: 'pending', createdAt: nowISO() };
      s.leaves.push(l);
      logActivity(s, c, 'leave', `${st.name} requested leave ${formatDate(l.from)} – ${formatDate(l.to)}`, st.propertyId, '/manager/leave');
      notifyStaff(s, st.propertyId, 'New leave request', `${st.name} · ${formatDate(l.from)} to ${formatDate(l.to)}`, 'leave', '/manager/leave');
    });
    return clone(db().leaves.find((x) => x.id === id)!);
  },
  async decide(id, decision, reason) {
    await delay(260);
    const c = ctx();
    requireRole(c, 'manager', 'owner');
    const l = ownRecord(c, db().leaves.find((x) => x.id === id), 'Leave request');
    if (l.status !== 'pending') throw new ServiceError('CONFLICT', 'Only pending requests can be decided.');
    if (decision === 'rejected' && !reason?.trim()) throw invalid({ reason: 'Give a reason so the student knows what to change' });
    mutate((s) => {
      const x = s.leaves.find((y) => y.id === id)!;
      x.status = decision; x.decisionReason = reason?.trim() || undefined; x.decidedBy = c.user.name; x.decidedAt = nowISO();
      const name = studentName(s, x.studentId);
      logActivity(s, c, 'leave', `${decision === 'approved' ? 'Approved' : 'Rejected'} leave for ${name}`, x.propertyId, '/manager/leave');
      notifyStudent(s, x.studentId, `Leave ${decision}`, `${formatDate(x.from)} – ${formatDate(x.to)}${x.decisionReason ? `: ${x.decisionReason}` : ''}`, 'leave', '/student/leave');
    });
    return clone(db().leaves.find((x) => x.id === id)!);
  },
  async cancel(id) {
    await delay(200);
    const c = ctx();
    requireRole(c, 'student');
    const l = ownRecord(c, db().leaves.find((x) => x.id === id), 'Leave request');
    if (l.status !== 'pending') throw new ServiceError('CONFLICT', 'Only pending requests can be cancelled.');
    mutate((s) => {
      const x = s.leaves.find((y) => y.id === id)!;
      x.status = 'cancelled';
      logActivity(s, c, 'leave', `${c.user.name} cancelled a leave request`, x.propertyId, '/manager/leave');
    });
    return clone(db().leaves.find((x) => x.id === id)!);
  },
};

/* ---------------- Visitors ---------------- */
function validateVisitor(input: { visitorName: string; visitorPhone: string; relation: string; visitDate: string; visitTime: string }, allowPast = false) {
  const e: Record<string, string> = {};
  if (input.visitorName.trim().length < 3) e.visitorName = 'Enter the visitor’s full name';
  if (!isIndianPhone(input.visitorPhone)) e.visitorPhone = 'Enter a 10-digit Indian mobile number';
  if (!input.relation.trim()) e.relation = 'Relation is required';
  if (!input.visitDate) e.visitDate = 'Choose a visit date';
  else if (!allowPast && input.visitDate < todayISO()) e.visitDate = 'Visit date cannot be in the past';
  else if (input.visitDate > addDays(todayISO(), 30)) e.visitDate = 'Requests can be made up to 30 days ahead';
  if (!input.visitTime) e.visitTime = 'Choose a time';
  else if (input.visitTime < '08:00' || input.visitTime > '19:00') e.visitTime = 'Visiting hours are 8:00 am to 7:00 pm';
  if (Object.keys(e).length) throw invalid(e);
}

function updateVisitor(id: string, c: Ctx, fn: (v: VisitorRequest) => void, msg: (v: VisitorRequest) => string, studentNote?: (v: VisitorRequest) => [string, string]) {
  mutate((s) => {
    const v = s.visitors.find((y) => y.id === id)!;
    fn(v);
    logActivity(s, c, 'visitor', msg(v), v.propertyId, '/manager/visitors');
    if (studentNote) { const [t, b] = studentNote(v); notifyStudent(s, v.studentId, t, b, 'visitor', '/student/visitors'); }
  });
  return clone(db().visitors.find((x) => x.id === id)!);
}

export const mockVisitorService: IVisitorService = {
  async list(filters = {}) {
    await delay();
    const c = ctx();
    const s = db();
    return s.visitors.filter(scopeFilter(c)).filter((x) => !filters.status || x.status === filters.status)
      .filter((x) => !filters.date || x.visitDate === filters.date)
      .map((x) => visitorView(s, x)).sort((a, b) => b.visitDate.localeCompare(a.visitDate) || b.visitTime.localeCompare(a.visitTime));
  },
  async create(input) {
    await delay(300);
    const c = ctx();
    requireRole(c, 'student');
    validateVisitor(input);
    const st = db().students.find((x) => x.id === c.studentId)!;
    const id = newId('vis');
    mutate((s) => {
      s.visitors.push({ id, studentId: st.id, propertyId: st.propertyId, source: 'request', visitorName: input.visitorName.trim(), visitorPhone: normalizePhone(input.visitorPhone), relation: input.relation.trim(), visitDate: input.visitDate, visitTime: input.visitTime, purpose: input.purpose.trim() || 'Visit', status: 'pending', createdAt: nowISO() });
      logActivity(s, c, 'visitor', `${st.name} requested a visit from ${input.visitorName.trim()}`, st.propertyId, '/manager/visitors');
      notifyStaff(s, st.propertyId, 'Visitor request', `${input.visitorName.trim()} for ${st.name} on ${formatDate(input.visitDate)}`, 'visitor', '/manager/visitors');
    });
    return clone(db().visitors.find((x) => x.id === id)!);
  },
  async createWalkIn(input) {
    await delay(260);
    const c = ctx();
    requireRole(c, 'manager');
    validateVisitor({ ...input, visitDate: todayISO() }, true);
    const st = db().students.find((x) => x.id === input.studentId);
    if (!st || st.propertyId !== c.propertyId) throw invalid({ studentId: 'Choose a resident of this property' });
    const id = newId('vis');
    mutate((s) => {
      s.visitors.push({ id, studentId: st.id, propertyId: st.propertyId, source: 'walk_in', visitorName: input.visitorName.trim(), visitorPhone: normalizePhone(input.visitorPhone), relation: input.relation.trim(), visitDate: todayISO(), visitTime: input.visitTime, purpose: input.purpose.trim() || 'Walk-in visit', status: 'checked_in', checkInAt: nowISO(), createdAt: nowISO() });
      logActivity(s, c, 'visitor', `Checked in walk-in visitor ${input.visitorName.trim()} for ${st.name}`, st.propertyId, '/manager/visitors');
      notifyStudent(s, st.id, 'Visitor at reception', `${input.visitorName.trim()} has checked in to see you.`, 'visitor', '/student/visitors');
    });
    return clone(db().visitors.find((x) => x.id === id)!);
  },
  async decide(id, decision, reason) {
    await delay(240);
    const c = ctx();
    requireRole(c, 'manager');
    const v = ownRecord(c, db().visitors.find((x) => x.id === id), 'Visitor request');
    if (v.status !== 'pending') throw new ServiceError('CONFLICT', 'Only pending requests can be decided.');
    if (decision === 'rejected' && !reason?.trim()) throw invalid({ reason: 'Give a reason for rejecting' });
    return updateVisitor(id, c, (x) => { x.status = decision; x.decisionReason = reason?.trim() || undefined; },
      (x) => `${decision === 'approved' ? 'Approved' : 'Rejected'} visit of ${x.visitorName}`,
      (x) => [`Visitor ${decision}`, `${x.visitorName} on ${formatDate(x.visitDate)}${x.decisionReason ? `: ${x.decisionReason}` : ''}`]);
  },
  async checkIn(id) {
    await delay(200);
    const c = ctx();
    requireRole(c, 'manager');
    const v = ownRecord(c, db().visitors.find((x) => x.id === id), 'Visitor request');
    if (v.status !== 'approved') throw new ServiceError('CONFLICT', 'Only approved visitors can be checked in.');
    return updateVisitor(id, c, (x) => { x.status = 'checked_in'; x.checkInAt = nowISO(); }, (x) => `Checked in ${x.visitorName}`,
      (x) => ['Visitor checked in', `${x.visitorName} is at reception.`]);
  },
  async checkOut(id) {
    await delay(200);
    const c = ctx();
    requireRole(c, 'manager');
    const v = ownRecord(c, db().visitors.find((x) => x.id === id), 'Visitor request');
    if (v.status !== 'checked_in') throw new ServiceError('CONFLICT', 'Visitor is not checked in.');
    return updateVisitor(id, c, (x) => { x.status = 'checked_out'; x.checkOutAt = nowISO(); }, (x) => `Checked out ${x.visitorName}`);
  },
  async cancel(id) {
    await delay(200);
    const c = ctx();
    requireRole(c, 'student');
    const v = ownRecord(c, db().visitors.find((x) => x.id === id), 'Visitor request');
    if (v.status !== 'pending' && v.status !== 'approved') throw new ServiceError('CONFLICT', 'This visit can no longer be cancelled.');
    return updateVisitor(id, c, (x) => { x.status = 'cancelled'; }, (x) => `${c.user.name} cancelled visit of ${x.visitorName}`);
  },
};
