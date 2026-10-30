import { prisma } from "../../config/prisma.js";
import { invalid, notFound, forbidden, conflict } from "../../utils/ApiError.js";
import { requireRole, propertyScope, assertPropertyAccess } from "../../utils/scope.js";
import { iso, todayISO } from "../../utils/money.js";
import { isIndianPhone, normalizePhone } from "../../utils/validators.js";
import { logActivity, notifyStudentUsers, notifyStaffUsers } from "../../utils/effects.js";

const STAFF_LINK = "/manager/leave";
const STUDENT_LINK = "/student/leave";
const MAX_DAYS = 30;
const ACTIVE = ["pending", "approved"]; // requests that still hold their dates

const day = (s) => new Date(`${s}T00:00:00.000Z`);
const addDays = (s, n) => iso(new Date(day(s).getTime() + n * 86_400_000));
const short = (s) => day(s).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });

// A student login without a resident profile must never fall through to an
// unfiltered query (Prisma ignores `studentId: undefined`).
function ownStudentId(auth) {
  if (!auth.studentId) throw forbidden();
  return auth.studentId;
}

// ── Shared helpers ───────────────────────────────────────────────────────────
// Display names for exactly the rows being returned (never a scan of every tenant's data).
async function lookupsFor(rows) {
  const studentIds = [...new Set(rows.map((r) => r.studentId))];
  const propertyIds = [...new Set(rows.map((r) => r.propertyId))];
  const [students, properties] = await Promise.all([
    prisma.studentProfile.findMany({ where: { id: { in: studentIds } }, select: { id: true, name: true, roomId: true } }),
    prisma.property.findMany({ where: { id: { in: propertyIds } }, select: { id: true, name: true } }),
  ]);
  const roomIds = [...new Set(students.map((st) => st.roomId).filter(Boolean))];
  const rooms = roomIds.length ? await prisma.room.findMany({ where: { id: { in: roomIds } }, select: { id: true, number: true } }) : [];
  return {
    sById: new Map(students.map((st) => [st.id, st])),
    pById: new Map(properties.map((p) => [p.id, p.name])),
    rById: new Map(rooms.map((r) => [r.id, r.number])),
  };
}

// Dates as YYYY-MM-DD; absent optional fields omitted rather than null, matching domain.ts.
const serialize = (l) => ({
  ...l,
  from: iso(l.from), to: iso(l.to),
  decisionReason: l.decisionReason ?? undefined,
  decidedBy: l.decidedBy ?? undefined,
  decidedAt: l.decidedAt ?? undefined,
});

async function views(rows) {
  const { sById, pById, rById } = await lookupsFor(rows);
  return rows.map((l) => {
    const st = sById.get(l.studentId);
    return {
      ...serialize(l),
      studentName: st?.name ?? "Unknown",
      roomNumber: st?.roomId ? rById.get(st.roomId) : undefined,
      propertyName: pById.get(l.propertyId) ?? "—",
    };
  });
}

// One request the caller may act on: their own as a student, their property's as staff.
async function loadVisible(auth, id) {
  const l = await prisma.leaveRequest.findUnique({ where: { id } });
  if (!l) throw notFound("Leave request");
  if (auth.role === "student") {
    if (l.studentId !== ownStudentId(auth)) throw forbidden();
  } else {
    await assertPropertyAccess(auth, l.propertyId);
  }
  return l;
}

// Locks the request row and re-checks it is still pending, so a decision and a
// cancellation (or two decisions) can never both apply.
async function lockPending(tx, id, action) {
  await tx.$queryRaw`SELECT "id" FROM "LeaveRequest" WHERE "id" = ${id} FOR UPDATE`;
  const l = await tx.leaveRequest.findUnique({ where: { id } });
  if (l.status !== "pending") throw conflict(`Only pending requests can be ${action}.`);
  return l;
}

