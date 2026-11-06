import { prisma } from "../../config/prisma.js";
import { invalid } from "../../utils/ApiError.js";
import { requireRole, assertPropertyAccess } from "../../utils/scope.js";
import { withBalance, iso, todayISO, currentPeriod } from "../../utils/money.js";
import { ledgerRows } from "../../utils/ledger.js";
import { logActivity } from "../../utils/sideEffects.js";
import { assertWithinPlan } from "../settings/settings.service.js";

const count = (groups, id, key = "_count") => groups.find((g) => g.propertyId === id)?.[key] ?? 0;

/**
 * PropertyStats for many properties with a fixed number of grouped queries
 * (not a handful per property). Mirrors the frontend's PropertyStats.
 */
export async function statsForMany(properties, period = currentPeriod()) {
  const ids = properties.map((p) => p.id);
  if (!ids.length) return new Map();
  const [bedGroups, roomGroups, charges, studentGroups, complaintGroups, managers] = await Promise.all([
    prisma.bed.groupBy({ by: ["propertyId", "status"], where: { propertyId: { in: ids } }, _count: true }),
    prisma.room.groupBy({ by: ["propertyId"], where: { propertyId: { in: ids } }, _count: true }),
    prisma.rentCharge.findMany({ where: { propertyId: { in: ids }, period } }),
    prisma.studentProfile.groupBy({ by: ["propertyId"], where: { propertyId: { in: ids }, status: { in: ["active", "notice"] } }, _count: true }),
    prisma.complaint.groupBy({ by: ["propertyId"], where: { propertyId: { in: ids }, status: { in: ["open", "in_progress"] } }, _count: true }),
    prisma.staffMember.findMany({ where: { id: { in: properties.map((p) => p.managerStaffId).filter(Boolean) } }, select: { id: true, name: true } }),
  ]);
  const rows = await ledgerRows(prisma, { chargeId: { in: charges.map((c) => c.id) } });
  const today = todayISO();
  const managerName = new Map(managers.map((m) => [m.id, m.name]));

  const out = new Map();
  for (const p of properties) {
    const beds = bedGroups.filter((g) => g.propertyId === p.id);
    const total = beds.reduce((a, g) => a + g._count, 0);
    const occupied = beds.find((g) => g.status === "occupied")?._count ?? 0;
    const unavailable = beds.find((g) => g.status === "unavailable")?._count ?? 0;
    const wb = charges.filter((c) => c.propertyId === p.id).map((c) => withBalance(c, rows, today));
    out.set(p.id, {
      rooms: count(roomGroups, p.id), beds: total, occupiedBeds: occupied,
      availableBeds: total - occupied - unavailable, unavailableBeds: unavailable,
      occupancyPct: total ? Math.round((occupied / total) * 100) : 0,
      students: count(studentGroups, p.id),
      expectedRent: wb.reduce((a, c) => a + c.amount, 0),
      collectedRent: wb.reduce((a, c) => a + Math.max(0, Math.min(c.paid, c.amount)), 0),
      openComplaints: count(complaintGroups, p.id),
      managerName: p.managerStaffId ? managerName.get(p.managerStaffId) : undefined,
    });
  }
  return out;
}

const serialize = (p) => {
  const { createdAt, updatedAt, ...rest } = p;
  return { ...rest, managerStaffId: p.managerStaffId ?? undefined, openedOn: iso(p.openedOn) };
};

export async function list(auth, filters = {}) {
  const where = {};
  if (auth.role === "owner") where.orgId = auth.orgId; // owner: their organization only
  else where.id = auth.propertyId; // manager/student: own property
  if (filters.status) where.status = filters.status;
  if (filters.type) where.type = filters.type;
  if (filters.search) where.OR = [
    { name: { contains: filters.search, mode: "insensitive" } },
    { code: { contains: filters.search, mode: "insensitive" } },
    { city: { contains: filters.search, mode: "insensitive" } },
  ];
  const props = await prisma.property.findMany({ where, orderBy: { name: "asc" } });
  const stats = await statsForMany(props);
  return props.map((p) => ({ ...serialize(p), stats: stats.get(p.id) }));
}

export async function get(auth, id) {
  await assertPropertyAccess(auth, id);
  const p = await prisma.property.findUnique({ where: { id } });
  return { ...serialize(p), stats: (await statsForMany([p])).get(p.id) };
}

// A manager can only be someone on this organization's own staff.
async function assertOwnStaff(auth, staffId) {
  if (!staffId) return;
  const staff = await prisma.staffMember.findUnique({ where: { id: staffId }, select: { orgId: true, role: true } });
  if (!staff || staff.orgId !== auth.orgId) throw invalid({ managerStaffId: "Choose a manager from your own staff" });
}

export async function create(auth, input, actorName = "Owner") {
  requireRole(auth, "owner");
  await assertOwnStaff(auth, input.managerStaffId);
  const p = await prisma.$transaction(async (tx) => {
    await assertWithinPlan(tx, auth.orgId, { properties: 1 });
    const row = await tx.property.create({
      data: {
        orgId: auth.orgId, name: input.name, code: input.code, type: input.type, status: input.status ?? "onboarding",
        locality: input.locality, city: input.city, address: input.address, pincode: input.pincode,
        phone: input.phone, baseRent: input.baseRent, amenities: input.amenities ?? [],
        managerStaffId: input.managerStaffId, openedOn: new Date(todayISO()), imageVariant: Math.floor(Math.random() * 6),
      },
    });
    await logActivity(tx, auth, actorName, "property", `Property added: ${row.name}`, row.id, `/owner/properties/${row.id}`);
    return row;
  });
  return serialize(p);
}

export async function update(auth, id, input, actorName = "Owner") {
  requireRole(auth, "owner"); // managers have no property-editing screen; rent, type and status are the owner's
  await assertPropertyAccess(auth, id);
  await assertOwnStaff(auth, input.managerStaffId);
  const p = await prisma.$transaction(async (tx) => {
    const row = await tx.property.update({ where: { id }, data: input });
    await logActivity(tx, auth, actorName, "property", `Property details updated: ${row.name}`, id, `/owner/properties/${id}`);
    return row;
  });
  return serialize(p);
}

export async function setStatus(auth, id, status, actorName = "Owner") {
  requireRole(auth, "owner");
  await assertPropertyAccess(auth, id); // another organization's property is "not found"
  const p = await prisma.$transaction(async (tx) => {
    const before = await tx.property.findUnique({ where: { id }, select: { status: true } });
    const row = await tx.property.update({ where: { id }, data: { status } });
    if (before.status !== status) {
      await logActivity(tx, auth, actorName, "property", `${row.name} is now ${status}`, id, `/owner/properties/${id}`);
    }
    return row;
  });
  return serialize(p);
}
