import { prisma } from "../../config/prisma.js";
import { notFound, conflict, invalid } from "../../utils/ApiError.js";
import { assertPropertyAccess, propertyScope, requireRole } from "../../utils/scope.js";
import { currentPeriod } from "../../utils/money.js";
import { assertWithinPlan } from "../settings/settings.service.js";
import { generateRent } from "../payments/charge.service.js";

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

export async function create(auth, input) {
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
    return room;
  });
}

export async function update(auth, id, input) {
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
    return tx.room.update({ where: { id }, data });
  });
}

export async function setBedStatus(auth, bedId, status, reason) {
  requireRole(auth, "owner", "manager");
  const bed = await prisma.bed.findUnique({ where: { id: bedId } });
  if (!bed) throw notFound("Bed");
  await assertPropertyAccess(auth, bed.propertyId);
  if (bed.status === "occupied") throw conflict("Vacate the resident before changing this bed's status.");
  const { count } = await prisma.bed.updateMany({
    where: { id: bedId, studentId: null },
    data: { status, unavailableReason: status === "unavailable" ? reason ?? null : null },
  });
  if (!count) throw conflict("Vacate the resident before changing this bed's status.");
  return prisma.bed.findUnique({ where: { id: bedId } });
}

export async function assignBed(auth, studentId, bedId) {
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
    if (student.bedId) {
      await tx.bed.update({ where: { id: student.bedId }, data: { status: "available", studentId: null } });
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
    return student.status === "pending" ? student.propertyId : null;
  });
  // A waitlisted resident who just got a bed starts paying this month (pro-rated).
  // The bed assignment already committed; a failure here must not look like it didn't.
  if (activated) {
    try { await generateRent({ period: currentPeriod(), orgId: auth.orgId, propertyId: activated }); }
    catch (err) { console.error("generateRent after bed assignment failed:", err.message); }
  }
}

export async function vacateBed(auth, studentId) {
  requireRole(auth, "owner", "manager");
  await prisma.$transaction(async (tx) => {
    const student = await tx.studentProfile.findUnique({ where: { id: studentId } });
    if (!student) throw notFound("Student");
    await assertPropertyAccess(auth, student.propertyId);
    if (student.bedId) {
      await tx.bed.update({ where: { id: student.bedId }, data: { status: "available", studentId: null } });
    }
    await tx.studentProfile.update({ where: { id: studentId }, data: { bedId: null, roomId: null } });
  });
}
