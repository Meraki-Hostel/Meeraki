import { prisma } from "../../config/prisma.js";
import { invalid, notFound, forbidden, conflict } from "../../utils/ApiError.js";
import { requireRole, assertPropertyAccess, propertyScope } from "../../utils/scope.js";
import { iso, todayISO } from "../../utils/money.js";
import { isIndianPhone, normalizePhone } from "../../utils/validators.js";
import { logActivity, notifyStudentUsers, notifyStaffUsers } from "../../utils/sideEffects.js";

const day = (d) => new Date(`${d}T00:00:00.000Z`);
const addDays = (d, n) => new Date(day(d).getTime() + n * 864e5).toISOString().slice(0, 10);
const VISITING_HOURS = ["08:00", "19:00"];
const MAX_DAYS_AHEAD = 30;

export async function toViews(rows) {
  const ids = (k) => [...new Set(rows.map((r) => r[k]))];
  const [students, props] = await Promise.all([
    prisma.studentProfile.findMany({ where: { id: { in: ids("studentId") } }, select: { id: true, name: true, roomId: true } }),
    prisma.property.findMany({ where: { id: { in: ids("propertyId") } }, select: { id: true, name: true } }),
  ]);
  const roomIds = [...new Set(students.map((s) => s.roomId).filter(Boolean))];
  const rooms = roomIds.length ? await prisma.room.findMany({ where: { id: { in: roomIds } }, select: { id: true, number: true } }) : [];
  const sBy = new Map(students.map((s) => [s.id, s]));
  const pN = new Map(props.map((p) => [p.id, p.name]));
  const rN = new Map(rooms.map((r) => [r.id, r.number]));
  return rows.map((v) => {
    const st = sBy.get(v.studentId);
    return {
      id: v.id, studentId: v.studentId, propertyId: v.propertyId, source: v.source, visitorName: v.visitorName,
      visitorPhone: v.visitorPhone, relation: v.relation, visitDate: iso(v.visitDate), visitTime: v.visitTime, purpose: v.purpose,
      status: v.status, decisionReason: v.decisionReason ?? undefined, checkInAt: v.checkInAt?.toISOString(),
      checkOutAt: v.checkOutAt?.toISOString(), createdAt: v.createdAt.toISOString(),
      studentName: st?.name ?? "Unknown", roomNumber: st?.roomId ? rN.get(st.roomId) : undefined, propertyName: pN.get(v.propertyId) ?? "—",
    };
  });
}
const one = async (id) => (await toViews([await prisma.visitorRequest.findUnique({ where: { id } })]))[0];

function check(input, { allowPast = false } = {}) {
  const e = {};
  if (input.visitorName.trim().length < 2) e.visitorName = "Enter the visitor's name";
  if (!isIndianPhone(input.visitorPhone)) e.visitorPhone = "Enter a 10-digit Indian mobile number";
  if (input.relation.trim().length < 2) e.relation = "How do you know the visitor?";
  if (!allowPast && input.visitDate < todayISO()) e.visitDate = "Visit date cannot be in the past";
  else if (!allowPast && input.visitDate > addDays(todayISO(), MAX_DAYS_AHEAD)) e.visitDate = `Visits can be booked up to ${MAX_DAYS_AHEAD} days ahead`;
  if (input.visitTime < VISITING_HOURS[0] || input.visitTime > VISITING_HOURS[1]) e.visitTime = "Visiting hours are 8 am to 7 pm";
  if (Object.keys(e).length) throw invalid(e);
}
const fields = (input) => ({
  visitorName: input.visitorName.trim(), visitorPhone: normalizePhone(input.visitorPhone), relation: input.relation.trim(),
  visitDate: day(input.visitDate), visitTime: input.visitTime, purpose: input.purpose.trim(),
});

export async function list(auth, filters = {}) {
  const where = auth.role === "student" ? { studentId: auth.studentId } : await propertyScope(auth, filters.propertyId);
  if (filters.status) where.status = filters.status;
  if (filters.date) where.visitDate = day(filters.date);
  return toViews(await prisma.visitorRequest.findMany({ where, orderBy: [{ visitDate: "desc" }, { visitTime: "desc" }] }));
}

export async function create(auth, actorName, input) {
  requireRole(auth, "student");
  const s = await prisma.studentProfile.findUnique({ where: { id: auth.studentId } });
  if (!s || !["active", "notice"].includes(s.status)) throw conflict("Only current residents can register visitors.");
  check(input);
  const id = await prisma.$transaction(async (tx) => {
    const v = await tx.visitorRequest.create({ data: { studentId: s.id, propertyId: s.propertyId, source: "request", createdBy: actorName, ...fields(input) } });
    await logActivity(tx, auth, actorName, "visitor", `${s.name} registered visitor ${v.visitorName} (${v.relation}) for ${input.visitDate}`, s.propertyId, "/manager/visitors");
    await notifyStaffUsers(tx, s.propertyId, "Visitor request", `${s.name}: ${v.visitorName} on ${input.visitDate} at ${v.visitTime}`, "visitor", "/manager/visitors");
    return v.id;
  });
  return one(id);
}

