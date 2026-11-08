import { prisma } from "../../config/prisma.js";
import { invalid, notFound, conflict } from "../../utils/ApiError.js";
import { requireRole, assertPropertyAccess, propertyScope } from "../../utils/scope.js";
import { nextValue, pad } from "../../utils/counters.js";
import { logActivity } from "../../utils/sideEffects.js";

// Allowed status moves. A completed ticket is final.
const NEXT = {
  open: ["assigned", "in_progress", "on_hold", "completed"],
  assigned: ["in_progress", "on_hold", "open", "completed"],
  in_progress: ["on_hold", "completed"],
  on_hold: ["in_progress", "assigned"],
  completed: [],
};
const label = (s) => s.replace("_", " ");

async function views(rows) {
  const [props, staff] = await Promise.all([
    prisma.property.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.propertyId))] } }, select: { id: true, name: true } }),
    prisma.staffMember.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.assigneeStaffId).filter(Boolean))] } }, select: { id: true, name: true } }),
  ]);
  const pName = new Map(props.map((p) => [p.id, p.name]));
  const sName = new Map(staff.map((s) => [s.id, s.name]));
  return rows.map((t) => ({
    id: t.id, ticketNo: t.ticketNo, propertyId: t.propertyId, title: t.title, description: t.description,
    category: t.category, location: t.location, priority: t.priority, status: t.status,
    assigneeStaffId: t.assigneeStaffId ?? undefined, vendor: t.vendor ?? undefined,
    estimatedCost: t.estimatedCost, actualCost: t.actualCost ?? undefined,
    createdAt: t.createdAt.toISOString(), updatedAt: t.updatedAt.toISOString(),
    propertyName: pName.get(t.propertyId) ?? "—",
    assigneeName: t.assigneeStaffId ? sName.get(t.assigneeStaffId) : undefined,
  }));
}

async function assertAssignee(staffId, propertyId) {
  const st = await prisma.staffMember.findUnique({ where: { id: staffId } });
  if (!st || st.propertyId !== propertyId || st.status !== "active") {
    throw invalid({ assigneeStaffId: "Choose an active staff member of this property" });
  }
}

export async function list(auth, filters = {}) {
  requireRole(auth, "owner", "manager");
  const where = await propertyScope(auth, filters.propertyId);
  if (filters.status) where.status = filters.status;
  if (filters.priority) where.priority = filters.priority;
  const rows = await prisma.maintenanceTicket.findMany({ where, orderBy: { createdAt: "desc" } });
  return views(rows);
}

export async function create(auth, actorName, input) {
  requireRole(auth, "owner", "manager");
  const propertyId = auth.role === "owner" ? input.propertyId : auth.propertyId;
  if (!propertyId) throw invalid({ propertyId: "Choose a property" });
  await assertPropertyAccess(auth, propertyId);
  if (input.assigneeStaffId) await assertAssignee(input.assigneeStaffId, propertyId);

  const t = await prisma.$transaction(async (tx) => {
    const ticketNo = `MNT-${pad(await nextValue(tx, "maintenance"))}`;
    const row = await tx.maintenanceTicket.create({
      data: {
        ticketNo, propertyId, title: input.title.trim(), description: input.description.trim(), category: input.category,
        location: input.location.trim(), priority: input.priority, status: input.assigneeStaffId ? "assigned" : "open",
        assigneeStaffId: input.assigneeStaffId || null, vendor: input.vendor?.trim() || null,
        estimatedCost: input.estimatedCost ?? 0, createdBy: actorName,
      },
    });
    await logActivity(tx, auth, actorName, "maintenance", `Maintenance ticket ${ticketNo} raised: ${row.title}`, propertyId, "/manager/maintenance");
    return row;
  });
  return (await views([t]))[0];
}

export async function update(auth, actorName, id, patch) {
  requireRole(auth, "owner", "manager");
  const t = await prisma.maintenanceTicket.findUnique({ where: { id } });
  if (!t) throw notFound("Ticket");
  await assertPropertyAccess(auth, t.propertyId);

  const data = {};
  let status = t.status;
  if (patch.assigneeStaffId !== undefined) {
    if (t.status === "completed") throw conflict("This ticket is completed.");
    if (patch.assigneeStaffId) {
      await assertAssignee(patch.assigneeStaffId, t.propertyId);
      if (status === "open") status = "assigned";
    } else if (status === "assigned") {
      status = "open";
    }
    data.assigneeStaffId = patch.assigneeStaffId || null;
  }
  if (patch.status && patch.status !== t.status) {
    if (!NEXT[t.status].includes(patch.status)) throw conflict(`A ${label(t.status)} ticket cannot be moved to ${label(patch.status)}.`);
    status = patch.status;
  }
  if (patch.priority) data.priority = patch.priority;
  if (patch.vendor !== undefined) data.vendor = patch.vendor?.trim() || null;
  if (patch.estimatedCost !== undefined) data.estimatedCost = patch.estimatedCost;
  if (patch.actualCost !== undefined) data.actualCost = patch.actualCost;
  if (status === "completed" && t.status !== "completed" && (data.actualCost ?? t.actualCost) == null) {
    throw invalid({ actualCost: "Enter the actual cost to complete the ticket" });
  }
  if (status !== t.status) data.status = status;

  const updated = await prisma.$transaction(async (tx) => {
    // Guarded on the status we read, so two concurrent moves cannot both apply.
    const { count } = await tx.maintenanceTicket.updateMany({ where: { id, status: t.status }, data });
    if (!count) throw conflict("This ticket was just changed by someone else. Reload and try again.");
    if (data.status) {
      await logActivity(tx, auth, actorName, "maintenance", `Ticket ${t.ticketNo} "${t.title}" moved to ${label(data.status)}`, t.propertyId, "/manager/maintenance");
    }
    return tx.maintenanceTicket.findUnique({ where: { id } });
  });
  return (await views([updated]))[0];
}
