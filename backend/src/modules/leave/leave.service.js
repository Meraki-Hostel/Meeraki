import { prisma } from "../../config/prisma.js";
import { invalid, notFound, forbidden, conflict } from "../../utils/ApiError.js";
import { requireRole, assertPropertyAccess, propertyScope } from "../../utils/scope.js";
import { iso, todayISO } from "../../utils/money.js";
import { isIndianPhone, normalizePhone } from "../../utils/validators.js";
import { logActivity, notifyStudentUsers, notifyStaffUsers, notifyUsers } from "../../utils/sideEffects.js";
import { settingsFor } from "../settings/settings.service.js";

const day = (d) => new Date(`${d}T00:00:00.000Z`);

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
  return rows.map((l) => {
    const st = sBy.get(l.studentId);
    return {
      id: l.id, studentId: l.studentId, propertyId: l.propertyId, from: iso(l.fromDate), to: iso(l.toDate),
      destination: l.destination, contactPhone: l.contactPhone, reason: l.reason, status: l.status,
      decisionReason: l.decisionReason ?? undefined, decidedBy: l.decidedBy ?? undefined,
      decidedAt: l.decidedAt?.toISOString(), createdAt: l.createdAt.toISOString(),
      studentName: st?.name ?? "Unknown", roomNumber: st?.roomId ? rN.get(st.roomId) : undefined, propertyName: pN.get(l.propertyId) ?? "—",
    };
  });
}
const one = async (id) => (await toViews([await prisma.leaveRequest.findUnique({ where: { id } })]))[0];

export async function list(auth, filters = {}) {
  const where = auth.role === "student" ? { studentId: auth.studentId } : await propertyScope(auth, filters.propertyId);
  if (filters.status) where.status = filters.status;
  return toViews(await prisma.leaveRequest.findMany({ where, orderBy: [{ fromDate: "desc" }, { createdAt: "desc" }] }));
}

export async function create(auth, actorName, input) {
  requireRole(auth, "student");
  const s = await prisma.studentProfile.findUnique({ where: { id: auth.studentId } });
  if (!s || !["active", "notice"].includes(s.status)) throw conflict("Only current residents can request leave.");
  const e = {};
  const today = todayISO();
  if (input.from < today) e.from = "Leave cannot start in the past";
  if (input.to < input.from) e.to = "Return date must be on or after the start date";
  if (!isIndianPhone(input.contactPhone)) e.contactPhone = "Enter a 10-digit Indian mobile number";
  if (input.destination.trim().length < 2) e.destination = "Where are you going?";
  if (input.reason.trim().length < 3) e.reason = "Give a reason";
  if (Object.keys(e).length) throw invalid(e);

  const id = await prisma.$transaction(async (tx) => {
    // Serialise this student's requests so two overlapping ones cannot both pass.
    await tx.$queryRaw`SELECT "id" FROM "StudentProfile" WHERE "id" = ${s.id} FOR UPDATE`;
    const overlap = await tx.leaveRequest.findFirst({
      where: { studentId: s.id, status: { in: ["pending", "approved"] }, fromDate: { lte: day(input.to) }, toDate: { gte: day(input.from) } },
    });
    if (overlap) throw conflict("You already have leave for some of these dates.");
    const l = await tx.leaveRequest.create({
      data: {
        studentId: s.id, propertyId: s.propertyId, fromDate: day(input.from), toDate: day(input.to),
        destination: input.destination.trim(), contactPhone: normalizePhone(input.contactPhone), reason: input.reason.trim(),
      },
    });
    await logActivity(tx, auth, actorName, "leave", `${s.name} requested leave ${input.from} to ${input.to} (${l.destination})`, s.propertyId, "/manager/leave");
    await notifyStaffUsers(tx, s.propertyId, "Leave request", `${s.name}: ${input.from} to ${input.to}, ${l.destination}`, "leave", "/manager/leave");
    if ((await settingsFor(auth.orgId, tx)).notifications.leaveRequests) {
      const owners = await tx.user.findMany({ where: { orgId: auth.orgId, role: "owner", disabledAt: null }, select: { id: true } });
      await notifyUsers(tx, owners.map((o) => o.id), "Leave request", `${s.name}: ${input.from} to ${input.to}`, "leave", "/owner/overview");
    }
    return l.id;
  });
  return one(id);
}

export async function decide(auth, actorName, id, { decision, reason }) {
  requireRole(auth, "owner", "manager");
  const l = await prisma.leaveRequest.findUnique({ where: { id } });
  if (!l) throw notFound("Leave request");
  await assertPropertyAccess(auth, l.propertyId);
  if (decision === "rejected" && !reason?.trim()) throw invalid({ reason: "Give a reason for rejecting" });
  await prisma.$transaction(async (tx) => {
    const { count } = await tx.leaveRequest.updateMany({
      where: { id, status: "pending" },
      data: { status: decision, decisionReason: reason?.trim() || null, decidedBy: actorName, decidedAt: new Date() },
    });
    if (!count) throw conflict("This request has already been decided or cancelled.");
    const st = await tx.studentProfile.findUnique({ where: { id: l.studentId }, select: { name: true } });
    await logActivity(tx, auth, actorName, "leave", `Leave of ${st.name} ${decision}`, l.propertyId, "/manager/leave");
    await notifyStudentUsers(tx, l.studentId, decision === "approved" ? "Leave approved" : "Leave rejected",
      decision === "approved" ? `Your leave from ${iso(l.fromDate)} to ${iso(l.toDate)} is approved.` : `Your leave request was rejected: ${reason.trim()}`,
      "leave", "/student/leave");
  });
  return one(id);
}

export async function cancel(auth, actorName, id) {
  requireRole(auth, "student");
  const l = await prisma.leaveRequest.findUnique({ where: { id } });
  if (!l) throw notFound("Leave request");
  if (l.studentId !== auth.studentId) throw forbidden();
  const today = day(todayISO());
  await prisma.$transaction(async (tx) => {
    // Pending any time; approved only before the leave starts.
    const { count } = await tx.leaveRequest.updateMany({
      where: { id, OR: [{ status: "pending" }, { status: "approved", fromDate: { gt: today } }] },
      data: { status: "cancelled" },
    });
    if (!count) throw conflict("This leave can no longer be cancelled.");
    await logActivity(tx, auth, actorName, "leave", `${actorName} cancelled leave ${iso(l.fromDate)} to ${iso(l.toDate)}`, l.propertyId, "/manager/leave");
    if (l.status === "approved") await notifyStaffUsers(tx, l.propertyId, "Leave cancelled", `${actorName} cancelled approved leave from ${iso(l.fromDate)}.`, "leave", "/manager/leave");
  });
  return one(id);
}
