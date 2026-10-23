import type {
  ActivityCategory, ChargeStatus, ChargeWithBalance, DemoState, ID, Notification, NotificationCategory, Property, RentCharge, Role, User,
} from '@/types/domain';
import { repository } from '../repository';
import { ServiceError, forbidden, notFound } from '../errors';
import { nowISO, todayISO } from '@/lib/clock';
import type { PropertyStats } from '../interfaces';

export const db = () => repository.read() as DemoState;
export const mutate = (fn: (s: DemoState) => void) => repository.update(fn);

/** Small, consistent latency so loading states are visible but snappy. */
export const delay = (ms = 160) => new Promise<void>((r) => setTimeout(r, ms));
export const clone = <T,>(v: T): T => structuredClone(v);

let idSeq = 0;
export const newId = (prefix: string) => `${prefix}_${Date.now().toString(36)}${(idSeq++).toString(36)}`;
/** Increment a display counter inside an existing mutation. */
export function bumpCounter(s: DemoState, key: string, start = 0): number {
  const value = (s.counters[key] ?? start) + 1;
  s.counters[key] = value;
  return value;
}

export interface Ctx { user: User; role: Role; propertyId?: ID; studentId?: ID }

/** Resolve current session → acting user. Throws UNAUTHENTICATED if signed out. */
export function ctx(): Ctx {
  const s = db();
  if (!s.session) throw new ServiceError('UNAUTHENTICATED', 'Your session has ended. Sign in again.');
  const user = s.users.find((u) => u.id === s.session!.userId);
  if (!user) throw new ServiceError('UNAUTHENTICATED', 'Your session has ended. Sign in again.');
  return { user, role: user.role, propertyId: user.propertyId, studentId: user.studentId };
}

export function requireRole(c: Ctx, ...roles: Role[]) {
  if (!roles.includes(c.role)) throw forbidden('This action is not available for your role.');
}

/** Property filter for the acting user: owner → requested/all, manager/student → their property only. */
export function scopeProperty(c: Ctx, requested?: ID): ID | undefined {
  if (c.role === 'owner') return requested || undefined;
  if (requested && requested !== c.propertyId) throw forbidden();
  return c.propertyId;
}
export function assertPropertyAccess(c: Ctx, propertyId: ID) {
  if (c.role !== 'owner' && c.propertyId !== propertyId) throw forbidden();
}
export const inScope = (c: Ctx, propertyId: ID) => c.role === 'owner' || c.propertyId === propertyId;

export function findOr404<T extends { id: ID }>(list: T[], id: ID, what: string): T {
  const item = list.find((x) => x.id === id);
  if (!item) throw notFound(what);
  return item;
}

/* ---------- Lookup helpers ---------- */
export const propertyName = (s: DemoState, id?: ID) => s.properties.find((p) => p.id === id)?.name ?? '—';
export const studentName = (s: DemoState, id?: ID) => s.students.find((p) => p.id === id)?.name ?? 'Unknown resident';
export const staffName = (s: DemoState, id?: ID) => (id ? s.staff.find((p) => p.id === id)?.name : undefined);
export const roomNumber = (s: DemoState, roomId?: ID) => s.rooms.find((r) => r.id === roomId)?.number;

/* ---------- Money derivations ---------- */
export function chargeStatus(amount: number, paid: number, dueDate: string): ChargeStatus {
  if (paid >= amount) return 'paid';
  if (todayISO() > dueDate) return 'overdue';
  if (paid > 0) return 'partial';
  return 'pending';
}
export function withBalance(s: DemoState, c: RentCharge): ChargeWithBalance {
  const paid = s.payments.filter((p) => p.chargeId === c.id).reduce((a, p) => a + p.amount, 0);
  return { ...c, paid, balance: Math.max(0, c.amount - paid), status: chargeStatus(c.amount, paid, c.dueDate) };
}

export function propertyStats(s: DemoState, p: Property, period = todayISO().slice(0, 7)): PropertyStats {
  const beds = s.beds.filter((b) => b.propertyId === p.id);
  const occupied = beds.filter((b) => b.status === 'occupied').length;
  const unavailable = beds.filter((b) => b.status === 'unavailable').length;
  const charges = s.charges.filter((c) => c.propertyId === p.id && c.period === period).map((c) => withBalance(s, c));
  return {
    rooms: s.rooms.filter((r) => r.propertyId === p.id).length,
    beds: beds.length,
    occupiedBeds: occupied,
    availableBeds: beds.length - occupied - unavailable,
    unavailableBeds: unavailable,
    occupancyPct: beds.length ? Math.round((occupied / beds.length) * 100) : 0,
    students: s.students.filter((x) => x.propertyId === p.id && (x.status === 'active' || x.status === 'notice')).length,
    expectedRent: charges.reduce((a, c) => a + c.amount, 0),
    collectedRent: charges.reduce((a, c) => a + Math.min(c.paid, c.amount), 0),
    openComplaints: s.complaints.filter((c) => c.propertyId === p.id && (c.status === 'open' || c.status === 'in_progress')).length,
    managerName: staffName(s, p.managerStaffId),
  };
}

/* ---------- Side effects ---------- */
export function logActivity(s: DemoState, c: Ctx | null, category: ActivityCategory, message: string, propertyId?: ID, link?: string) {
  s.activity.unshift({
    id: newId('act'), propertyId, actorName: c?.user.name ?? 'System', actorRole: c?.role ?? 'system',
    category, message, link, createdAt: nowISO(),
  });
}

export function notify(s: DemoState, recipientUserId: ID, n: Omit<Notification, 'id' | 'recipientUserId' | 'read' | 'createdAt'>) {
  s.notifications.unshift({ ...n, id: newId('ntf'), recipientUserId, read: false, createdAt: nowISO() });
}
/** Notify the manager login(s) for a property and all owners. */
export function notifyStaff(s: DemoState, propertyId: ID, title: string, body: string, category: NotificationCategory, managerLink: string, ownerLink?: string) {
  s.users.filter((u) => u.role === 'manager' && u.propertyId === propertyId).forEach((u) => notify(s, u.id, { title, body, category, link: managerLink }));
  if (ownerLink) s.users.filter((u) => u.role === 'owner').forEach((u) => notify(s, u.id, { title, body, category, link: ownerLink }));
}
export function notifyStudent(s: DemoState, studentId: ID, title: string, body: string, category: NotificationCategory, link: string) {
  s.users.filter((u) => u.studentId === studentId).forEach((u) => notify(s, u.id, { title, body, category, link }));
}

export const trimAll = <T extends object>(o: T): T => {
  const out = { ...o } as Record<string, unknown>;
  for (const k of Object.keys(out)) if (typeof out[k] === 'string') out[k] = (out[k] as string).trim();
  return out as T;
};