// ── Reads ────────────────────────────────────────────────────────────────────
export async function list(auth, filters = {}) {
  const where = auth.role === "student"
    ? { studentId: ownStudentId(auth) }
    : { ...(await propertyScope(auth, filters.propertyId)) };
  if (filters.status) where.status = filters.status;

  const rows = await prisma.leaveRequest.findMany({ where, orderBy: { createdAt: "desc" } });
  return views(rows);
}

// ── Writes ───────────────────────────────────────────────────────────────────
export async function create(auth, actorName, input) {
  requireRole(auth, "student");
  const studentId = ownStudentId(auth);

  const e = {};
  if (input.from < todayISO()) e.from = "Departure cannot be in the past";
  if (input.to < input.from) e.to = "Return must be on or after departure";
  else if (input.to > addDays(input.from, MAX_DAYS)) e.to = `Leave longer than ${MAX_DAYS} days needs office approval`;
  if (!isIndianPhone(input.contactPhone)) e.contactPhone = "Enter a 10-digit Indian mobile number";
  if (Object.keys(e).length) throw invalid(e);

  const created = await prisma.$transaction(async (tx) => {
    // Lock the resident so two simultaneous requests cannot both pass the overlap check.
    await tx.$queryRaw`SELECT "id" FROM "StudentProfile" WHERE "id" = ${studentId} FOR UPDATE`;
    const st = await tx.studentProfile.findUnique({ where: { id: studentId }, select: { id: true, name: true, propertyId: true } });
    if (!st) throw notFound("Student");

    const overlap = await tx.leaveRequest.count({
      where: { studentId, status: { in: ACTIVE }, from: { lte: day(input.to) }, to: { gte: day(input.from) } },
    });
    if (overlap) throw invalid({ from: "You already have a leave request for these dates" });

    const l = await tx.leaveRequest.create({
      data: {
        studentId, propertyId: st.propertyId, from: day(input.from), to: day(input.to),
        destination: input.destination, contactPhone: normalizePhone(input.contactPhone), reason: input.reason,
      },
    });
    const dates = `${short(input.from)} – ${short(input.to)}`;
    await logActivity(tx, auth, actorName, "leave", `${st.name} requested leave ${dates}`, st.propertyId, STAFF_LINK);
    await notifyStaffUsers(tx, st.propertyId, "New leave request", `${st.name} · ${dates}`, "leave", STAFF_LINK);
    return l;
  });
  return serialize(created);
}

export async function decide(auth, actorName, id, decision, reason) {
  requireRole(auth, "owner", "manager");
  await loadVisible(auth, id);
  if (decision === "rejected" && !reason) throw invalid({ reason: "Give a reason so the student knows what to change" });

  const updated = await prisma.$transaction(async (tx) => {
    await lockPending(tx, id, "decided");
    const l = await tx.leaveRequest.update({
      where: { id },
      data: { status: decision, decisionReason: reason || null, decidedBy: actorName, decidedAt: new Date() },
    });
    const st = await tx.studentProfile.findUnique({ where: { id: l.studentId }, select: { name: true } });
    const dates = `${short(iso(l.from))} – ${short(iso(l.to))}`;
    await logActivity(tx, auth, actorName, "leave", `${decision === "approved" ? "Approved" : "Rejected"} leave for ${st?.name ?? "a resident"}`, l.propertyId, STAFF_LINK);
    await notifyStudentUsers(tx, l.studentId, `Leave ${decision}`, `${dates}${reason ? `: ${reason}` : ""}`, "leave", STUDENT_LINK);
    return l;
  });
  return serialize(updated);
}

export async function cancel(auth, actorName, id) {
  requireRole(auth, "student");
  await loadVisible(auth, id);

  const updated = await prisma.$transaction(async (tx) => {
    await lockPending(tx, id, "cancelled");
    const l = await tx.leaveRequest.update({ where: { id }, data: { status: "cancelled" } });
    await logActivity(tx, auth, actorName, "leave", `${actorName} cancelled a leave request`, l.propertyId, STAFF_LINK);
    return l;
  });
  return serialize(updated);
}
