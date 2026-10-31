import { prisma } from "../../config/prisma.js";
import { ApiError, notFound, forbidden, invalid } from "../../utils/ApiError.js";
import { isIndianPhone, normalizePhone } from "../../utils/validators.js";
import { requireRole, assertPropertyAccess, propertyScope } from "../../utils/scope.js";
import { withBalance, iso, todayISO, counted } from "../../utils/money.js";

function serialize(s) {
  return { ...s, dob: iso(s.dob), joinedOn: iso(s.joinedOn) };
}

function toListItem(s, maps) {
  const { pById, rById, bById, balanceByStudent } = maps;
  return {
    ...serialize(s),
    propertyName: pById.get(s.propertyId) ?? "—",
    roomNumber: s.roomId ? rById.get(s.roomId) : undefined,
    bedLabel: s.bedId ? bById.get(s.bedId) : undefined,
    balance: balanceByStudent.get(s.id) ?? 0,
  };
}

async function balanceMap(studentIds) {
  const charges = await prisma.rentCharge.findMany({ where: { studentId: { in: studentIds } } });
  const payments = await prisma.payment.findMany({
    where: { studentId: { in: studentIds }, ...counted }, select: { chargeId: true, amount: true, studentId: true },
  });
  const today = todayISO();
  const m = new Map();
  for (const c of charges) {
    const wb = withBalance(c, payments, today);
    m.set(c.studentId, (m.get(c.studentId) ?? 0) + wb.balance);
  }
  return m;
}

// Names for exactly the rows being returned (never a table-wide scan of every tenant).
async function lookupMaps(students) {
  const ids = (key) => [...new Set(students.map((s) => s[key]).filter(Boolean))];
  const [properties, rooms, beds, balances] = await Promise.all([
    prisma.property.findMany({ where: { id: { in: ids("propertyId") } }, select: { id: true, name: true } }),
    prisma.room.findMany({ where: { id: { in: ids("roomId") } }, select: { id: true, number: true } }),
    prisma.bed.findMany({ where: { id: { in: ids("bedId") } }, select: { id: true, label: true } }),
    balanceMap(students.map((s) => s.id)),
  ]);
  return {
    pById: new Map(properties.map((p) => [p.id, p.name])),
    rById: new Map(rooms.map((r) => [r.id, r.number])),
    bById: new Map(beds.map((b) => [b.id, b.label])),
    balanceByStudent: balances,
  };
}

export async function list(auth, filters = {}) {
  const where = auth.role === "student" ? { id: auth.studentId } : await propertyScope(auth, filters.propertyId);
  if (filters.status) where.status = filters.status;
  if (filters.search) where.OR = [
    { name: { contains: filters.search, mode: "insensitive" } },
    { studentCode: { contains: filters.search, mode: "insensitive" } },
    { phone: { contains: filters.search } },
  ];

  const students = await prisma.studentProfile.findMany({ where, orderBy: { name: "asc" } });
  const maps = await lookupMaps(students);
  return students.map((s) => toListItem(s, maps));
}

async function detail(auth, id) {
  const s = await prisma.studentProfile.findUnique({ where: { id } });
  if (!s) throw notFound("Student");
  if (auth.role === "student" && auth.studentId !== id) throw forbidden();
  if (auth.role !== "student") await assertPropertyAccess(auth, s.propertyId);

  const [maps, chargesRaw, paymentsRaw] = await Promise.all([
    lookupMaps([s]),
    prisma.rentCharge.findMany({ where: { studentId: id } }),
    prisma.payment.findMany({ where: { studentId: id, ...counted } }),
  ]);
  const today = todayISO();
  const charges = chargesRaw
    .map((c) => ({ ...withBalance(c, paymentsRaw, today), dueDate: iso(c.dueDate) }))
    .sort((a, b) => b.period.localeCompare(a.period));
  const payments = paymentsRaw
    .map((p) => ({ ...p, paidOn: iso(p.paidOn) }))
    .sort((a, b) => b.paidOn.localeCompare(a.paidOn));

  // Per-resident leave, visitor and document lists are not wired into this view yet
  // (documents have no backend module). They are omitted (not returned as []) so a
  // screen can show "not available" instead of "none".
  return { student: toListItem(s, maps), charges, payments };
}

export const get = (auth, id) => detail(auth, id);
export function me(auth) {
  requireRole(auth, "student");
  return detail(auth, auth.studentId);
}

const codeFor = (n) => `MRK${String(n).padStart(4, "0")}`;

// A suggestion for the admission form. It reserves nothing: the code is only
// guaranteed unique when the student is created.
export async function nextStudentCode() {
  const count = await prisma.studentProfile.count();
  return codeFor(count + 1);
}

