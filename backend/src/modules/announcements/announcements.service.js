import { prisma } from "../../config/prisma.js";
import { invalid, notFound, conflict, forbidden } from "../../utils/ApiError.js";
import { requireRole, assertPropertyAccess, propertyScope } from "../../utils/scope.js";
import { logActivity, notifyUsers } from "../../utils/sideEffects.js";

// Audience: everyone, some floors (values = floor numbers as strings) or some rooms
// (values = room numbers). A student without a room only receives "all" notices.
function reaches(a, room) {
  if (a.audienceType === "all") return true;
  if (!room) return false;
  if (a.audienceType === "floors") return a.audienceValues.includes(String(room.floor));
  return a.audienceValues.includes(String(room.number));
}

function view(a, pName, { studentId, readers } = {}) {
  const readBy = studentId ? (readers.has(studentId) ? [studentId] : []) : [...readers];
  return {
    id: a.id, propertyId: a.propertyId, title: a.title, body: a.body, category: a.category,
    audience: { type: a.audienceType, values: a.audienceValues }, status: a.status, author: a.author,
    createdAt: a.createdAt.toISOString(), publishedAt: a.publishedAt?.toISOString(),
    readBy, propertyName: pName.get(a.propertyId) ?? "—",
    ...(studentId ? { isRead: readers.has(studentId) } : {}),
  };
}

async function views(rows, studentId) {
  const ids = rows.map((r) => r.id);
  const [props, reads] = await Promise.all([
    prisma.property.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.propertyId))] } }, select: { id: true, name: true } }),
    prisma.announcementRead.findMany({ where: { announcementId: { in: ids }, ...(studentId ? { studentId } : {}) } }),
  ]);
  const pName = new Map(props.map((p) => [p.id, p.name]));
  return rows.map((a) => view(a, pName, { studentId, readers: new Set(reads.filter((r) => r.announcementId === a.id).map((r) => r.studentId)) }));
}

async function studentRoom(studentId) {
  const s = await prisma.studentProfile.findUnique({ where: { id: studentId }, select: { propertyId: true, roomId: true } });
  const room = s?.roomId ? await prisma.room.findUnique({ where: { id: s.roomId }, select: { floor: true, number: true } }) : null;
  return { propertyId: s?.propertyId, room };
}

export async function list(auth, filters = {}) {
  if (auth.role === "student") {
    const { propertyId, room } = await studentRoom(auth.studentId);
    const rows = await prisma.announcement.findMany({ where: { propertyId, status: "published" }, orderBy: { publishedAt: "desc" } });
    return views(rows.filter((a) => reaches(a, room)), auth.studentId);
  }
  const where = await propertyScope(auth, filters.propertyId);
  if (filters.status) where.status = filters.status;
  const rows = await prisma.announcement.findMany({ where, orderBy: { createdAt: "desc" } });
  return views(rows);
}

function checkAudience(audience) {
  if (audience.type !== "all" && !audience.values.length) throw invalid({ audience: "Choose at least one floor or room" });
}

// Users of the residents a published notice reaches.
async function notifyAudience(tx, a) {
  const students = await tx.studentProfile.findMany({ where: { propertyId: a.propertyId, status: { in: ["active", "notice"] } }, select: { id: true, roomId: true } });
  const rooms = await tx.room.findMany({ where: { id: { in: students.map((s) => s.roomId).filter(Boolean) } }, select: { id: true, floor: true, number: true } });
  const roomById = new Map(rooms.map((r) => [r.id, r]));
  const targeted = students.filter((s) => reaches(a, s.roomId ? roomById.get(s.roomId) : null)).map((s) => s.id);
  const users = await tx.user.findMany({ where: { studentId: { in: targeted }, disabledAt: null }, select: { id: true } });
  await notifyUsers(tx, users.map((u) => u.id), a.category === "urgent" ? `Urgent: ${a.title}` : a.title, a.body.slice(0, 140), "notice", "/student/notices");
}

async function publishInTx(tx, auth, actorName, a) {
  await notifyAudience(tx, a);
  await logActivity(tx, auth, actorName, "announcement", `Notice published: ${a.title}`, a.propertyId, "/manager/announcements");
}

