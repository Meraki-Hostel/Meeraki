import type { AnnouncementInput, EventInput, IActivityService, IAnnouncementService, IDocumentService, IEventService, IFeedbackService, INotificationService } from '../interfaces';
import type { Announcement, DemoState, StudentProfile } from '@/types/domain';
import { ServiceError, forbidden, invalid, notFound } from '../errors';
import { assertPropertyAccess, clone, ctx, db, delay, logActivity, mutate, newId, notifyStaff, notifyStudent, propertyName, requireRole, scopeProperty, studentName } from './base';
import { nowISO, todayISO } from '@/lib/clock';
import { formatDate } from '@/lib/format';

/* ---------------- Announcements ---------------- */
function targetsStudent(s: DemoState, a: Announcement, st: StudentProfile): boolean {
  if (a.propertyId !== st.propertyId) return false;
  if (a.audience.type === 'all') return true;
  const room = s.rooms.find((r) => r.id === st.roomId);
  if (!room) return false;
  if (a.audience.type === 'floors') return a.audience.values.includes(String(room.floor));
  return a.audience.values.map((v) => v.toLowerCase()).includes(room.number.toLowerCase());
}
function validateAnnouncement(input: AnnouncementInput) {
  const e: Record<string, string> = {};
  if (input.title.trim().length < 5) e.title = 'Title must be at least 5 characters';
  if (input.body.trim().length < 10) e.body = 'Message must be at least 10 characters';
  if (input.audience.type !== 'all' && input.audience.values.filter(Boolean).length === 0) e.audience = input.audience.type === 'floors' ? 'Pick at least one floor' : 'Enter at least one room number';
  if (Object.keys(e).length) throw invalid(e);
}
function announceToStudents(s: DemoState, a: Announcement) {
  s.students.filter((st) => targetsStudent(s, a, st)).forEach((st) => notifyStudent(s, st.id, `New notice: ${a.title}`, a.body.slice(0, 90), 'notice', '/student/notices'));
}

export const mockAnnouncementService: IAnnouncementService = {
  async list(filters = {}) {
    await delay();
    const c = ctx();
    const s = db();
    if (c.role === 'student') {
      const st = s.students.find((x) => x.id === c.studentId)!;
      return s.announcements.filter((a) => a.status === 'published' && targetsStudent(s, a, st))
        .map((a) => ({ ...clone(a), readBy: [], propertyName: propertyName(s, a.propertyId), isRead: a.readBy.includes(st.id) }))
        .sort((a, b) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''));
    }
    const pid = scopeProperty(c);
    return s.announcements.filter((a) => (!pid || a.propertyId === pid) && (!filters.status || a.status === filters.status))
      .map((a) => ({ ...clone(a), propertyName: propertyName(s, a.propertyId) }))
      .sort((a, b) => (b.publishedAt ?? b.createdAt).localeCompare(a.publishedAt ?? a.createdAt));
  },
  async create(input, publish) {
    await delay(280);
    const c = ctx();
    requireRole(c, 'manager');
    validateAnnouncement(input);
    const id = newId('ann');
    mutate((s) => {
      const a: Announcement = { id, propertyId: c.propertyId!, title: input.title.trim(), body: input.body.trim(), category: input.category, audience: { type: input.audience.type, values: input.audience.values.map((v) => v.trim()).filter(Boolean) }, status: publish ? 'published' : 'draft', author: c.user.name, createdAt: nowISO(), publishedAt: publish ? nowISO() : undefined, readBy: [] };
      s.announcements.push(a);
      logActivity(s, c, 'announcement', `${publish ? 'Published' : 'Saved draft'} “${a.title}”`, a.propertyId, '/manager/announcements');
      if (publish) announceToStudents(s, a);
    });
    return clone(db().announcements.find((a) => a.id === id)!);
  },
  async update(id, input) {
    await delay(240);
    const c = ctx();
    requireRole(c, 'manager');
    const a = db().announcements.find((x) => x.id === id);
    if (!a) throw notFound('Notice');
    assertPropertyAccess(c, a.propertyId);
    if (a.status === 'archived') throw new ServiceError('CONFLICT', 'Archived notices cannot be edited.');
    validateAnnouncement(input);
    mutate((s) => {
      const x = s.announcements.find((y) => y.id === id)!;
      Object.assign(x, { title: input.title.trim(), body: input.body.trim(), category: input.category, audience: input.audience });
      logActivity(s, c, 'announcement', `Edited “${x.title}”`, x.propertyId, '/manager/announcements');
    });
    return clone(db().announcements.find((x) => x.id === id)!);
  },
  async publish(id) {
    await delay(220);
    const c = ctx();
    requireRole(c, 'manager');
    const a = db().announcements.find((x) => x.id === id);
    if (!a) throw notFound('Notice');
    assertPropertyAccess(c, a.propertyId);
    if (a.status === 'published') throw new ServiceError('CONFLICT', 'Already published.');
    mutate((s) => {
      const x = s.announcements.find((y) => y.id === id)!;
      x.status = 'published';
      x.publishedAt = nowISO();
      logActivity(s, c, 'announcement', `Published “${x.title}”`, x.propertyId, '/manager/announcements');
      announceToStudents(s, x);
    });
    return clone(db().announcements.find((x) => x.id === id)!);
  },
  async archive(id) {
    await delay(200);
    const c = ctx();
    requireRole(c, 'manager');
    const a = db().announcements.find((x) => x.id === id);
    if (!a) throw notFound('Notice');
    assertPropertyAccess(c, a.propertyId);
    mutate((s) => {
      const x = s.announcements.find((y) => y.id === id)!;
      x.status = 'archived';
      logActivity(s, c, 'announcement', `Archived “${x.title}”`, x.propertyId, '/manager/announcements');
    });
    return clone(db().announcements.find((x) => x.id === id)!);
  },
  async markRead(id, read) {
    await delay(60);
    const c = ctx();
    requireRole(c, 'student');
    mutate((s) => {
      const a = s.announcements.find((x) => x.id === id);
      if (!a) return;
      a.readBy = a.readBy.filter((x) => x !== c.studentId);
      if (read) a.readBy.push(c.studentId!);
    });
  },
  async markAllRead() {
    await delay(100);
    const c = ctx();
    requireRole(c, 'student');
    mutate((s) => {
      const st = s.students.find((x) => x.id === c.studentId)!;
      s.announcements.forEach((a) => { if (a.status === 'published' && targetsStudent(s, a, st) && !a.readBy.includes(st.id)) a.readBy.push(st.id); });
    });
  },
};

