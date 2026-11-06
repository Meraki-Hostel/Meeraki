import { prisma } from "../../config/prisma.js";
import { notFound, conflict, invalid } from "../../utils/ApiError.js";
import { assertPropertyAccess, propertyScope, requireRole } from "../../utils/scope.js";
import { currentPeriod } from "../../utils/money.js";
import { assertWithinPlan } from "../settings/settings.service.js";
import { generateRent } from "../payments/charge.service.js";
import { logActivity, notifyStudentUsers } from "../../utils/sideEffects.js";

const bedName = async (tx, bed) => {
  const room = await tx.room.findUnique({ where: { id: bed.roomId }, select: { number: true } });
  return `${room.number}-${bed.label}`;
};

export async function list(auth, filters = {}) {
  const where = await propertyScope(auth, filters.propertyId);

  const rooms = await prisma.room.findMany({
    where,
    include: { beds: true, property: { select: { name: true } } },
    orderBy: [{ floor: "asc" }, { number: "asc" }],
  });
  const studentIds = rooms.flatMap((r) => r.beds.map((b) => b.studentId).filter(Boolean));
  const students = await prisma.studentProfile.findMany({
    where: { id: { in: studentIds } }, select: { id: true, name: true, studentCode: true },
  });
  const sById = new Map(students.map((s) => [s.id, s]));

  return rooms.map((r) => ({
    id: r.id, propertyId: r.propertyId, number: r.number, floor: r.floor, type: r.type,
    rent: r.rent, ac: r.ac, attachedBath: r.attachedBath, status: r.status,
    propertyName: r.property.name,
    beds: r.beds
      .sort((a, b) => a.label.localeCompare(b.label))
      .map((b) => {
        const st = b.studentId ? sById.get(b.studentId) : undefined;
        return {
          id: b.id, roomId: b.roomId, propertyId: b.propertyId, label: b.label, status: b.status,
          studentId: b.studentId ?? undefined, unavailableReason: b.unavailableReason ?? undefined,
          studentName: st?.name, studentCode: st?.studentCode,
        };
      }),
  }));
}

// Beds per room type (same rule as the frontend mock). Labels run A, B, C, D.
export const BEDS_PER_TYPE = { single: 1, double: 2, triple: 3, quad: 4 };
const LABELS = ["A", "B", "C", "D"];

export async function create(auth, input, actorName = "Staff") {
  requireRole(auth, "owner", "manager");
  const propertyId = auth.role === "owner" ? input.propertyId : auth.propertyId;
  if (!propertyId) throw invalid({ propertyId: "Property is required" });
  await assertPropertyAccess(auth, propertyId);
  // Room and its beds are one unit: either both exist or neither does.
  return prisma.$transaction(async (tx) => {
    await assertWithinPlan(tx, auth.orgId, { beds: BEDS_PER_TYPE[input.type] });
    const room = await tx.room.create({
      data: {
        propertyId, number: input.number, floor: input.floor, type: input.type, rent: input.rent,
        ac: !!input.ac, attachedBath: !!input.attachedBath, status: input.status ?? "active",
      },
    });
    await tx.bed.createMany({
      data: LABELS.slice(0, BEDS_PER_TYPE[room.type]).map((label) => ({ roomId: room.id, propertyId, label })),
    });
    await logActivity(tx, auth, actorName, "room", `Room ${room.number} added (${room.type}, ${BEDS_PER_TYPE[room.type]} bed${BEDS_PER_TYPE[room.type] > 1 ? "s" : ""})`, propertyId, "/manager/rooms");
    return room;
  });
}

export async function update(auth, id, input, actorName = "Staff") {
  requireRole(auth, "owner", "manager");
  const room = await prisma.room.findUnique({ where: { id } });
  if (!room) throw notFound("Room");
  await assertPropertyAccess(auth, room.propertyId);
  const { propertyId, ...data } = input; // never move a room across properties here

  return prisma.$transaction(async (tx) => {
    if (data.type && data.type !== room.type) {
      const target = BEDS_PER_TYPE[data.type];
      const beds = await tx.bed.findMany({ where: { roomId: id }, orderBy: { label: "asc" } });
      const extra = beds.slice(target);
      if (extra.some((b) => b.status === "occupied")) {
        throw invalid({ type: "Move residents out of the extra beds before reducing capacity" });
      }
      if (extra.length) {
        // Only delete beds that are still unoccupied at delete time.
        const { count } = await tx.bed.deleteMany({ where: { id: { in: extra.map((b) => b.id) }, studentId: null } });
        if (count !== extra.length) throw conflict("A resident was just assigned to one of the extra beds. Try again.");
      }
      const missing = LABELS.slice(beds.length, target);
      if (missing.length) {
        await assertWithinPlan(tx, auth.orgId, { beds: missing.length });
        await tx.bed.createMany({ data: missing.map((label) => ({ roomId: id, propertyId: room.propertyId, label })) });
      }
    }
    const updated = await tx.room.update({ where: { id }, data });
    const typeNote = data.type && data.type !== room.type ? ` (now ${data.type})` : "";
    await logActivity(tx, auth, actorName, "room", `Room ${updated.number} updated${typeNote}`, room.propertyId, "/manager/rooms");
    return updated;
  });
}

