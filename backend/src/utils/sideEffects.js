import { prisma } from "../config/prisma.js";
import { kickPush } from "../modules/devices/push.dispatch.js";

// Activity rows and in-app notifications. Always called with the transaction
// client (`tx`) of the change they describe, so they commit or roll back with it.
// Push to phones is not sent from here (the transaction may still roll back):
// kickPush() only wakes the dispatcher, which sends committed rows.

export async function logActivity(tx, auth, actorName, category, message, propertyId, link) {
  const orgId = propertyId
    ? (await tx.property.findUnique({ where: { id: propertyId }, select: { orgId: true } })).orgId
    : auth.orgId;
  await tx.activityLog.create({
    data: { orgId, propertyId: propertyId ?? null, actorName, actorRole: auth?.role ?? "system", category, message, link },
  });
}

export async function notifyUsers(tx, userIds, title, body, category, link) {
  const ids = [...new Set(userIds.filter(Boolean))];
  if (ids.length) {
    await tx.notification.createMany({ data: ids.map((recipientUserId) => ({ recipientUserId, title, body, category, link })) });
    kickPush();
  }
}

export async function notifyStudentUsers(tx, studentId, title, body, category, link) {
  const users = await tx.user.findMany({ where: { studentId, disabledAt: null }, select: { id: true } });
  await notifyUsers(tx, users.map((u) => u.id), title, body, category, link);
}

/**
 * Managers of the property get `managerLink`; owners of its organization are
 * included only when `ownerLink` is given (owners opt in per event type).
 */
export async function notifyStaffUsers(tx, propertyId, title, body, category, managerLink, ownerLink) {
  const mgrs = await tx.user.findMany({ where: { role: "manager", propertyId, disabledAt: null }, select: { id: true } });
  const owners = ownerLink
    ? await tx.user.findMany({ where: { role: "owner", disabledAt: null, org: { properties: { some: { id: propertyId } } } }, select: { id: true } })
    : [];
  const rows = [
    ...mgrs.map((u) => ({ recipientUserId: u.id, title, body, category, link: managerLink })),
    ...owners.map((u) => ({ recipientUserId: u.id, title, body, category, link: ownerLink })),
  ];
  if (rows.length) {
    await tx.notification.createMany({ data: rows });
    kickPush();
  }
}

/** The signed-in user's display name, for "recorded by" / "decided by" fields. */
export async function actorName(auth) {
  const u = await prisma.user.findUnique({ where: { id: auth.userId }, select: { name: true } });
  return u?.name ?? "Staff";
}
