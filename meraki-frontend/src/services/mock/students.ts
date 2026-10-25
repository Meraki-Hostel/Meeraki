import type { IStudentService, StudentDetail, StudentInput, StudentListItem } from '../interfaces';
import type { DemoState, DocumentType, StudentProfile } from '@/types/domain';
import { forbidden, invalid, notFound } from '../errors';
import { assertPropertyAccess, bumpCounter, clone, ctx, db, delay, logActivity, mutate, newId, propertyName, requireRole, roomNumber, scopeProperty, withBalance, trimAll } from './base';
import { complaintView, leaveView, visitorView } from './views';
import { moveStudentToBed } from './rooms';
import { isEmail, isIndianPhone, normalizePhone } from '@/lib/validation';
import { currentPeriod, todayISO } from '@/lib/clock';

const DOC_TYPES: DocumentType[] = ['id_proof', 'admission_letter', 'photo', 'police_verification', 'rent_agreement', 'medical'];

export function studentListItem(s: DemoState, st: StudentProfile): StudentListItem {
  const balance = s.charges.filter((c) => c.studentId === st.id).map((c) => withBalance(s, c)).reduce((a, c) => a + c.balance, 0);
  return {
    ...clone(st), propertyName: propertyName(s, st.propertyId), roomNumber: roomNumber(s, st.roomId),
    bedLabel: s.beds.find((b) => b.id === st.bedId)?.label, balance,
  };
}

function detail(s: DemoState, st: StudentProfile, includeInternal: boolean): StudentDetail {
  return {
    student: studentListItem(s, st),
    charges: s.charges.filter((c) => c.studentId === st.id).map((c) => withBalance(s, c)).sort((a, b) => b.period.localeCompare(a.period)),
    payments: clone(s.payments.filter((p) => p.studentId === st.id)).sort((a, b) => b.paidOn.localeCompare(a.paidOn)),
    documents: clone(s.documents.filter((d) => d.studentId === st.id)),
    complaints: s.complaints.filter((c) => c.studentId === st.id).map((c) => complaintView(s, c, includeInternal)).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    leaves: s.leaves.filter((l) => l.studentId === st.id).map((l) => leaveView(s, l)).sort((a, b) => b.from.localeCompare(a.from)),
    visitors: s.visitors.filter((v) => v.studentId === st.id).map((v) => visitorView(s, v)).sort((a, b) => b.visitDate.localeCompare(a.visitDate)),
  };
}

function validateStudent(s: DemoState, input: Partial<StudentInput>, id?: string) {
  const e: Record<string, string> = {};
  const others = s.students.filter((x) => x.id !== id);
  if (input.name !== undefined && input.name.trim().length < 3) e.name = 'Enter the full name';
  if (input.email !== undefined) {
    if (!isEmail(input.email)) e.email = 'Enter a valid email address';
    else if (others.some((x) => x.email.toLowerCase() === input.email!.trim().toLowerCase())) e.email = 'Another student already uses this email';
  }
  if (input.phone !== undefined) {
    if (!isIndianPhone(input.phone)) e.phone = 'Enter a 10-digit Indian mobile number';
    else if (others.some((x) => normalizePhone(x.phone) === normalizePhone(input.phone!))) e.phone = 'Another student already uses this phone number';
  }
  if (input.studentCode !== undefined) {
    if (!/^[A-Z0-9-]{4,16}$/i.test(input.studentCode.trim())) e.studentCode = 'Use 4–16 letters, digits or hyphens';
    else if (others.some((x) => x.studentCode.toLowerCase() === input.studentCode!.trim().toLowerCase())) e.studentCode = 'This student ID is already in use';
  }
  if (input.guardianPhone !== undefined && !isIndianPhone(input.guardianPhone)) e.guardianPhone = 'Enter a 10-digit Indian mobile number';
  if (input.emergencyPhone !== undefined && !isIndianPhone(input.emergencyPhone)) e.emergencyPhone = 'Enter a 10-digit Indian mobile number';
  if (input.guardianName !== undefined && !input.guardianName.trim()) e.guardianName = 'Guardian name is required';
  if (input.dob !== undefined && (!input.dob || input.dob > '2010-12-31')) e.dob = 'Enter a valid date of birth';
  if (input.college !== undefined && !input.college.trim()) e.college = 'College is required';
  if (input.monthlyRent !== undefined && !(input.monthlyRent >= 1000)) e.monthlyRent = 'Rent must be at least ₹1,000';
  if (Object.keys(e).length) throw invalid(e);
}