export async function setBedStatus(auth, bedId, status, reason, actorName = "Staff") {
  requireRole(auth, "owner", "manager");
  const bed = await prisma.bed.findUnique({ where: { id: bedId } });
  if (!bed) throw notFound("Bed");
  await assertPropertyAccess(auth, bed.propertyId);
  if (bed.status === "occupied") throw conflict("Vacate the resident before changing this bed's status.");
  return prisma.$transaction(async (tx) => {
    const { count } = await tx.bed.updateMany({
      where: { id: bedId, studentId: null },
      data: { status, unavailableReason: status === "unavailable" ? reason ?? null : null },
    });
    if (!count) throw conflict("Vacate the resident before changing this bed's status.");
    if (status !== bed.status) {
      const why = status === "unavailable" && reason ? `: ${reason}` : "";
      await logActivity(tx, auth, actorName, "room", `Bed ${await bedName(tx, bed)} marked ${status}${why}`, bed.propertyId, "/manager/rooms");
    }
    return tx.bed.findUnique({ where: { id: bedId } });
  });
}

export async function assignBed(auth, studentId, bedId, actorName = "Staff") {
  requireRole(auth, "owner", "manager");
  const activated = await prisma.$transaction(async (tx) => {
    const student = await tx.studentProfile.findUnique({ where: { id: studentId } });
    if (!student) throw notFound("Student");
    await assertPropertyAccess(auth, student.propertyId);

    const bed = await tx.bed.findUnique({ where: { id: bedId } });
    if (!bed) throw notFound("Bed");
    await assertPropertyAccess(auth, bed.propertyId);
    if (bed.propertyId !== student.propertyId) throw conflict("Bed and student belong to different properties.");
    if (student.status === "moved_out") throw conflict("This resident has moved out. Change their status before assigning a bed.");
    if (student.bedId === bedId) return null;

    // Free the student's current bed if they have one (move/transfer).
    let from = null;
    if (student.bedId) {
      const old = await tx.bed.update({ where: { id: student.bedId }, data: { status: "available", studentId: null } });
      from = await bedName(tx, old);
    }
    // Claim the bed only if it is still free at write time (no lost update under concurrency).
    const { count } = await tx.bed.updateMany({
      where: { id: bedId, status: "available", studentId: null },
      data: { status: "occupied", studentId },
    });
    if (!count) throw conflict("That bed is not available.");
    await tx.studentProfile.update({
      where: { id: studentId },
      data: { bedId, roomId: bed.roomId, status: student.status === "pending" ? "active" : student.status },
    });
    const to = await bedName(tx, bed);
    await logActivity(tx, auth, actorName, "room",
      from ? `${student.name} moved from bed ${from} to ${to}` : `${student.name} assigned to bed ${to}`,
      student.propertyId, `/manager/students/${studentId}`);
    await notifyStudentUsers(tx, studentId, from ? "Your bed has changed" : "Bed assigned",
      from ? `You've been moved from bed ${from} to ${to}.` : `You've been given bed ${to}.`, "system", "/student/home");
    return student.status === "pending" ? student.propertyId : null;
  });
  // A waitlisted resident who just got a bed starts paying this month (pro-rated).
  if (activated) await generateRent({ period: currentPeriod(), orgId: auth.orgId, propertyId: activated });
}

export async function vacateBed(auth, studentId, actorName = "Staff") {
  requireRole(auth, "owner", "manager");
  await prisma.$transaction(async (tx) => {
    const student = await tx.studentProfile.findUnique({ where: { id: studentId } });
    if (!student) throw notFound("Student");
    await assertPropertyAccess(auth, student.propertyId);
    if (student.bedId) {
      const old = await tx.bed.update({ where: { id: student.bedId }, data: { status: "available", studentId: null } });
      const name = await bedName(tx, old);
      await logActivity(tx, auth, actorName, "room", `${student.name} vacated bed ${name}`, student.propertyId, `/manager/students/${studentId}`);
      await notifyStudentUsers(tx, studentId, "Bed released", `Bed ${name} is no longer assigned to you.`, "system", "/student/home");
    }
    await tx.studentProfile.update({ where: { id: studentId }, data: { bedId: null, roomId: null } });
  });
}