// Atomic allocation inside the creating transaction: concurrent admissions can
// never be handed the same code, and a rollback gives the number back.
async function allocateStudentCode(tx) {
  for (;;) {
    const [{ value }] = await tx.$queryRaw`
      INSERT INTO "Counter" ("key", "value") VALUES ('studentCode', 1)
      ON CONFLICT ("key") DO UPDATE SET "value" = "Counter"."value" + 1
      RETURNING "value"`;
    const code = codeFor(Number(value));
    if (!(await tx.studentProfile.findUnique({ where: { studentCode: code }, select: { id: true } }))) return code;
  }
}

const codeTaken = () =>
  new ApiError("CONFLICT", "That student code is already in use.", { studentCode: "That student code is already in use." });

// A student's sign-in account mirrors their contact details; keep both in step.
async function syncLogin(tx, studentId, { email, phone }) {
  const data = {};
  if (email) {
    data.email = email.trim().toLowerCase();
    const clash = await tx.user.findFirst({
      where: { email: { equals: data.email, mode: "insensitive" }, NOT: { studentId } }, select: { id: true },
    });
    if (clash) throw new ApiError("CONFLICT", "That email is already used by another account.", { email: "That email is already used by another account." });
  }
  if (phone && isIndianPhone(phone)) data.phone = normalizePhone(phone);
  if (Object.keys(data).length) await tx.user.updateMany({ where: { studentId }, data });
}

export async function create(auth, input) {
  requireRole(auth, "owner", "manager");
  const propertyId = auth.role === "owner" ? input.propertyId ?? auth.propertyId : auth.propertyId;
  if (!propertyId) throw invalid({ propertyId: "Property is required" });
  await assertPropertyAccess(auth, propertyId);

  const requestedCode = input.studentCode?.trim();
  if (requestedCode && (await prisma.studentProfile.findUnique({ where: { studentCode: requestedCode }, select: { id: true } }))) {
    throw codeTaken();
  }

  const created = await prisma.$transaction(async (tx) => {
    const studentCode = requestedCode || (await allocateStudentCode(tx));
    const s = await tx.studentProfile.create({
      data: {
        studentCode, name: input.name, email: input.email, phone: input.phone,
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
      const { count } = bed && bed.propertyId === propertyId
        ? await tx.bed.updateMany({ where: { id: bed.id, status: "available", studentId: null }, data: { status: "occupied", studentId: s.id } })
        : { count: 0 };
      if (!count) throw invalid({ bedId: "Selected bed is not available" });
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
  await assertPropertyAccess(auth, s.propertyId);
  const { bedId, propertyId, dob, joinedOn, ...rest } = patch;
  const data = { ...rest };
  if (dob) data.dob = new Date(dob);
  if (joinedOn) data.joinedOn = new Date(joinedOn);
  if (data.studentCode !== undefined) {
    data.studentCode = data.studentCode.trim();
    if (data.studentCode !== s.studentCode
      && (await prisma.studentProfile.findUnique({ where: { studentCode: data.studentCode }, select: { id: true } }))) throw codeTaken();
  }
  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.studentProfile.update({ where: { id }, data });
    await syncLogin(tx, id, { email: patch.email, phone: patch.phone });
    return row;
  });
  return serialize(updated);
}

export async function setStatus(auth, id, status) {
  requireRole(auth, "owner", "manager");
  const s = await prisma.studentProfile.findUnique({ where: { id } });
  if (!s) throw notFound("Student");
  await assertPropertyAccess(auth, s.propertyId);
  // Moving out releases the bed in the same transaction (occupancy stays consistent).
  const updated = await prisma.$transaction(async (tx) => {
    if (status === "moved_out" && s.bedId) {
      await tx.bed.updateMany({ where: { id: s.bedId, studentId: id }, data: { status: "available", studentId: null } });
    }
    return tx.studentProfile.update({
      where: { id },
      data: status === "moved_out" ? { status, bedId: null, roomId: null } : { status },
    });
  });
  return serialize(updated);
}

export async function updateSelf(auth, patch) {
  requireRole(auth, "student");
  const allowed = (({ email, phone, address, emergencyName, emergencyPhone, bloodGroup }) =>
    ({ email, phone, address, emergencyName, emergencyPhone, bloodGroup }))(patch);
  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.studentProfile.update({ where: { id: auth.studentId }, data: allowed });
    await syncLogin(tx, auth.studentId, { email: allowed.email, phone: allowed.phone });
    return row;
  });
  return serialize(updated);
}