export const mockStudentService: IStudentService = {
  async list(filters = {}) {
    await delay();
    const c = ctx();
    requireRole(c, 'owner', 'manager');
    const pid = scopeProperty(c, filters.propertyId);
    const s = db();
    const q = filters.search?.trim().toLowerCase();
    return s.students
      .filter((x) => !pid || x.propertyId === pid)
      .filter((x) => !filters.status || x.status === filters.status)
      .map((x) => studentListItem(s, x))
      .filter((x) => !q || `${x.name} ${x.studentCode} ${x.phone} ${x.email} ${x.roomNumber ?? ''} ${x.college}`.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name));
  },
  async get(id) {
    await delay();
    const c = ctx();
    const s = db();
    const st = s.students.find((x) => x.id === id);
    if (!st) throw notFound('Student');
    if (c.role === 'student' && c.studentId !== id) throw forbidden();
    assertPropertyAccess(c, st.propertyId);
    return detail(s, st, c.role !== 'student');
  },
  async me() {
    await delay();
    const c = ctx();
    requireRole(c, 'student');
    const s = db();
    const st = s.students.find((x) => x.id === c.studentId);
    if (!st) throw notFound('Student profile');
    return detail(s, st, false);
  },
  async create(input) {
    await delay(320);
    const c = ctx();
    requireRole(c, 'owner', 'manager');
    const propertyId = scopeProperty(c);
    if (!propertyId) throw invalid({ bedId: 'Owners add students from a property manager account' });
    const data = trimAll(input);
    validateStudent(db(), data);
    const id = newId('stu');
    mutate((s) => {
      const st: StudentProfile = {
        id, studentCode: data.studentCode.toUpperCase(), name: data.name, email: data.email.toLowerCase(), phone: normalizePhone(data.phone),
        gender: data.gender, dob: data.dob, college: data.college, course: data.course, year: data.year, propertyId,
        status: 'pending', joinedOn: data.joinedOn || todayISO(), monthlyRent: data.monthlyRent, address: data.address, bloodGroup: data.bloodGroup,
        guardianName: data.guardianName, guardianRelation: data.guardianRelation, guardianPhone: normalizePhone(data.guardianPhone),
        emergencyName: data.emergencyName, emergencyPhone: normalizePhone(data.emergencyPhone),
      };
      s.students.push(st);
      if (data.bedId) moveStudentToBed(s, id, data.bedId);
      DOC_TYPES.forEach((type) => s.documents.push({ id: `doc_${id}_${type}`, studentId: id, type, status: 'missing' }));
      // First month's rent charge is raised on admission.
      const period = currentPeriod();
      const due = `${period}-${String(s.settings.rentDueDay).padStart(2, '0')}`;
      s.charges.push({ id: `chg_${id}_${period.replace('-', '')}`, studentId: id, propertyId, period, amount: st.monthlyRent, dueDate: due < todayISO() ? todayISO() : due, description: 'Monthly rent (admission)' });
      bumpCounter(s, 'student', 200);
      const room = s.rooms.find((r) => r.id === st.roomId);
      logActivity(s, c, 'student', `Added student ${st.name}${room ? ` to Room ${room.number}` : ' (awaiting bed)'}`, propertyId, `/manager/students/${id}`);
    });
    return clone(db().students.find((x) => x.id === id)!);
  },
  async update(id, patch) {
    await delay(240);
    const c = ctx();
    requireRole(c, 'owner', 'manager');
    const st = db().students.find((x) => x.id === id);
    if (!st) throw notFound('Student');
    assertPropertyAccess(c, st.propertyId);
    const data = trimAll(patch);
    delete data.bedId;
    validateStudent(db(), data, id);
    mutate((s) => {
      const x = s.students.find((y) => y.id === id)!;
      Object.assign(x, data);
      if (data.phone) x.phone = normalizePhone(data.phone);
      if (data.studentCode) x.studentCode = data.studentCode.toUpperCase();
      logActivity(s, c, 'student', `Updated profile for ${x.name}`, x.propertyId, `/manager/students/${id}`);
    });
    return clone(db().students.find((x) => x.id === id)!);
  },
  async setStatus(id, status) {
    await delay();
    const c = ctx();
    requireRole(c, 'owner', 'manager');
    const st = db().students.find((x) => x.id === id);
    if (!st) throw notFound('Student');
    assertPropertyAccess(c, st.propertyId);
    mutate((s) => {
      const x = s.students.find((y) => y.id === id)!;
      x.status = status;
      if (status === 'moved_out') {
        const b = s.beds.find((bb) => bb.studentId === id);
        if (b) { b.status = 'available'; b.studentId = undefined; }
        x.roomId = undefined;
        x.bedId = undefined;
      }
      logActivity(s, c, 'student', `Changed status of ${x.name} to ${status.replace('_', ' ')}`, x.propertyId, `/manager/students/${id}`);
    });
    return clone(db().students.find((x) => x.id === id)!);
  },
  async updateSelf(patch) {
    await delay(260);
    const c = ctx();
    requireRole(c, 'student');
    const data = trimAll(patch);
    const e: Record<string, string> = {};
    if (!isEmail(data.email)) e.email = 'Enter a valid email address';
    if (!isIndianPhone(data.phone)) e.phone = 'Enter a 10-digit Indian mobile number';
    if (!data.emergencyName) e.emergencyName = 'Emergency contact name is required';
    if (!isIndianPhone(data.emergencyPhone)) e.emergencyPhone = 'Enter a 10-digit Indian mobile number';
    if (data.address.length < 8) e.address = 'Enter your full address';
    const others = db().students.filter((x) => x.id !== c.studentId);
    if (!e.phone && others.some((x) => normalizePhone(x.phone) === normalizePhone(data.phone))) e.phone = 'This phone number is linked to another resident';
    if (Object.keys(e).length) throw invalid(e);
    mutate((s) => {
      const x = s.students.find((y) => y.id === c.studentId)!;
      Object.assign(x, data, { phone: normalizePhone(data.phone), emergencyPhone: normalizePhone(data.emergencyPhone) });
      logActivity(s, c, 'student', `${x.name} updated their contact details`, x.propertyId, `/manager/students/${x.id}`);
    });
    return clone(db().students.find((x) => x.id === c.studentId)!);
  },
  async nextStudentCode() {
    await delay(30);
    const c = ctx();
    const s = db();
    const code = s.properties.find((p) => p.id === c.propertyId)?.code ?? 'MH';
    let n = (s.counters.student ?? 200) + 1;
    while (s.students.some((x) => x.studentCode === `MHM-${code}-${String(n).padStart(4, '0')}`)) n++;
    return `MHM-${code}-${String(n).padStart(4, '0')}`;
  },
};
