import { prisma } from "../../config/prisma.js";
import { ApiError, invalid, notFound } from "../../utils/ApiError.js";
import { requireRole, assertPropertyAccess, propertyScope } from "../../utils/scope.js";
import { logActivity, notifyStaffUsers } from "../../utils/sideEffects.js";
import { settingsFor } from "../settings/settings.service.js";

const itemView = (i, pName) => ({
  id: i.id, propertyId: i.propertyId, name: i.name, sku: i.sku, category: i.category, unit: i.unit,
  quantity: i.quantity, reorderLevel: i.reorderLevel, unitCost: i.unitCost, updatedAt: i.updatedAt.toISOString(),
  propertyName: pName.get(i.propertyId) ?? "—", lowStock: i.quantity <= i.reorderLevel,
});

async function propertyNames(ids) {
  const props = await prisma.property.findMany({ where: { id: { in: [...new Set(ids)] } }, select: { id: true, name: true } });
  return new Map(props.map((p) => [p.id, p.name]));
}

export async function list(auth, filters = {}) {
  requireRole(auth, "owner", "manager");
  const where = await propertyScope(auth, filters.propertyId);
  if (filters.category) where.category = filters.category;
  // Scoped first, then the low-stock comparison (column vs column) on that set.
  let rows = await prisma.inventoryItem.findMany({ where, orderBy: [{ category: "asc" }, { name: "asc" }] });
  if (filters.lowStockOnly) rows = rows.filter((i) => i.quantity <= i.reorderLevel);
  const pName = await propertyNames(rows.map((r) => r.propertyId));
  return rows.map((i) => itemView(i, pName));
}

export async function transactions(auth, filters = {}) {
  requireRole(auth, "owner", "manager");
  // Transactions carry propertyId but no property relation: scope by id list.
  const scope = await propertyScope(auth, filters.propertyId);
  const where = scope.propertyId
    ? { propertyId: scope.propertyId }
    : { propertyId: { in: (await prisma.property.findMany({ where: { orgId: auth.orgId }, select: { id: true } })).map((p) => p.id) } };
  if (filters.itemId) where.itemId = filters.itemId;
  const rows = await prisma.inventoryTransaction.findMany({ where, orderBy: { at: "desc" }, take: 200, include: { item: { select: { name: true, unit: true } } } });
  return rows.map((t) => ({
    id: t.id, itemId: t.itemId, propertyId: t.propertyId, type: t.type, quantity: t.quantity, note: t.note, by: t.by,
    at: t.at.toISOString(), itemName: t.item.name, unit: t.item.unit,
  }));
}

export async function create(auth, actorName, input) {
  requireRole(auth, "owner", "manager");
  const propertyId = auth.role === "owner" ? input.propertyId : auth.propertyId;
  if (!propertyId) throw invalid({ propertyId: "Choose a property" });
  await assertPropertyAccess(auth, propertyId);
  const sku = input.sku.trim().toUpperCase();
  if (await prisma.inventoryItem.findUnique({ where: { propertyId_sku: { propertyId, sku } }, select: { id: true } })) {
    throw new ApiError("CONFLICT", "An item with this SKU already exists here.", { sku: "This SKU is already used at this property" });
  }
  const item = await prisma.$transaction(async (tx) => {
    const row = await tx.inventoryItem.create({
      data: {
        propertyId, name: input.name.trim(), sku, category: input.category, unit: input.unit.trim(),
        quantity: input.quantity, reorderLevel: input.reorderLevel, unitCost: input.unitCost,
      },
    });
    if (input.quantity > 0) {
      await tx.inventoryTransaction.create({ data: { itemId: row.id, propertyId, type: "in", quantity: input.quantity, note: "Opening stock", by: actorName } });
    }
    await logActivity(tx, auth, actorName, "inventory", `Inventory item added: ${row.name} (${row.quantity} ${row.unit})`, propertyId, "/manager/inventory");
    return row;
  });
  return itemView(item, await propertyNames([item.propertyId]));
}

/**
 * Stock in or out. The item row is locked, so two concurrent "out" movements can
 * never take more than is on the shelf (the CHECK constraint backs this up).
 */
export async function adjust(auth, actorName, { itemId, type, quantity, note }) {
  requireRole(auth, "owner", "manager");
  const found = await prisma.inventoryItem.findUnique({ where: { id: itemId } });
  if (!found) throw notFound("Item");
  await assertPropertyAccess(auth, found.propertyId);
  if (!(Number.isInteger(quantity) && quantity > 0)) throw invalid({ quantity: "Enter a whole number greater than zero" });
  if (type === "out" && !note?.trim()) throw invalid({ note: "Say what the stock was used for" });

  const item = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "InventoryItem" WHERE "id" = ${itemId} FOR UPDATE`;
    const cur = await tx.inventoryItem.findUnique({ where: { id: itemId } });
    if (type === "out" && quantity > cur.quantity) throw invalid({ quantity: `Only ${cur.quantity} ${cur.unit} in stock` });
    const next = type === "in" ? cur.quantity + quantity : cur.quantity - quantity;
    const row = await tx.inventoryItem.update({ where: { id: itemId }, data: { quantity: next } });
    await tx.inventoryTransaction.create({ data: { itemId, propertyId: cur.propertyId, type, quantity, note: note?.trim() ?? "", by: actorName } });
    await logActivity(tx, auth, actorName, "inventory", `Stock ${type === "in" ? "added" : "used"}: ${quantity} ${cur.unit} of ${cur.name} (now ${next})`, cur.propertyId, "/manager/inventory");
    // Only the movement that crosses the reorder level alerts, not every one below it.
    if (cur.quantity > cur.reorderLevel && next <= cur.reorderLevel) {
      const settings = await settingsFor(auth.orgId, tx);
      await notifyStaffUsers(tx, cur.propertyId, "Low stock", `${cur.name} is down to ${next} ${cur.unit} (reorder level ${cur.reorderLevel}).`,
        "inventory", "/manager/inventory", settings.notifications.lowStock ? "/owner/inventory" : undefined);
    }
    return row;
  });
  return itemView(item, await propertyNames([item.propertyId]));
}
