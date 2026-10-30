import { prisma } from "../../config/prisma.js";
import { iso } from "../../utils/money.js";
import { assertPropertyAccess } from "../../utils/scope.js";
import { notFound } from "../../utils/ApiError.js";

export async function listNotifications(auth, filters = {}) {
  const where = { recipientUserId: auth.userId };
  if (filters.category) where.category = filters.category;
  if (filters.unreadOnly === "true" || filters.unreadOnly === true) where.read = false;
  const rows = await prisma.notification.findMany({ where, orderBy: { createdAt: "desc" }, take: 100 });
  return rows.map((n) => ({ ...n, createdAt: n.createdAt.toISOString() }));
}
export async function markNotificationRead(auth, id, read) {
  // Only the recipient can change it; any other id (unknown or someone else's) is NOT_FOUND.
  const { count } = await prisma.notification.updateMany({ where: { id, recipientUserId: auth.userId }, data: { read } });
  if (!count) throw notFound("Notification");
}
export async function markAllNotificationsRead(auth) {
  await prisma.notification.updateMany({ where: { recipientUserId: auth.userId, read: false }, data: { read: true } });
}

export async function listActivity(auth, filters = {}) {
  const where = { orgId: auth.orgId };
  if (auth.role !== "owner") where.propertyId = auth.propertyId;
  else if (filters.propertyId) { await assertPropertyAccess(auth, filters.propertyId); where.propertyId = filters.propertyId; }
  if (filters.category) where.category = filters.category;
  const rows = await prisma.activityLog.findMany({
    where, orderBy: { createdAt: "desc" }, take: Number(filters.limit) || 50,
  });
  const ids = [...new Set(rows.map((a) => a.propertyId).filter(Boolean))];
  const props = new Map((await prisma.property.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } })).map((p) => [p.id, p.name]));
  return rows.map((a) => ({ ...a, createdAt: a.createdAt.toISOString(), propertyName: a.propertyId ? props.get(a.propertyId) : undefined }));
}