/** A visitor at the gate without a prior request: logged and checked in at once. */
export async function createWalkIn(auth, actorName, input) {
  requireRole(auth, "owner", "manager");
  const s = await prisma.studentProfile.findUnique({ where: { id: input.studentId } });
  if (!s) throw notFound("Student");
  await assertPropertyAccess(auth, s.propertyId);
  if (!["active", "notice"].includes(s.status)) throw conflict("This person is not a current resident.");
  input = { ...input, visitDate: todayISO() }; // a walk-in is always today, whatever date was sent
  check(input, { allowPast: true });
  const id = await prisma.$transaction(async (tx) => {
    const v = await tx.visitorRequest.create({
      data: { studentId: s.id, propertyId: s.propertyId, source: "walk_in", status: "checked_in", checkInAt: new Date(), decidedBy: actorName, createdBy: actorName, ...fields(input) },
    });
    await logActivity(tx, auth, actorName, "visitor", `Walk-in visitor ${v.visitorName} checked in for ${s.name}`, s.propertyId, "/manager/visitors");
    await notifyStudentUsers(tx, s.id, "Visitor at the gate", `${v.visitorName} (${v.relation}) has checked in to see you.`, "visitor", "/student/visitors");
    return v.id;
  });
  return one(id);
}

async function loadForStaff(auth, id) {
  requireRole(auth, "owner", "manager");
  const v = await prisma.visitorRequest.findUnique({ where: { id } });
  if (!v) throw notFound("Visitor");
  await assertPropertyAccess(auth, v.propertyId);
  return v;
}

/** Guarded transition: applies only if the visit is still in one of `from`. */
async function move(auth, actorName, v, from, data, message, notify) {
  await prisma.$transaction(async (tx) => {
    const { count } = await tx.visitorRequest.updateMany({ where: { id: v.id, status: { in: from } }, data });
    if (!count) throw conflict(`This visit is ${v.status.replace("_", " ")} and cannot be changed that way.`);
    await logActivity(tx, auth, actorName, "visitor", message, v.propertyId, "/manager/visitors");
    if (notify) await notifyStudentUsers(tx, v.studentId, notify[0], notify[1], "visitor", "/student/visitors");
  });
  return one(v.id);
}

export async function decide(auth, actorName, id, { decision, reason }) {
  const v = await loadForStaff(auth, id);
  if (decision === "rejected" && !reason?.trim()) throw invalid({ reason: "Give a reason for rejecting" });
  return move(auth, actorName, v, ["pending"], { status: decision, decisionReason: reason?.trim() || null, decidedBy: actorName },
    `Visitor ${v.visitorName} ${decision}`,
    decision === "approved"
      ? ["Visitor approved", `${v.visitorName} can visit on ${iso(v.visitDate)} at ${v.visitTime}.`]
      : ["Visitor request rejected", `${v.visitorName}'s visit was not approved: ${reason.trim()}`]);
}

export async function checkIn(auth, actorName, id) {
  const v = await loadForStaff(auth, id);
  if (v.status === "approved" && iso(v.visitDate) !== todayISO()) throw conflict(`This visit is booked for ${iso(v.visitDate)}. Check-in opens on that day.`);
  return move(auth, actorName, v, ["approved"], { status: "checked_in", checkInAt: new Date() }, `Visitor ${v.visitorName} checked in`,
    ["Visitor checked in", `${v.visitorName} has arrived to see you.`]);
}

export async function checkOut(auth, actorName, id) {
  const v = await loadForStaff(auth, id);
  return move(auth, actorName, v, ["checked_in"], { status: "checked_out", checkOutAt: new Date() }, `Visitor ${v.visitorName} checked out`, null);
}

export async function cancel(auth, actorName, id) {
  const v = await prisma.visitorRequest.findUnique({ where: { id } });
  if (!v) throw notFound("Visitor");
  if (auth.role === "student") {
    if (v.studentId !== auth.studentId) throw forbidden();
  } else {
    await assertPropertyAccess(auth, v.propertyId);
  }
  return move(auth, actorName, v, ["pending", "approved"], { status: "cancelled" }, `Visit by ${v.visitorName} cancelled`,
    auth.role === "student" ? null : ["Visit cancelled", `The visit by ${v.visitorName} on ${iso(v.visitDate)} was cancelled by the office.`]);
}