/* ---------------- Events ---------------- */
function validateEvent(input: Partial<EventInput>) {
  const e: Record<string, string> = {};
  if (input.title !== undefined && input.title.trim().length < 4) e.title = 'Title must be at least 4 characters';
  if (input.date !== undefined && !input.date) e.date = 'Choose a date';
  if (input.startTime !== undefined && !input.startTime) e.startTime = 'Start time is required';
  if (input.endTime !== undefined && input.startTime && input.endTime <= input.startTime) e.endTime = 'End time must be after start time';
  if (input.location !== undefined && !input.location.trim()) e.location = 'Location is required';
  if (input.capacity !== undefined && !(Number.isInteger(input.capacity) && input.capacity > 0)) e.capacity = 'Capacity must be a whole number above 0';
  if (input.expectedAttendance !== undefined && input.capacity !== undefined && input.expectedAttendance > input.capacity) e.expectedAttendance = 'Expected attendance cannot exceed capacity';
  if (input.expectedAttendance !== undefined && input.expectedAttendance < 0) e.expectedAttendance = 'Cannot be negative';
  if (Object.keys(e).length) throw invalid(e);
}

export const mockEventService: IEventService = {
  async list(filters = {}) {
    await delay();
    const c = ctx();
    const s = db();
    const pid = c.role === 'owner' ? filters.propertyId : c.propertyId;
    return s.events.filter((e) => (!pid || e.propertyId === pid) && (!filters.status || e.status === filters.status))
      .map((e) => ({ ...clone(e), propertyName: propertyName(s, e.propertyId) }))
      .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
  },
  async create(input) {
    await delay(280);
    const c = ctx();
    requireRole(c, 'owner', 'manager');
    const propertyId = scopeProperty(c, input.propertyId);
    if (!propertyId) throw invalid({ propertyId: 'Choose a property' });
    validateEvent(input);
    if (input.date < todayISO()) throw invalid({ date: 'Event date cannot be in the past' });
    const id = newId('evt');
    mutate((s) => {
      s.events.push({ id, propertyId, title: input.title.trim(), description: input.description.trim(), category: input.category, date: input.date, startTime: input.startTime, endTime: input.endTime, location: input.location.trim(), capacity: input.capacity, expectedAttendance: input.expectedAttendance, status: 'scheduled', createdBy: c.user.name });
      logActivity(s, c, 'event', `Scheduled “${input.title.trim()}” on ${formatDate(input.date)}`, propertyId, c.role === 'owner' ? '/owner/events' : '/manager/events');
      s.students.filter((st) => st.propertyId === propertyId && st.status === 'active').forEach((st) => notifyStudent(s, st.id, `New event: ${input.title.trim()}`, `${formatDate(input.date)} at ${input.location.trim()}`, 'event', '/student/home'));
      if (c.role === 'manager') s.users.filter((u) => u.role === 'owner').forEach((u) => s.notifications.unshift({ id: newId('ntf'), recipientUserId: u.id, title: 'Event scheduled', body: `${input.title.trim()} at ${propertyName(s, propertyId)}`, category: 'event', link: '/owner/events', read: false, createdAt: nowISO() }));
    });
    return clone(db().events.find((e) => e.id === id)!);
  },
  async update(id, input) {
    await delay(240);
    const c = ctx();
    requireRole(c, 'owner', 'manager');
    const ev = db().events.find((e) => e.id === id);
    if (!ev) throw notFound('Event');
    assertPropertyAccess(c, ev.propertyId);
    validateEvent({ ...ev, ...input });
    mutate((s) => {
      const x = s.events.find((e) => e.id === id)!;
      Object.assign(x, input, { propertyId: c.role === 'owner' && input.propertyId ? input.propertyId : x.propertyId });
      logActivity(s, c, 'event', `Updated event “${x.title}”`, x.propertyId, c.role === 'owner' ? '/owner/events' : '/manager/events');
    });
    return clone(db().events.find((e) => e.id === id)!);
  },
  async setStatus(id, status) {
    await delay(200);
    const c = ctx();
    requireRole(c, 'owner', 'manager');
    const ev = db().events.find((e) => e.id === id);
    if (!ev) throw notFound('Event');
    assertPropertyAccess(c, ev.propertyId);
    mutate((s) => {
      const x = s.events.find((e) => e.id === id)!;
      x.status = status;
      logActivity(s, c, 'event', `${status === 'cancelled' ? 'Cancelled' : status === 'completed' ? 'Completed' : 'Rescheduled'} “${x.title}”`, x.propertyId, '/manager/events');
      if (status === 'cancelled') s.students.filter((st) => st.propertyId === x.propertyId && st.status === 'active').forEach((st) => notifyStudent(s, st.id, `Event cancelled: ${x.title}`, `Planned for ${formatDate(x.date)}.`, 'event', '/student/home'));
    });
    return clone(db().events.find((e) => e.id === id)!);
  },
};