export async function create(auth, actorName, input) {
  requireRole(auth, "owner", "manager");
  const propertyId = auth.role === "owner" ? input.propertyId : auth.propertyId;
  if (!propertyId) throw invalid({ propertyId: "Choose a property" });
  await assertPropertyAccess(auth, propertyId);
  checkAudience(input.audience);
  const a = await prisma.$transaction(async (tx) => {
    const row = await tx.announcement.create({
      data: {
        propertyId, title: input.title.trim(), body: input.body.trim(), category: input.category,
        audienceType: input.audience.type, audienceValues: input.audience.values.map(String),
        status: input.publish ? "published" : "draft", publishedAt: input.publish ? new Date() : null, author: actorName,
      },
    });
    if (input.publish) await publishInTx(tx, auth, actorName, row);
    return row;
  });
  return (await views([a]))[0];
}

async function own(auth, id) {
  requireRole(auth, "owner", "manager");
  const a = await prisma.announcement.findUnique({ where: { id } });
  if (!a) throw notFound("Notice");
  await assertPropertyAccess(auth, a.propertyId);
  return a;
}

export async function update(auth, id, input) {
  const a = await own(auth, id);
  if (a.status === "archived") throw conflict("An archived notice cannot be edited.");
  checkAudience(input.audience);
  const { count } = await prisma.announcement.updateMany({
    where: { id, status: { in: ["draft", "published"] } },
    data: { title: input.title.trim(), body: input.body.trim(), category: input.category, audienceType: input.audience.type, audienceValues: input.audience.values.map(String) },
  });
  if (!count) throw conflict("An archived notice cannot be edited.");
  return (await views([await prisma.announcement.findUnique({ where: { id } })]))[0];
}

export async function publish(auth, actorName, id) {
  const a = await own(auth, id);
  const row = await prisma.$transaction(async (tx) => {
    const { count } = await tx.announcement.updateMany({ where: { id, status: "draft" }, data: { status: "published", publishedAt: new Date() } });
    if (!count) throw conflict(`Only a draft can be published (this notice is ${a.status}).`);
    const fresh = await tx.announcement.findUnique({ where: { id } });
    await publishInTx(tx, auth, actorName, fresh);
    return fresh;
  });
  return (await views([row]))[0];
}

export async function archive(auth, actorName, id) {
  const a = await own(auth, id);
  const row = await prisma.$transaction(async (tx) => {
    const { count } = await tx.announcement.updateMany({ where: { id, status: { in: ["draft", "published"] } }, data: { status: "archived" } });
    if (!count) throw conflict("This notice is already archived.");
    await logActivity(tx, auth, actorName, "announcement", `Notice archived: ${a.title}`, a.propertyId, "/manager/announcements");
    return tx.announcement.findUnique({ where: { id } });
  });
  return (await views([row]))[0];
}

export async function markRead(auth, id, read) {
  if (auth.role !== "student") throw forbidden("Only residents mark notices as read.");
  const { propertyId, room } = await studentRoom(auth.studentId);
  const a = await prisma.announcement.findUnique({ where: { id } });
  if (!a || a.propertyId !== propertyId || a.status !== "published" || !reaches(a, room)) throw notFound("Notice");
  if (read) {
    await prisma.announcementRead.upsert({
      where: { announcementId_studentId: { announcementId: id, studentId: auth.studentId } },
      create: { announcementId: id, studentId: auth.studentId }, update: {},
    });
  } else {
    await prisma.announcementRead.deleteMany({ where: { announcementId: id, studentId: auth.studentId } });
  }
}

export async function markAllRead(auth) {
  if (auth.role !== "student") throw forbidden("Only residents mark notices as read.");
  const { propertyId, room } = await studentRoom(auth.studentId);
  const rows = await prisma.announcement.findMany({ where: { propertyId, status: "published" } });
  const ids = rows.filter((a) => reaches(a, room)).map((a) => a.id);
  if (ids.length) {
    await prisma.announcementRead.createMany({ data: ids.map((announcementId) => ({ announcementId, studentId: auth.studentId })), skipDuplicates: true });
  }
}
