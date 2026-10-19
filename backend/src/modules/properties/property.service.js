import { prisma } from "../../config/prisma.js";
import { notFound, forbidden } from "../../utils/ApiError.js";
import { requireRole, assertPropertyAccess } from "../../utils/scope.js";
import { withBalance, iso, todayISO, currentPeriod } from "../../utils/money.js";

// Compute PropertyStats (mirrors frontend base.ts propertyStats).
async function statsFor(property, period = currentPeriod()) {
  const [beds, rooms, charges, payments, students, staff] = await Promise.all([
    prisma.bed.findMany({ where: { propertyId: property.id }, select: { status: true } }),
    prisma.room.count({ where: { propertyId: property.id } }),
    prisma.rentCharge.findMany({ where: { propertyId: property.id, period } }),
    prisma.payment.findMany({ where: { propertyId: property.id }, select: { chargeId: true, amount: true } }),
    prisma.studentProfile.count({ where: { propertyId: property.id, status: { in: ["active", "notice"] } } }),
    property.managerStaffId ? prisma.staffMember.findUnique({ where: { id: property.managerStaffId }, select: { name: true } }) : null,
  ]);
  const occupied = beds.filter((b) => b.status === "occupied").length;
  const unavailable = beds.filter((b) => b.status === "unavailable").length;
  const today = todayISO();
  const wb = charges.map((c) => withBalance(c, payments, today));
  return {
    rooms, beds: beds.length, occupiedBeds: occupied,
    availableBeds: beds.length - occupied - unavailable, unavailableBeds: unavailable,
    occupancyPct: beds.length ? Math.round((occupied / beds.length) * 100) : 0,
    students,
    expectedRent: wb.reduce((a, c) => a + c.amount, 0),
    collectedRent: wb.reduce((a, c) => a + Math.min(c.paid, c.amount), 0),
    openComplaints: 0, // complaints module not yet implemented
    managerName: staff?.name,
  };
}

const serialize = (p) => ({ ...p, openedOn: iso(p.openedOn) });

export async function list(auth, filters = {}) {
  const where = {};
  if (auth.role !== "owner") where.id = auth.propertyId; // manager/student: own property
  if (filters.status) where.status = filters.status;
  if (filters.type) where.type = filters.type;
  if (filters.search) where.OR = [
    { name: { contains: filters.search, mode: "insensitive" } },
    { code: { contains: filters.search, mode: "insensitive" } },
    { city: { contains: filters.search, mode: "insensitive" } },
  ];
  const props = await prisma.property.findMany({ where, orderBy: { name: "asc" } });
  return Promise.all(props.map(async (p) => ({ ...serialize(p), stats: await statsFor(p) })));
}

export async function get(auth, id) {
  const p = await prisma.property.findUnique({ where: { id } });
  if (!p) throw notFound("Property");
  assertPropertyAccess(auth, id);
  return { ...serialize(p), stats: await statsFor(p) };
}

export async function create(auth, input) {
  requireRole(auth, "owner");
  const p = await prisma.property.create({
    data: {
      name: input.name, code: input.code, type: input.type, status: input.status ?? "onboarding",
      locality: input.locality, city: input.city, address: input.address, pincode: input.pincode,
      phone: input.phone, baseRent: input.baseRent, amenities: input.amenities ?? [],
      managerStaffId: input.managerStaffId, openedOn: new Date(), imageVariant: Math.floor(Math.random() * 6),
    },
  });
  return serialize(p);
}

export async function update(auth, id, input) {
  const existing = await prisma.property.findUnique({ where: { id } });
  if (!existing) throw notFound("Property");
  assertPropertyAccess(auth, id);
  const p = await prisma.property.update({ where: { id }, data: input });
  return serialize(p);
}

export async function setStatus(auth, id, status) {
  requireRole(auth, "owner");
  const existing = await prisma.property.findUnique({ where: { id } });
  if (!existing) throw notFound("Property");
  const p = await prisma.property.update({ where: { id }, data: { status } });
  return serialize(p);
}
