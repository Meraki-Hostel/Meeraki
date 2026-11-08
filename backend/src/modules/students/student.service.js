import { prisma } from "../../config/prisma.js";
import { ApiError, notFound, forbidden, invalid, conflict } from "../../utils/ApiError.js";
import { isEmail, isIndianPhone, normalizePhone } from "../../utils/validators.js";
import { requireRole, assertPropertyAccess, propertyScope } from "../../utils/scope.js";
import { withBalance, iso, todayISO, counted, currentPeriod } from "../../utils/money.js";
import { ledgerRows, balancesByStudent } from "../../utils/ledger.js";
import { logActivity } from "../../utils/sideEffects.js";
import { issueInvitation, deliverInvitation } from "../invitations/invitation.service.js";
import { generateRent } from "../payments/charge.service.js";
import { studentExtras } from "./student.extras.js";

const inr = (n) => `₹${Number(n).toLocaleString("en-IN")}`;

function serialize(s) {
  const { createdAt, updatedAt, ...rest } = s;
  return { ...rest, roomId: s.roomId ?? undefined, bedId: s.bedId ?? undefined, dob: iso(s.dob), joinedOn: iso(s.joinedOn) };
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

// Names for exactly the rows being returned (never a table-wide scan of every tenant).
async function lookupMaps(students) {
  const ids = (key) => [...new Set(students.map((s) => s[key]).filter(Boolean))];
  const [properties, rooms, beds, balances] = await Promise.all([
    prisma.property.findMany({ where: { id: { in: ids("propertyId") } }, select: { id: true, name: true } }),
    prisma.room.findMany({ where: { id: { in: ids("roomId") } }, select: { id: true, number: true } }),
    prisma.bed.findMany({ where: { id: { in: ids("bedId") } }, select: { id: true, label: true } }),
    balancesByStudent(students.map((s) => s.id)),
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

  const [maps, chargesRaw, paymentsRaw, rows, extras] = await Promise.all([
    lookupMaps([s]),
    prisma.rentCharge.findMany({ where: { studentId: id } }),
    prisma.payment.findMany({ where: { studentId: id, ...counted } }),
    ledgerRows(prisma, { studentId: id }),
    studentExtras(auth, s),
  ]);
  const today = todayISO();
  const charges = chargesRaw
    .map((c) => ({ ...withBalance(c, rows, today), dueDate: iso(c.dueDate), createdAt: undefined, updatedAt: undefined }))
    .sort((a, b) => b.period.localeCompare(a.period) || a.dueDate.localeCompare(b.dueDate));
  const payments = paymentsRaw
    .map((p) => ({ ...p, paidOn: iso(p.paidOn), createdAt: undefined }))
    .sort((a, b) => b.paidOn.localeCompare(a.paidOn));

  return { student: toListItem(s, maps), charges, payments, ...extras };
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

const phoneTaken = () =>
  new ApiError("CONFLICT", "That mobile number is already registered to another resident.", { phone: "That mobile number is already registered to another resident." });

// Valid numbers are stored as their 10 digits, like the sign-in account's copy.
const storedPhone = (phone) => (isIndianPhone(phone) ? normalizePhone(phone) : phone);

// A mobile number belongs to one current resident per organization (moved-out
// residents don't count). Older rows may hold formatted numbers ("98765 43210"),
// so the comparison normalises in SQL. The advisory lock makes two simultaneous
// saves of the same number queue up, so they cannot both pass the check.
async function assertPhoneFree(tx, orgId, phone, exceptStudentId = "") {
  const digits = normalizePhone(phone);
  if (!digits) return;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`student-phone:${orgId}:${digits}`}))`;
  const [clash] = await tx.$queryRaw`
    SELECT s."id" FROM "StudentProfile" s JOIN "Property" p ON p."id" = s."propertyId"
    WHERE p."orgId" = ${orgId} AND s."status" <> 'moved_out' AND s."id" <> ${exceptStudentId}
      AND right(regexp_replace(s."phone", '[^0-9]', '', 'g'), 10) = ${digits}
    LIMIT 1`;
  if (clash) throw phoneTaken();
}

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

/**
 * Admits a resident. Optionally (default: when they have an email) issues the
 * invitation that lets them create their sign-in, and raises a security deposit.
 * An admission with a bed is billed for the current month straight away
 * (pro-rated from the joining day), instead of waiting for the daily job.
 */
export async function create(auth, input, actorName = "Staff") {
  requireRole(auth, "owner", "manager");
  const propertyId = auth.role === "owner" ? input.propertyId ?? auth.propertyId : auth.propertyId;
  if (!propertyId) throw invalid({ propertyId: "Property is required" });
  await assertPropertyAccess(auth, propertyId);

  const requestedCode = input.studentCode?.trim();
  if (requestedCode && (await prisma.studentProfile.findUnique({ where: { studentCode: requestedCode }, select: { id: true } }))) {
    throw codeTaken();
  }
  const sendInvite = input.sendInvite ?? isEmail(input.email ?? "");
  if (sendInvite && (await prisma.user.findFirst({ where: { email: { equals: input.email, mode: "insensitive" } }, select: { id: true } }))) {
    throw new ApiError("CONFLICT", "That email is already used by another account.", { email: "That email is already used by another account." });
  }

  let invitation = null;
  const created = await prisma.$transaction(async (tx) => {
    await assertPhoneFree(tx, auth.orgId, input.phone);
    const studentCode = requestedCode || (await allocateStudentCode(tx));
    const s = await tx.studentProfile.create({
      data: {
        studentCode, name: input.name, email: input.email, phone: storedPhone(input.phone),
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
    if (input.deposit > 0) {
      await tx.rentCharge.create({
        data: {
          studentId: s.id, propertyId, kind: "deposit", period: iso(s.joinedOn).slice(0, 7), amount: input.deposit,
          dueDate: s.joinedOn, description: "Security deposit (refundable)", createdBy: actorName,
        },
      });
    }
    if (sendInvite) {
      invitation = await issueInvitation(tx, { orgId: auth.orgId, propertyId, role: "student", name: s.name, email: s.email, studentId: s.id, invitedBy: actorName });
    }
    await logActivity(tx, auth, actorName, "student", `New resident admitted: ${s.name}${input.deposit > 0 ? ` (deposit ${inr(input.deposit)})` : ""}`, propertyId, `/manager/students/${s.id}`);
    return tx.studentProfile.findUnique({ where: { id: s.id } });
  });
  // The resident is already saved; a failure raising this month's rent must not be
  // reported as a failed admission (the daily job backfills any charge missed here).
  if (created.status === "active") {
    try { await generateRent({ period: currentPeriod(), orgId: auth.orgId, propertyId }); }
    catch (err) { console.error("generateRent after admission failed:", err.message); }
  }
  const invite = invitation ? await deliverInvitation(invitation) : null;
  return { ...serialize(created), invite: invite ? { inviteLink: invite.inviteLink, emailSent: invite.emailSent } : undefined };
}

export async function update(auth, id, patch, actorName = "Staff") {
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
  if (data.phone !== undefined) data.phone = storedPhone(data.phone);
  const updated = await prisma.$transaction(async (tx) => {
    if (data.phone !== undefined) await assertPhoneFree(tx, auth.orgId, data.phone, id);
    const row = await tx.studentProfile.update({ where: { id }, data });
    await syncLogin(tx, id, { email: patch.email, phone: patch.phone });
    await logActivity(tx, auth, actorName, "student", `Resident details updated: ${row.name}`, row.propertyId, `/manager/students/${row.id}`);
    return row;
  });
  return serialize(updated);
}

export async function setStatus(auth, id, status, { force = false, actorName = "Staff" } = {}) {
  requireRole(auth, "owner", "manager");
  const s = await prisma.studentProfile.findUnique({ where: { id } });
  if (!s) throw notFound("Student");
  await assertPropertyAccess(auth, s.propertyId);
  // Moving out with unpaid dues needs an owner's explicit decision.
  if (status === "moved_out" && s.status !== "moved_out") {
    const due = (await balancesByStudent([id])).get(id) ?? 0;
    if (due > 0 && !(force && auth.role === "owner")) {
      throw conflict(`${s.name} still owes ${inr(due)}. Collect or adjust the dues first${auth.role === "owner" ? ", or confirm the move-out anyway" : ", or ask the owner to approve the move-out"}.`);
    }
  }
  // Moving out releases the bed in the same transaction (occupancy stays consistent).
  const updated = await prisma.$transaction(async (tx) => {
    if (status === "moved_out" && s.bedId) {
      await tx.bed.updateMany({ where: { id: s.bedId, studentId: id }, data: { status: "available", studentId: null } });
    }
    const row = await tx.studentProfile.update({
      where: { id },
      data: status === "moved_out" ? { status, bedId: null, roomId: null } : { status },
    });
    await logActivity(tx, auth, actorName, "student", `Resident status changed to ${status.replace("_", " ")}: ${row.name}`, row.propertyId, `/manager/students/${row.id}`);
    return row;
  });
  return serialize(updated);
}

export async function updateSelf(auth, patch) {
  requireRole(auth, "student");
  const allowed = (({ email, phone, address, emergencyName, emergencyPhone, bloodGroup }) =>
    ({ email, phone, address, emergencyName, emergencyPhone, bloodGroup }))(patch);
  if (allowed.phone !== undefined) allowed.phone = storedPhone(allowed.phone);
  const updated = await prisma.$transaction(async (tx) => {
    if (allowed.phone !== undefined) await assertPhoneFree(tx, auth.orgId, allowed.phone, auth.studentId);
    const row = await tx.studentProfile.update({ where: { id: auth.studentId }, data: allowed });
    await syncLogin(tx, auth.studentId, { email: allowed.email, phone: allowed.phone });
    return row;
  });
  return serialize(updated);
}
