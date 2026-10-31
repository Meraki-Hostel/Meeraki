import { prisma } from "../../config/prisma.js";
import { invalid, notFound, forbidden, conflict } from "../../utils/ApiError.js";
import { requireRole, propertyScope, assertPropertyAccess } from "../../utils/scope.js";
import { iso, todayISO } from "../../utils/money.js";
import { isIndianPhone, normalizePhone } from "../../utils/validators.js";
import { logActivity, notifyStudentUsers, notifyStaffUsers } from "../../utils/effects.js";

const STAFF_LINK = "/manager/visitors";
const STUDENT_LINK = "/student/visitors";
const MAX_DAYS_AHEAD = 30;
const OPENS = "08:00";
const CLOSES = "19:00";
const RESIDENT = ["active", "notice"]; // students who live here and can receive visitors

const day = (s) => new Date(`${s}T00:00:00.000Z`);
const addDays = (s, n) => iso(new Date(day(s).getTime() + n * 86_400_000));
const short = (s) => day(s).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });

// A student login without a resident profile must never fall through to an
// unfiltered query (Prisma ignores `studentId: undefined`).
function ownStudentId(auth) {
  if (!auth.studentId) throw forbidden();
  return auth.studentId;
}

// Rules shared by requests and walk-ins; zod has already checked the formats.
function visitErrors(input) {
  const e = {};
  if (!isIndianPhone(input.visitorPhone)) e.visitorPhone = "Enter a 10-digit Indian mobile number";
  if (input.visitTime < OPENS || input.visitTime > CLOSES) e.visitTime = "Visiting hours are 8:00 am to 7:00 pm";
  return e;
}

const visitorData = (input) => ({
  visitorName: input.visitorName,
  visitorPhone: normalizePhone(input.visitorPhone),
  relation: input.relation,
  visitTime: input.visitTime,
});

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
const serialize = (v) => ({
  ...v,
  visitDate: iso(v.visitDate),
  decisionReason: v.decisionReason ?? undefined,
  decidedBy: v.decidedBy ?? undefined,
  decidedAt: v.decidedAt ?? undefined,
  checkInAt: v.checkInAt ?? undefined,
  checkOutAt: v.checkOutAt ?? undefined,
});

async function views(rows) {
  const { sById, pById, rById } = await lookupsFor(rows);
  return rows.map((v) => {
    const st = sById.get(v.studentId);
    return {
      ...serialize(v),
      studentName: st?.name ?? "Unknown",
      roomNumber: st?.roomId ? rById.get(st.roomId) : undefined,
      propertyName: pById.get(v.propertyId) ?? "—",
    };
  });
}

// One visit the caller may act on: their own as a student, their property's as staff.
async function loadVisible(auth, id) {
  const v = await prisma.visitorRequest.findUnique({ where: { id } });
  if (!v) throw notFound("Visitor request");
  if (auth.role === "student") {
    if (v.studentId !== ownStudentId(auth)) throw forbidden();
  } else {
    await assertPropertyAccess(auth, v.propertyId);
  }
  return v;
}

// Locks the visit row and re-checks its status, so two transitions racing on the
// same visit (approve vs cancel, check-in vs cancel, double check-out) cannot both apply.
async function lockIn(tx, id, allowed, message) {
  await tx.$queryRaw`SELECT "id" FROM "VisitorRequest" WHERE "id" = ${id} FOR UPDATE`;
  const v = await tx.visitorRequest.findUnique({ where: { id } });
  if (!allowed.includes(v.status)) throw conflict(message);
  return v;
}

// ── Reads ────────────────────────────────────────────────────────────────────
export async function list(auth, filters = {}) {
  const where = auth.role === "student"
    ? { studentId: ownStudentId(auth) }
    : { ...(await propertyScope(auth, filters.propertyId)) };
  if (filters.status) where.status = filters.status;
  if (filters.date) where.visitDate = day(filters.date);

  const rows = await prisma.visitorRequest.findMany({ where, orderBy: [{ visitDate: "desc" }, { visitTime: "desc" }] });
  return views(rows);
}

// ── Writes ───────────────────────────────────────────────────────────────────
export async function create(auth, actorName, input) {
  requireRole(auth, "student");
  const studentId = ownStudentId(auth);

  const e = visitErrors(input);
  const today = todayISO();
  if (input.visitDate < today) e.visitDate = "Visit date cannot be in the past";
  else if (input.visitDate > addDays(today, MAX_DAYS_AHEAD)) e.visitDate = `Requests can be made up to ${MAX_DAYS_AHEAD} days ahead`;
  if (Object.keys(e).length) throw invalid(e);

  const st = await prisma.studentProfile.findUnique({ where: { id: studentId }, select: { name: true, propertyId: true } });
  if (!st) throw notFound("Student");

  const created = await prisma.$transaction(async (tx) => {
    const v = await tx.visitorRequest.create({
      data: { ...visitorData(input), studentId, propertyId: st.propertyId, visitDate: day(input.visitDate), purpose: input.purpose || "Visit" },
    });
    await logActivity(tx, auth, actorName, "visitor", `${st.name} requested a visit from ${v.visitorName}`, st.propertyId, STAFF_LINK);
    await notifyStaffUsers(tx, st.propertyId, "Visitor request", `${v.visitorName} for ${st.name} on ${short(input.visitDate)}`, "visitor", STAFF_LINK);
    return v;
  });
  return serialize(created);
}

