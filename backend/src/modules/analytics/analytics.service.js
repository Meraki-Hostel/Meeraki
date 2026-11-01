import { prisma } from "../../config/prisma.js";
import { notFound, invalid } from "../../utils/ApiError.js";
import { requireRole, assertPropertyAccess } from "../../utils/scope.js";
import { withBalance, todayISO, currentPeriod } from "../../utils/money.js";
import { ledgerRows } from "../../utils/ledger.js";
import { summary } from "../payments/payment.service.js";
import { list as listProperties, get as getProperty } from "../properties/property.service.js";

const shiftPeriod = (p, n) => {
  const idx = Number(p.slice(0, 4)) * 12 + Number(p.slice(5, 7)) - 1 + n;
  return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, "0")}`;
};
const label = (p) => new Date(`${p}-01T00:00:00Z`).toLocaleString("en-IN", { month: "short", timeZone: "UTC" });
const monthRange = (p) => [new Date(`${p}-01T00:00:00.000Z`), new Date(`${shiftPeriod(p, 1)}-01T00:00:00.000Z`)];

export async function ownerOverview(auth, period = currentPeriod()) {
  requireRole(auth, "owner");
  const [props, collection, last] = await Promise.all([
    listProperties(auth),
    summary(auth, { period }),
    summary(auth, { period: shiftPeriod(period, -1) }),
  ]);
  const total = (k) => props.reduce((a, p) => a + p.stats[k], 0);
  const beds = total("beds");
  const occupiedBeds = total("occupiedBeds");
  return {
    properties: props.length,
    activeProperties: props.filter((p) => p.status === "active").length,
    rooms: total("rooms"), beds, occupiedBeds, students: total("students"),
    occupancyPct: beds ? Math.round((occupiedBeds / beds) * 100) : 0,
    expectedRent: collection.expected, collection,
    lastMonthCollectionPct: last.collectionPct,
  };
}

export async function propertyComparison(auth) {
  requireRole(auth, "owner");
  return listProperties(auth);
}

/** Figures for one property and month, computed from the ledger. */
async function monthFigures(propertyIds, period) {
  const [from, to] = monthRange(period);
  const [charges, beds, complaints] = await Promise.all([
    prisma.rentCharge.findMany({ where: { propertyId: { in: propertyIds }, period } }),
    prisma.bed.groupBy({ by: ["propertyId", "status"], where: { propertyId: { in: propertyIds } }, _count: true }),
    prisma.complaint.groupBy({ by: ["propertyId"], where: { propertyId: { in: propertyIds }, createdAt: { gte: from, lt: to } }, _count: true }),
  ]);
  const rows = await ledgerRows(prisma, { chargeId: { in: charges.map((c) => c.id) } });
  const today = todayISO();
  return propertyIds.map((id) => {
    const wb = charges.filter((c) => c.propertyId === id).map((c) => withBalance(c, rows, today));
    const bedRows = beds.filter((b) => b.propertyId === id);
    const totalBeds = bedRows.reduce((a, b) => a + b._count, 0);
    // Live month: beds occupied now. Earlier months without a snapshot: residents
    // billed rent that month (one rent charge per occupant) is the closest record.
    const occupiedNow = bedRows.find((b) => b.status === "occupied")?._count ?? 0;
    const billed = new Set(charges.filter((c) => c.propertyId === id && c.kind === "rent").map((c) => c.studentId)).size;
    const occupiedBeds = period === currentPeriod() ? occupiedNow : Math.min(billed, totalBeds);
    const expected = wb.reduce((a, c) => a + c.amount, 0);
    const collected = wb.reduce((a, c) => a + Math.max(0, Math.min(c.paid, c.amount)), 0);
    return {
      propertyId: id, period, beds: totalBeds, occupiedBeds,
      occupancyPct: totalBeds ? Math.round((occupiedBeds / totalBeds) * 100) : 0,
      expected, collected, arrears: expected - collected,
      complaints: complaints.find((c) => c.propertyId === id)?._count ?? 0,
    };
  });
}

/** Month-end job: freezes last month's figures so history survives later changes. */
export async function snapshotMonth(period) {
  const props = await prisma.property.findMany({ select: { id: true } });
  const figures = await monthFigures(props.map((p) => p.id), period);
  for (const f of figures) {
    const { propertyId, period: p, ...data } = f;
    await prisma.monthlySnapshot.upsert({ where: { propertyId_period: { propertyId, period: p } }, create: f, update: data });
  }
  return { period, properties: figures.length };
}

export async function trends(auth, { propertyId, months = 6 }) {
  requireRole(auth, "owner", "manager");
  if (!(Number.isInteger(months) && months >= 1 && months <= 24)) throw invalid({ months: "Choose 1 to 24 months" });
  let ids;
  if (auth.role === "manager") ids = [auth.propertyId];
  else if (propertyId) { await assertPropertyAccess(auth, propertyId); ids = [propertyId]; }
  else ids = (await prisma.property.findMany({ where: { orgId: auth.orgId }, select: { id: true } })).map((p) => p.id);

  const now = currentPeriod();
  const periods = Array.from({ length: months }, (_, i) => shiftPeriod(now, i - months + 1));
  const snaps = await prisma.monthlySnapshot.findMany({ where: { propertyId: { in: ids }, period: { in: periods } } });
  const out = [];
  for (const period of periods) {
    const have = snaps.filter((s) => s.period === period);
    const missing = ids.filter((id) => period === now || !have.some((s) => s.propertyId === id));
    const live = missing.length ? await monthFigures(missing, period) : [];
    const rows = [...have.filter((s) => period !== now), ...live];
    const beds = rows.reduce((a, r) => a + r.beds, 0);
    const occ = rows.reduce((a, r) => a + r.occupiedBeds, 0);
    const sum = (k) => rows.reduce((a, r) => a + r[k], 0);
    out.push({
      period, label: label(period), occupancyPct: beds ? Math.round((occ / beds) * 100) : 0,
      expected: sum("expected"), collected: sum("collected"), arrears: sum("arrears"), complaints: sum("complaints"),
    });
  }
  return out;
}

export async function managerOverview(auth) {
  requireRole(auth, "manager");
  if (!auth.propertyId) throw notFound("Property");
  const pid = auth.propertyId;
  const today = todayISO();
  const weekEnd = new Date(Date.parse(`${today}T00:00:00Z`) + 7 * 864e5);
  const todayDate = new Date(`${today}T00:00:00.000Z`);
  const [property, collection, openComplaints, urgentComplaints, pendingLeaves, visitorsToday, openMaintenance, lowStockRows, departuresThisWeek] = await Promise.all([
    getProperty(auth, pid),
    summary(auth, { period: currentPeriod() }),
    prisma.complaint.count({ where: { propertyId: pid, status: { in: ["open", "in_progress"] } } }),
    prisma.complaint.count({ where: { propertyId: pid, status: { in: ["open", "in_progress"] }, priority: "urgent" } }),
    prisma.leaveRequest.count({ where: { propertyId: pid, status: "pending" } }),
    prisma.visitorRequest.count({ where: { propertyId: pid, visitDate: todayDate, status: { in: ["approved", "checked_in", "checked_out"] } } }),
    prisma.maintenanceTicket.count({ where: { propertyId: pid, status: { not: "completed" } } }),
    prisma.$queryRaw`SELECT COUNT(*)::int AS n FROM "InventoryItem" WHERE "propertyId" = ${pid} AND "quantity" <= "reorderLevel"`,
    prisma.leaveRequest.count({ where: { propertyId: pid, status: "approved", fromDate: { gte: todayDate, lt: weekEnd } } }),
  ]);
  return { property, collection, openComplaints, urgentComplaints, pendingLeaves, visitorsToday, openMaintenance, lowStock: lowStockRows[0].n, departuresThisWeek };
}
