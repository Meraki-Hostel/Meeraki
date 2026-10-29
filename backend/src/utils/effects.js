import { prisma } from "../config/prisma.js";

// Side effects shared by every module's writes: the activity feed, in-app
// notifications and the acting user's display name. Each takes the open
// transaction, so the side effect commits or rolls back with the change itself.

// recordedBy / actor name needs the display name; fetch once per write.
export async function actorName(auth) {
  const u = await prisma.user.findUnique({ where: { id: auth.userId }, select: { name: true } });
  return u?.name ?? "Staff";
}

export async function logActivity(tx, auth, actorName, category, message, propertyId, link) {
  const orgId = propertyId ? (await tx.property.findUnique({ where: { id: propertyId }, select: { orgId: true } })).orgId : auth.orgId;
  await tx.activityLog.create({
    data: { orgId, propertyId, actorName, actorRole: auth?.role ?? "system", category, message, link },
  });
}

export async function notifyStudentUsers(tx, studentId, title, body, category, link) {
  const users = await tx.user.findMany({ where: { studentId }, select: { id: true } });
  if (users.length)
    await tx.notification.createMany({
      data: users.map((u) => ({ recipientUserId: u.id, title, body, category, link })),
    });
}

// Managers of the property always; the org's owners only when ownerLink is given.
export async function notifyStaffUsers(tx, propertyId, title, body, category, managerLink, ownerLink) {
  const mgrs = await tx.user.findMany({ where: { role: "manager", propertyId }, select: { id: true } });
  const owners = ownerLink
    ? await tx.user.findMany({ where: { role: "owner", org: { properties: { some: { id: propertyId } } } }, select: { id: true } })
    : [];
  const rows = [
    ...mgrs.map((u) => ({ recipientUserId: u.id, title, body, category, link: managerLink })),
    ...owners.map((u) => ({ recipientUserId: u.id, title, body, category, link: ownerLink })),
  ];
  if (rows.length) await tx.notification.createMany({ data: rows });
}

// Next value of a named sequence (receipts, complaint tickets). A single
// INSERT … ON CONFLICT is safe even when the counter row does not exist yet
// (an upsert's read-then-insert is not).
export async function nextCounter(tx, key) {
  const [{ value }] = await tx.$queryRaw`
    INSERT INTO "Counter" ("key", "value") VALUES (${key}, 1)
    ON CONFLICT ("key") DO UPDATE SET "value" = "Counter"."value" + 1
    RETURNING "value"`;
  return Number(value);
}
