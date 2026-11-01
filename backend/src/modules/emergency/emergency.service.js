import { prisma } from "../../config/prisma.js";
import { invalid, notFound, conflict } from "../../utils/ApiError.js";
import { requireRole, propertyScope, assertPropertyAccess } from "../../utils/scope.js";
import { logActivity, notifyUsers, notifyStudentUsers } from "../../utils/sideEffects.js";
import { sendMail, mailEnabled } from "../../services/mail.js";

const TYPE_LABEL = { medical: "Medical", fire: "Fire", security: "Security", other: "Other" };
const MAX_OPEN = 3;

async function views(rows) {
  const studentIds = [...new Set(rows.map((r) => r.studentId))];
  const propertyIds = [...new Set(rows.map((r) => r.propertyId))];
  const [students, properties] = await Promise.all([
    prisma.studentProfile.findMany({ where: { id: { in: studentIds } }, select: { id: true, name: true, roomId: true } }),
    prisma.property.findMany({ where: { id: { in: propertyIds } }, select: { id: true, name: true } }),
  ]);
  const roomIds = [...new Set(students.map((s) => s.roomId).filter(Boolean))];
  const rooms = roomIds.length ? await prisma.room.findMany({ where: { id: { in: roomIds } }, select: { id: true, number: true } }) : [];
  const sById = new Map(students.map((s) => [s.id, s]));
  const pById = new Map(properties.map((p) => [p.id, p.name]));
  const rById = new Map(rooms.map((r) => [r.id, r.number]));
  const iso = (d) => (d ? d.toISOString() : undefined);
  return rows.map((a) => {
    const s = sById.get(a.studentId);
    return {
      id: a.id, propertyId: a.propertyId, studentId: a.studentId, type: a.type, message: a.message, location: a.location,
      status: a.status, acknowledgedBy: a.acknowledgedBy ?? undefined, acknowledgedAt: iso(a.acknowledgedAt),
      resolvedBy: a.resolvedBy ?? undefined, resolvedAt: iso(a.resolvedAt), resolutionNote: a.resolutionNote ?? undefined,
      createdAt: a.createdAt.toISOString(),
      studentName: s?.name ?? "Unknown", roomNumber: s?.roomId ? rById.get(s.roomId) : undefined, propertyName: pById.get(a.propertyId) ?? "—",
    };
  });
}
const one = async (row) => (await views([row]))[0];

/**
 * A resident raises an alert. Every manager of the property and every owner of
 * the organization is notified in the app immediately, and by email when email
 * is set up (an email failure never blocks the alert).
 */
export async function raise(auth, actorName, { type, message, location }) {
  requireRole(auth, "student");
  const s = await prisma.studentProfile.findUnique({ where: { id: auth.studentId } });
  if (!message?.trim()) throw invalid({ message: "Describe what is happening" });
  const open = await prisma.emergencyAlert.count({ where: { studentId: s.id, status: { in: ["open", "acknowledged"] } } });
  if (open >= MAX_OPEN) throw conflict("You already have open alerts. The office has been notified; call 112 if you are in danger.");

  let where = location?.trim();
  if (!where) {
    const [room, bed] = await Promise.all([
      s.roomId ? prisma.room.findUnique({ where: { id: s.roomId }, select: { number: true } }) : null,
      s.bedId ? prisma.bed.findUnique({ where: { id: s.bedId }, select: { label: true } }) : null,
    ]);
    where = room ? `Room ${room.number}${bed ? `, Bed ${bed.label}` : ""}` : "Location not given";
  }

  const { alert, recipients } = await prisma.$transaction(async (tx) => {
    const a = await tx.emergencyAlert.create({ data: { propertyId: s.propertyId, studentId: s.id, type, message: message.trim(), location: where } });
    const staff = await tx.user.findMany({
      where: {
        disabledAt: null,
        OR: [{ role: "manager", propertyId: s.propertyId }, { role: "owner", orgId: auth.orgId }],
      },
      select: { id: true, role: true, email: true },
    });
    const title = `EMERGENCY: ${TYPE_LABEL[type]} – ${s.name}`;
    const body = `${where}: ${message.trim()}`;
    await notifyUsers(tx, staff.filter((u) => u.role === "manager").map((u) => u.id), title, body, "system", "/manager/dashboard");
    await notifyUsers(tx, staff.filter((u) => u.role === "owner").map((u) => u.id), title, body, "system", "/owner/dashboard");
    await logActivity(tx, auth, actorName, "student", `${s.name} raised a ${TYPE_LABEL[type].toLowerCase()} emergency alert (${where})`, s.propertyId, "/manager/dashboard");
    return { alert: a, recipients: staff };
  });

  if (mailEnabled()) {
    for (const u of recipients) {
      sendMail({
        to: u.email,
        subject: `EMERGENCY at your hostel: ${TYPE_LABEL[type]} – ${s.name}`,
        text: `${s.name} raised an emergency alert.\n\nType: ${TYPE_LABEL[type]}\nWhere: ${where}\nMessage: ${message.trim()}\nPhone: ${s.phone}\n\nOpen Meraki to acknowledge it.`,
      }).catch((err) => console.error("Emergency email failed:", err.message));
    }
  }
  return one(alert);
}

export async function list(auth, filters = {}) {
  const where = auth.role === "student" ? { studentId: auth.studentId } : await propertyScope(auth, filters.propertyId);
  if (filters.status) where.status = filters.status;
  const rows = await prisma.emergencyAlert.findMany({ where, orderBy: { createdAt: "desc" }, take: 200 });
  return views(rows);
}

async function staffAlert(auth, id) {
  requireRole(auth, "owner", "manager");
  const a = await prisma.emergencyAlert.findUnique({ where: { id } });
  if (!a) throw notFound("Alert");
  await assertPropertyAccess(auth, a.propertyId);
  return a;
}

export async function acknowledge(auth, actorName, id) {
  const a = await staffAlert(auth, id);
  const updated = await prisma.$transaction(async (tx) => {
    const { count } = await tx.emergencyAlert.updateMany({ where: { id, status: "open" }, data: { status: "acknowledged", acknowledgedBy: actorName, acknowledgedAt: new Date() } });
    if (!count) throw conflict("Only an open alert can be acknowledged.");
    await notifyStudentUsers(tx, a.studentId, "Help is on the way", `${actorName} has seen your alert and is responding.`, "system", "/student/emergency");
    await logActivity(tx, auth, actorName, "student", `Emergency alert acknowledged by ${actorName}`, a.propertyId, "/manager/dashboard");
    return tx.emergencyAlert.findUnique({ where: { id } });
  });
  return one(updated);
}

export async function resolve(auth, actorName, id, note) {
  const a = await staffAlert(auth, id);
  const updated = await prisma.$transaction(async (tx) => {
    const { count } = await tx.emergencyAlert.updateMany({
      where: { id, status: { in: ["open", "acknowledged"] } },
      data: { status: "resolved", resolvedBy: actorName, resolvedAt: new Date(), resolutionNote: note?.trim() || null, ...(a.acknowledgedAt ? {} : { acknowledgedBy: actorName, acknowledgedAt: new Date() }) },
    });
    if (!count) throw conflict("This alert is already resolved.");
    await notifyStudentUsers(tx, a.studentId, "Alert resolved", note?.trim() ? `Your alert was resolved: ${note.trim()}` : "Your alert was marked resolved.", "system", "/student/emergency");
    await logActivity(tx, auth, actorName, "student", `Emergency alert resolved by ${actorName}`, a.propertyId, "/manager/dashboard");
    return tx.emergencyAlert.findUnique({ where: { id } });
  });
  return one(updated);
}
