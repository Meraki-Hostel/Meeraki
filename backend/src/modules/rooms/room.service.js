import { prisma } from "../../config/prisma.js";
import { notFound, forbidden, conflict, invalid } from "../../utils/ApiError.js";
import { assertPropertyAccess, scopeProperty } from "../../utils/scope.js";

export async function list(auth, filters = {}) {
  const where = {};
  const pid = auth.role === "owner" ? filters.propertyId : auth.propertyId;
  if (pid) where.propertyId = pid;
  else if (auth.role !== "owner") where.propertyId = auth.propertyId;

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

export async function create(auth, input) {
  const propertyId = auth.role === "owner" ? input.propertyId : auth.propertyId;
  if (!propertyId) throw invalid({ propertyId: "Property is required" });
  assertPropertyAccess(auth, propertyId);
  return prisma.room.create({
    data: {
      propertyId, number: input.number, floor: input.floor, type: input.type, rent: input.rent,
      ac: !!input.ac, attachedBath: !!input.attachedBath, status: input.status ?? "active",
    },
  });
}

export async function update(auth, id, input) {
  const room = await prisma.room.findUnique({ where: { id } });
  if (!room) throw notFound("Room");
  assertPropertyAccess(auth, room.propertyId);
  const { propertyId, ...data } = input; // never move a room across properties here
  return prisma.room.update({ where: { id }, data });
}

export async function setBedStatus(auth, bedId, status, reason) {
  const bed = await prisma.bed.findUnique({ where: { id: bedId } });
  if (!bed) throw notFound("Bed");
  assertPropertyAccess(auth, bed.propertyId);
  if (bed.status === "occupied") throw conflict("Vacate the resident before changing this bed's status.");
  return prisma.bed.update({
    where: { id: bedId },
    data: { status, unavailableReason: status === "unavailable" ? reason ?? null : null },
  });
}

export async function assignBed(auth, studentId, bedId) {
  await prisma.$transaction(async (tx) => {
    const student = await tx.studentProfile.findUnique({ where: { id: studentId } });
    if (!student) throw notFound("Student");
    assertPropertyAccess(auth, student.propertyId);

    const bed = await tx.bed.findUnique({ where: { id: bedId } });
    if (!bed) throw notFound("Bed");
    assertPropertyAccess(auth, bed.propertyId);
    if (bed.propertyId !== student.propertyId) throw conflict("Bed and student belong to different properties.");
    if (bed.status !== "available") throw conflict("That bed is not available.");

    // Free the student's current bed if they have one (move/transfer).
    if (student.bedId && student.bedId !== bedId) {
      await tx.bed.update({ where: { id: student.bedId }, data: { status: "available", studentId: null } });
    }
    await tx.bed.update({ where: { id: bedId }, data: { status: "occupied", studentId } });
    await tx.studentProfile.update({
      where: { id: studentId },
      data: { bedId, roomId: bed.roomId, status: student.status === "pending" ? "active" : student.status },
    });
  });
}

export async function vacateBed(auth, studentId) {
  await prisma.$transaction(async (tx) => {
    const student = await tx.studentProfile.findUnique({ where: { id: studentId } });
    if (!student) throw notFound("Student");
    assertPropertyAccess(auth, student.propertyId);
    if (student.bedId) {
      await tx.bed.update({ where: { id: student.bedId }, data: { status: "available", studentId: null } });
    }
    await tx.studentProfile.update({ where: { id: studentId }, data: { bedId: null, roomId: null } });
  });
}