// A visitor who arrives without a request: logged by staff and checked in at once.
export async function createWalkIn(auth, actorName, input) {
  requireRole(auth, "owner", "manager");

  const e = visitErrors(input);
  const st = await prisma.studentProfile.findUnique({ where: { id: input.studentId }, select: { id: true, name: true, propertyId: true, status: true } });
  // Another property's or another business's resident is reported the same way as an unknown id.
  const visible = st && RESIDENT.includes(st.status) && (await assertPropertyAccess(auth, st.propertyId).then(() => true, () => false));
  if (!visible) e.studentId = "Choose a resident of this property";
  if (Object.keys(e).length) throw invalid(e);

  const created = await prisma.$transaction(async (tx) => {
    const v = await tx.visitorRequest.create({
      data: {
        ...visitorData(input), studentId: st.id, propertyId: st.propertyId, source: "walk_in",
        visitDate: day(todayISO()), purpose: input.purpose || "Walk-in visit", status: "checked_in", checkInAt: new Date(),
      },
    });
    await logActivity(tx, auth, actorName, "visitor", `Checked in walk-in visitor ${v.visitorName} for ${st.name}`, st.propertyId, STAFF_LINK);
    await notifyStudentUsers(tx, st.id, "Visitor at reception", `${v.visitorName} has checked in to see you.`, "visitor", STUDENT_LINK);
    return v;
  });
  return serialize(created);
}

export async function decide(auth, actorName, id, decision, reason) {
  requireRole(auth, "owner", "manager");
  await loadVisible(auth, id);
  if (decision === "rejected" && !reason) throw invalid({ reason: "Give a reason for rejecting" });

  const updated = await prisma.$transaction(async (tx) => {
    await lockIn(tx, id, ["pending"], "Only pending requests can be decided.");
    const v = await tx.visitorRequest.update({
      where: { id },
      data: { status: decision, decisionReason: reason || null, decidedBy: actorName, decidedAt: new Date() },
    });
    await logActivity(tx, auth, actorName, "visitor", `${decision === "approved" ? "Approved" : "Rejected"} visit of ${v.visitorName}`, v.propertyId, STAFF_LINK);
    await notifyStudentUsers(tx, v.studentId, `Visitor ${decision}`, `${v.visitorName} on ${short(iso(v.visitDate))}${reason ? `: ${reason}` : ""}`, "visitor", STUDENT_LINK);
    return v;
  });
  return serialize(updated);
}

export async function checkIn(auth, actorName, id) {
  requireRole(auth, "owner", "manager");
  await loadVisible(auth, id);

  const updated = await prisma.$transaction(async (tx) => {
    const current = await lockIn(tx, id, ["approved"], "Only approved visitors can be checked in.");
    if (iso(current.visitDate) !== todayISO()) throw conflict(`Check-in is only open on the visit date (${short(iso(current.visitDate))}).`);
    const v = await tx.visitorRequest.update({ where: { id }, data: { status: "checked_in", checkInAt: new Date() } });
    await logActivity(tx, auth, actorName, "visitor", `Checked in ${v.visitorName}`, v.propertyId, STAFF_LINK);
    await notifyStudentUsers(tx, v.studentId, "Visitor checked in", `${v.visitorName} is at reception.`, "visitor", STUDENT_LINK);
    return v;
  });
  return serialize(updated);
}

export async function checkOut(auth, actorName, id) {
  requireRole(auth, "owner", "manager");
  await loadVisible(auth, id);

  const updated = await prisma.$transaction(async (tx) => {
    await lockIn(tx, id, ["checked_in"], "This visitor is not checked in.");
    const v = await tx.visitorRequest.update({ where: { id }, data: { status: "checked_out", checkOutAt: new Date() } });
    await logActivity(tx, auth, actorName, "visitor", `Checked out ${v.visitorName}`, v.propertyId, STAFF_LINK);
    return v;
  });
  return serialize(updated);
}

export async function cancel(auth, actorName, id) {
  requireRole(auth, "student");
  await loadVisible(auth, id);

  const updated = await prisma.$transaction(async (tx) => {
    await lockIn(tx, id, ["pending", "approved"], "This visit can no longer be cancelled.");
    const v = await tx.visitorRequest.update({ where: { id }, data: { status: "cancelled" } });
    await logActivity(tx, auth, actorName, "visitor", `${actorName} cancelled the visit of ${v.visitorName}`, v.propertyId, STAFF_LINK);
    return v;
  });
  return serialize(updated);
}
