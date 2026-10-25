import type { DemoState, Complaint, LeaveRequest, VisitorRequest } from '@/types/domain';
import type { ComplaintView, LeaveView, VisitorView } from '../interfaces';
import { clone, propertyName, roomNumber, staffName, studentName } from './base';

export function complaintView(s: DemoState, c: Complaint, includeInternal: boolean): ComplaintView {
  const copy = clone(c);
  if (!includeInternal) copy.comments = copy.comments.filter((x) => !x.internal);
  return { ...copy, studentName: studentName(s, c.studentId), propertyName: propertyName(s, c.propertyId), roomNumber: roomNumber(s, c.roomId), assigneeName: staffName(s, c.assigneeStaffId) };
}
export function leaveView(s: DemoState, l: LeaveRequest): LeaveView {
  const st = s.students.find((x) => x.id === l.studentId);
  return { ...clone(l), studentName: st?.name ?? 'Unknown', roomNumber: roomNumber(s, st?.roomId), propertyName: propertyName(s, l.propertyId) };
}
export function visitorView(s: DemoState, v: VisitorRequest): VisitorView {
  const st = s.students.find((x) => x.id === v.studentId);
  return { ...clone(v), studentName: st?.name ?? 'Unknown', roomNumber: roomNumber(s, st?.roomId), propertyName: propertyName(s, v.propertyId) };
}
