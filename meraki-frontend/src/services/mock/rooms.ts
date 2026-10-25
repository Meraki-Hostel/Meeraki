import type { IRoomService, RoomInput, RoomWithBeds } from '../interfaces';
import type { Bed, DemoState, Room } from '@/types/domain';
import { ServiceError, forbidden, invalid, notFound } from '../errors';
import { assertPropertyAccess, clone, ctx, db, delay, logActivity, mutate, newId, notifyStudent, propertyName, requireRole, scopeProperty } from './base';

const BEDS = { single: 1, double: 2, triple: 3, quad: 4 } as const;
const LABELS = ['A', 'B', 'C', 'D'];

function validateRoom(s: DemoState, propertyId: string, input: Partial<RoomInput>, id?: string) {
  const e: Record<string, string> = {};
  if (input.number !== undefined) {
    if (!/^[A-Za-z0-9-]{1,6}$/.test(input.number.trim())) e.number = 'Use up to 6 letters or digits, e.g. 205';
    else if (s.rooms.some((r) => r.id !== id && r.propertyId === propertyId && r.number.toLowerCase() === input.number!.trim().toLowerCase())) e.number = 'This room number already exists here';
  }
  if (input.floor !== undefined && !(Number.isInteger(input.floor) && input.floor >= 0 && input.floor <= 20)) e.floor = 'Floor must be between 0 and 20';
  if (input.rent !== undefined && !(input.rent >= 1000)) e.rent = 'Rent must be at least ₹1,000';
  if (Object.keys(e).length) throw invalid(e);
}

/** Moves a student to a bed, releasing their previous bed. Keeps room, bed and profile in sync. */
export function moveStudentToBed(s: DemoState, studentId: string, bedId: string) {
  const student = s.students.find((x) => x.id === studentId);
  const bed = s.beds.find((b) => b.id === bedId);
  if (!student) throw notFound('Student');
  if (!bed) throw notFound('Bed');
  if (bed.propertyId !== student.propertyId) throw new ServiceError('VALIDATION', 'Bed must be in the student’s property.');
  if (bed.status === 'occupied' && bed.studentId !== studentId) throw new ServiceError('CONFLICT', 'That bed is already occupied. Pick an available bed.');
  if (bed.status === 'unavailable') throw new ServiceError('CONFLICT', 'That bed is marked unavailable.');
  const room = s.rooms.find((r) => r.id === bed.roomId)!;
  if (room.status === 'maintenance') throw new ServiceError('CONFLICT', 'That room is under maintenance.');
  const prev = s.beds.find((b) => b.studentId === studentId);
  if (prev) { prev.status = 'available'; prev.studentId = undefined; }
  bed.status = 'occupied';
  bed.studentId = studentId;
  student.roomId = room.id;
  student.bedId = bed.id;
  student.monthlyRent = room.rent;
  if (student.status === 'pending') student.status = 'active';
}

