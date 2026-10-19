import { prisma } from "../../config/prisma.js";
import { notFound, forbidden, invalid } from "../../utils/ApiError.js";
import { requireRole, assertPropertyAccess, scopeProperty } from "../../utils/scope.js";
import { withBalance, iso, todayISO } from "../../utils/money.js";

function serialize(s) {
  return { ...s, dob: iso(s.dob), joinedOn: iso(s.joinedOn) };
}

async function toListItem(s, maps) {
  const { pById, rById, balanceByStudent } = maps;
  const bedLabel = s.bedId ? (await prisma.bed.findUnique({ where: { id: s.bedId }, select: { label: true } }))?.label : undefined;
  return {
    ...serialize(s),
    propertyName: pById.get(s.propertyId) ?? "—",
    roomNumber: s.roomId ? rById.get(s.roomId) : undefined,
    bedLabel,
    balance: balanceByStudent.get(s.id) ?? 0,
  };
}

async function balanceMap(studentIds) {
  const charges = await prisma.rentCharge.findMany({ where: { studentId: { in: studentIds } } });
  const payments = await prisma.payment.findMany({
    where: { studentId: { in: studentIds } }, select: { chargeId: true, amount: true, studentId: true },
  });
  const today = todayISO();
  const m = new Map();
  for (const c of charges) {
    const wb = withBalance(c, payments, today);
    m.set(c.studentId, (m.get(c.studentId) ?? 0) + wb.balance);
  }
  return m;
}

export async function list(auth, filters = {}) {
  const where = {};
  if (auth.role === "student") where.id = auth.studentId;
  else {
    const pid = scopeProperty(auth, filters.propertyId);
    if (pid) where.propertyId = pid;
  }
  if (filters.status) where.status = filters.status;
  if (filters.search) where.OR = [
    { name: { contains: filters.search, mode: "insensitive" } },
    { studentCode: { contains: filters.search, mode: "insensitive" } },
    { phone: { contains: filters.search } },
  ];

  const students = await prisma.studentProfile.findMany({ where, orderBy: { name: "asc" } });
  const [properties, rooms, balances] = await Promise.all([
    prisma.property.findMany({ select: { id: true, name: true } }),
    prisma.room.findMany({ select: { id: true, number: true } }),
    balanceMap(students.map((s) => s.id)),
  ]);
  const maps = {
    pById: new Map(properties.map((p) => [p.id, p.name])),
    rById: new Map(rooms.map((r) => [r.id, r.number])),
    balanceByStudent: balances,
  };
  return Promise.all(students.map((s) => toListItem(s, maps)));
}

async function detail(auth, id) {
  const s = await prisma.studentProfile.findUnique({ where: { id } });
  if (!s) throw notFound("Student");
  if (auth.role === "student" && auth.studentId !== id) throw forbidden();
  if (auth.role !== "student") assertPropertyAccess(auth, s.propertyId);

  const [properties, rooms, balances, chargesRaw, paymentsRaw] = await Promise.all([
    prisma.property.findMany({ select: { id: true, name: true } }),
    prisma.room.findMany({ select: { id: true, number: true } }),
    balanceMap([id]),
    prisma.rentCharge.findMany({ where: { studentId: id } }),
    prisma.payment.findMany({ where: { studentId: id } }),
  ]);
  const maps = {
    pById: new Map(properties.map((p) => [p.id, p.name])),
    rById: new Map(rooms.map((r) => [r.id, r.number])),
    balanceByStudent: balances,
  };
  const today = todayISO();
  const charges = chargesRaw
    .map((c) => ({ ...withBalance(c, paymentsRaw, today), dueDate: iso(c.dueDate) }))
    .sort((a, b) => b.period.localeCompare(a.period));
  const payments = paymentsRaw
    .map((p) => ({ ...p, paidOn: iso(p.paidOn) }))
    .sort((a, b) => b.paidOn.localeCompare(a.paidOn));

  return {
    student: await toListItem(s, maps),
    charges,
    payments,
    // Modules not yet implemented return empty lists (same shape the frontend expects).
    documents: [],
    complaints: [],
    leaves: [],
    visitors: [],
  };
}

export const get = (auth, id) => detail(auth, id);
export function me(auth) {
  requireRole(auth, "student");
  return detail(auth, auth.studentId);
}

export async function nextStudentCode() {
  const count = await prisma.studentProfile.count();
  return `MRK${String(count + 1).padStart(4, "0")}`;
}

export async function create(auth, input) {
  requireRole(auth, "owner", "manager");
  const propertyId = auth.role === "owner" ? input.propertyId ?? auth.propertyId : auth.propertyId;
  if (!propertyId) throw invalid({ propertyId: "Property is required" });
  assertPropertyAccess(auth, propertyId);

  const created = await prisma.$transaction(async (tx) => {
    const s = await tx.studentProfile.create({
      data: {
        studentCode: input.studentCode, name: input.name, email: input.email, phone: input.phone,
        gender: input.gender, dob: new Date(input.dob), college: input.college, course: input.course,
        year: input.year, propertyId, status: input.bedId ? "active" : "pending",
        joinedOn: new Date(input.joinedOn), monthlyRent: input.monthlyRent, address: input.address ?? "",
        bloodGroup: input.bloodGroup ?? "", guardianName: input.guardianName ?? "",
        guardianRelation: input.guardianRelation ?? "", guardianPhone: input.guardianPhone ?? "",
        emergencyName: input.emergencyName ?? "", emergencyPhone: input.emergencyPhone ?? "",
      },
    });
    if (input.bedId) {
      const bed = await tx.bed.findUnique({ where: { id: input.bedId } });
      if (!bed || bed.status !== "available" || bed.propertyId !== propertyId) {
        throw invalid({ bedId: "Selected bed is not available" });
      }
      await tx.bed.update({ where: { id: bed.id }, data: { status: "occupied", studentId: s.id } });
      await tx.studentProfile.update({ where: { id: s.id }, data: { bedId: bed.id, roomId: bed.roomId } });
    }
    return tx.studentProfile.findUnique({ where: { id: s.id } });
  });
  return serialize(created);
}

export async function update(auth, id, patch) {
  requireRole(auth, "owner", "manager");
  const s = await prisma.studentProfile.findUnique({ where: { id } });
  if (!s) throw notFound("Student");
  assertPropertyAccess(auth, s.propertyId);
  const { bedId, propertyId, dob, joinedOn, ...rest } = patch;
  const data = { ...rest };
  if (dob) data.dob = new Date(dob);
  if (joinedOn) data.joinedOn = new Date(joinedOn);
  const updated = await prisma.studentProfile.update({ where: { id }, data });
  return serialize(updated);
}

export async function setStatus(auth, id, status) {
  requireRole(auth, "owner", "manager");
  const s = await prisma.studentProfile.findUnique({ where: { id } });
  if (!s) throw notFound("Student");
  assertPropertyAccess(auth, s.propertyId);
  const updated = await prisma.studentProfile.update({ where: { id }, data: { status } });
  return serialize(updated);
}

export async function updateSelf(auth, patch) {
  requireRole(auth, "student");
  const allowed = (({ email, phone, address, emergencyName, emergencyPhone, bloodGroup }) =>
    ({ email, phone, address, emergencyName, emergencyPhone, bloodGroup }))(patch);
  const updated = await prisma.studentProfile.update({ where: { id: auth.studentId }, data: allowed });
  return serialize(updated);
}