/* ---------------- Feedback ---------------- */
export const mockFeedbackService: IFeedbackService = {
  async list(filters = {}) {
    await delay();
    const c = ctx();
    requireRole(c, 'owner', 'manager');
    const pid = scopeProperty(c);
    const s = db();
    return s.feedback.filter((f) => (!pid || f.propertyId === pid) && (!filters.category || f.category === filters.category))
      .map((f) => ({ ...clone(f), studentName: f.anonymous ? 'Anonymous resident' : studentName(s, f.studentId), propertyName: propertyName(s, f.propertyId), studentId: f.anonymous ? '' : f.studentId }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
  async mine() {
    await delay();
    const c = ctx();
    requireRole(c, 'student');
    const s = db();
    return s.feedback.filter((f) => f.studentId === c.studentId).map((f) => ({ ...clone(f), studentName: c.user.name, propertyName: propertyName(s, f.propertyId) })).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
  async submit(input) {
    await delay(260);
    const c = ctx();
    requireRole(c, 'student');
    const e: Record<string, string> = {};
    if (!(input.rating >= 1 && input.rating <= 5)) e.rating = 'Choose a rating from 1 to 5';
    if (input.comment.trim().length < 5) e.comment = 'Add a short comment (min 5 characters)';
    if (Object.keys(e).length) throw invalid(e);
    const st = db().students.find((x) => x.id === c.studentId)!;
    const id = newId('fb');
    mutate((s) => {
      s.feedback.push({ id, propertyId: st.propertyId, studentId: st.id, category: input.category, rating: input.rating, comment: input.comment.trim(), anonymous: input.anonymous, createdAt: nowISO() });
      logActivity(s, input.anonymous ? null : c, 'feedback', `New ${input.rating}★ feedback on ${input.category}`, st.propertyId, '/manager/feedback');
    });
    return clone(db().feedback.find((f) => f.id === id)!);
  },
  async summary() {
    await delay(80);
    const c = ctx();
    requireRole(c, 'owner', 'manager');
    const pid = scopeProperty(c);
    const list = db().feedback.filter((f) => !pid || f.propertyId === pid);
    const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : 0);
    const cats = Array.from(new Set(list.map((f) => f.category)));
    return {
      average: avg(list.map((f) => f.rating)), total: list.length,
      byCategory: cats.map((category) => { const r = list.filter((f) => f.category === category).map((f) => f.rating); return { category, average: avg(r), count: r.length }; }).sort((a, b) => a.average - b.average),
      distribution: [5, 4, 3, 2, 1].map((rating) => ({ rating, count: list.filter((f) => f.rating === rating).length })),
    };
  },
};

/* ---------------- Documents ---------------- */
export const mockDocumentService: IDocumentService = {
  async mine() {
    await delay();
    const c = ctx();
    requireRole(c, 'student');
    return clone(db().documents.filter((d) => d.studentId === c.studentId));
  },
  async upload(docId, file) {
    await delay(700);
    const c = ctx();
    requireRole(c, 'student');
    const d = db().documents.find((x) => x.id === docId);
    if (!d) throw notFound('Document');
    if (d.studentId !== c.studentId) throw forbidden();
    if (d.status === 'verified') throw new ServiceError('CONFLICT', 'This document is already verified.');
    if (!/\.(pdf|jpe?g|png)$/i.test(file.name)) throw invalid({ file: 'Upload a PDF, JPG or PNG file' });
    if (file.sizeKb > 5120) throw invalid({ file: 'File must be 5 MB or smaller' });
    mutate((s) => {
      const x = s.documents.find((y) => y.id === docId)!;
      Object.assign(x, { status: 'uploaded', fileName: file.name, fileSizeKb: file.sizeKb, uploadedAt: nowISO(), note: undefined });
      const st = s.students.find((y) => y.id === c.studentId)!;
      logActivity(s, c, 'student', `${st.name} uploaded ${x.type.replace(/_/g, ' ')}`, st.propertyId, `/manager/students/${st.id}`);
      notifyStaff(s, st.propertyId, 'Document uploaded', `${st.name} uploaded ${x.type.replace(/_/g, ' ')} for review.`, 'system', `/manager/students/${st.id}`);
    });
    return clone(db().documents.find((x) => x.id === docId)!);
  },
  async remove(docId) {
    await delay(200);
    const c = ctx();
    requireRole(c, 'student');
    const d = db().documents.find((x) => x.id === docId);
    if (!d) throw notFound('Document');
    if (d.studentId !== c.studentId) throw forbidden();
    if (d.status === 'verified') throw new ServiceError('CONFLICT', 'Verified documents can only be replaced by the office.');
    mutate((s) => { Object.assign(s.documents.find((y) => y.id === docId)!, { status: 'missing', fileName: undefined, fileSizeKb: undefined, uploadedAt: undefined }); });
    return clone(db().documents.find((x) => x.id === docId)!);
  },
  async review(docId, decision, note) {
    await delay(200);
    const c = ctx();
    requireRole(c, 'manager', 'owner');
    const s0 = db();
    const d = s0.documents.find((x) => x.id === docId);
    if (!d) throw notFound('Document');
    const st = s0.students.find((x) => x.id === d.studentId)!;
    assertPropertyAccess(c, st.propertyId);
    if (d.status !== 'uploaded') throw new ServiceError('CONFLICT', 'Only uploaded documents can be reviewed.');
    if (decision === 'rejected' && !note?.trim()) throw invalid({ note: 'Tell the student what to fix' });
    mutate((s) => {
      const x = s.documents.find((y) => y.id === docId)!;
      x.status = decision;
      x.note = decision === 'rejected' ? note!.trim() : undefined;
      logActivity(s, c, 'student', `${decision === 'verified' ? 'Verified' : 'Rejected'} ${x.type.replace(/_/g, ' ')} for ${st.name}`, st.propertyId, `/manager/students/${st.id}`);
      notifyStudent(s, st.id, `Document ${decision}`, `${x.type.replace(/_/g, ' ')}${x.note ? `: ${x.note}` : ''}`, 'system', '/student/documents');
    });
    return clone(db().documents.find((x) => x.id === docId)!);
  },
};

/* ---------------- Notifications & activity ---------------- */
export const mockNotificationService: INotificationService = {
  async list(filters = {}) {
    await delay(80);
    const c = ctx();
    return clone(db().notifications.filter((n) => n.recipientUserId === c.user.id && (!filters.category || n.category === filters.category) && (!filters.unreadOnly || !n.read)))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
  async markRead(id, read) {
    await delay(40);
    const c = ctx();
    mutate((s) => { const n = s.notifications.find((x) => x.id === id && x.recipientUserId === c.user.id); if (n) n.read = read; });
  },
  async markAllRead() {
    await delay(80);
    const c = ctx();
    mutate((s) => s.notifications.forEach((n) => { if (n.recipientUserId === c.user.id) n.read = true; }));
  },
};

export const mockActivityService: IActivityService = {
  async list(filters = {}) {
    await delay();
    const c = ctx();
    requireRole(c, 'owner', 'manager');
    const pid = scopeProperty(c, filters.propertyId);
    const s = db();
    return s.activity
      .filter((a) => (c.role === 'owner' ? !pid || a.propertyId === pid : a.propertyId === pid))
      .filter((a) => !filters.category || a.category === filters.category)
      .filter((a) => !filters.from || a.createdAt.slice(0, 10) >= filters.from)
      .filter((a) => !filters.to || a.createdAt.slice(0, 10) <= filters.to)
      .map((a) => ({ ...clone(a), propertyName: a.propertyId ? propertyName(s, a.propertyId) : 'Portfolio' }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, filters.limit ?? 500);
  },
};