export const mockRoomService: IRoomService = {
  async list(filters = {}) {
    await delay();
    const c = ctx();
    requireRole(c, 'owner', 'manager');
    const pid = scopeProperty(c, filters.propertyId);
    const s = db();
    return s.rooms
      .filter((r) => !pid || r.propertyId === pid)
      .map<RoomWithBeds>((r) => ({
        ...clone(r),
        propertyName: propertyName(s, r.propertyId),
        beds: s.beds.filter((b) => b.roomId === r.id).map((b) => {
          const st = s.students.find((x) => x.id === b.studentId);
          return { ...clone(b), studentName: st?.name, studentCode: st?.studentCode };
        }),
      }))
      .sort((a, b) => a.floor - b.floor || a.number.localeCompare(b.number, 'en', { numeric: true }));
  },
  async create(input) {
    await delay(260);
    const c = ctx();
    requireRole(c, 'owner', 'manager');
    const propertyId = scopeProperty(c, input.propertyId);
    if (!propertyId) throw invalid({ propertyId: 'Choose a property' });
    validateRoom(db(), propertyId, input);
    const id = newId('room');
    mutate((s) => {
      const room: Room = { id, propertyId, number: input.number.trim().toUpperCase(), floor: input.floor, type: input.type, rent: input.rent, ac: input.ac, attachedBath: input.attachedBath, status: 'active' };
      s.rooms.push(room);
      for (let i = 0; i < BEDS[input.type]; i++) s.beds.push({ id: `${id}_${LABELS[i]!.toLowerCase()}`, roomId: id, propertyId, label: LABELS[i]!, status: 'available' });
      logActivity(s, c, 'room', `Added room ${room.number} (${room.type}, ${BEDS[room.type]} beds)`, propertyId, '/manager/rooms');
    });
    return clone(db().rooms.find((r) => r.id === id)!);
  },
  async update(id, input) {
    await delay(240);
    const c = ctx();
    requireRole(c, 'owner', 'manager');
    const s0 = db();
    const room = s0.rooms.find((r) => r.id === id);
    if (!room) throw notFound('Room');
    assertPropertyAccess(c, room.propertyId);
    validateRoom(s0, room.propertyId, input, id);
    if (input.type && input.type !== room.type) {
      const target = BEDS[input.type];
      const beds = s0.beds.filter((b) => b.roomId === id);
      const removable = beds.slice(target);
      if (removable.some((b) => b.status === 'occupied')) throw invalid({ type: 'Move residents out of the extra beds before reducing capacity' });
    }
    mutate((s) => {
      const r = s.rooms.find((x) => x.id === id)!;
      if (input.type && input.type !== r.type) {
        const target = BEDS[input.type];
        const beds = s.beds.filter((b) => b.roomId === id);
        if (beds.length > target) {
          const drop = new Set(beds.slice(target).map((b) => b.id));
          s.beds = s.beds.filter((b) => !drop.has(b.id));
        } else {
          for (let i = beds.length; i < target; i++) s.beds.push({ id: `${id}_${LABELS[i]!.toLowerCase()}`, roomId: id, propertyId: r.propertyId, label: LABELS[i]!, status: 'available' });
        }
      }
      Object.assign(r, { ...input, number: input.number ? input.number.trim().toUpperCase() : r.number, propertyId: r.propertyId });
      if (input.rent !== undefined) s.students.filter((st) => st.roomId === id).forEach((st) => { st.monthlyRent = input.rent!; });
      logActivity(s, c, 'room', `Updated room ${r.number}`, r.propertyId, '/manager/rooms');
    });
    return clone(db().rooms.find((r) => r.id === id)!);
  },
  async setBedStatus(bedId, status, reason) {
    await delay();
    const c = ctx();
    requireRole(c, 'owner', 'manager');
    const bed = db().beds.find((b) => b.id === bedId);
    if (!bed) throw notFound('Bed');
    assertPropertyAccess(c, bed.propertyId);
    if (bed.status === 'occupied') throw new ServiceError('CONFLICT', 'Vacate or transfer the resident before changing this bed.');
    if (status === 'unavailable' && !reason?.trim()) throw invalid({ reason: 'Add a short reason' });
    mutate((s) => {
      const b = s.beds.find((x) => x.id === bedId)!;
      b.status = status;
      b.unavailableReason = status === 'unavailable' ? reason!.trim() : undefined;
      const rn = s.rooms.find((r) => r.id === b.roomId)?.number;
      logActivity(s, c, 'room', `Marked bed ${rn}-${b.label} ${status}${reason ? ` (${reason.trim()})` : ''}`, b.propertyId, '/manager/rooms');
    });
    return clone(db().beds.find((b) => b.id === bedId) as Bed);
  },
  async assignBed(studentId, bedId) {
    await delay(260);
    const c = ctx();
    requireRole(c, 'owner', 'manager');
    const st = db().students.find((x) => x.id === studentId);
    if (!st) throw notFound('Student');
    if (!(c.role === 'owner' || st.propertyId === c.propertyId)) throw forbidden();
    const prevBed = st.bedId;
    mutate((s) => {
      moveStudentToBed(s, studentId, bedId);
      const student = s.students.find((x) => x.id === studentId)!;
      const room = s.rooms.find((r) => r.id === student.roomId)!;
      const bed = s.beds.find((b) => b.id === bedId)!;
      const label = `Room ${room.number}, Bed ${bed.label}`;
      logActivity(s, c, 'room', `${prevBed ? 'Transferred' : 'Assigned'} ${student.name} to ${label}`, student.propertyId, `/manager/students/${studentId}`);
      notifyStudent(s, studentId, prevBed ? 'Room transfer confirmed' : 'Bed allotted', `You are now in ${label}. Monthly rent: ₹${room.rent.toLocaleString('en-IN')}.`, 'system', '/student/home');
    });
  },
  async vacateBed(studentId) {
    await delay();
    const c = ctx();
    requireRole(c, 'owner', 'manager');
    const st = db().students.find((x) => x.id === studentId);
    if (!st) throw notFound('Student');
    assertPropertyAccess(c, st.propertyId);
    mutate((s) => {
      const b = s.beds.find((x) => x.studentId === studentId);
      if (b) { b.status = 'available'; b.studentId = undefined; }
      const student = s.students.find((x) => x.id === studentId)!;
      student.roomId = undefined;
      student.bedId = undefined;
      logActivity(s, c, 'room', `Vacated bed for ${student.name}`, student.propertyId, '/manager/rooms');
    });
  },
};
