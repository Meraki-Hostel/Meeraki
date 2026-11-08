import { prisma } from "../../config/prisma.js";
import { invalid, notFound, conflict } from "../../utils/ApiError.js";
import { requireRole, assertPropertyAccess, propertyScope } from "../../utils/scope.js";
import { iso } from "../../utils/money.js";
import { logActivity, notifyUsers } from "../../utils/sideEffects.js";

async function views(rows) {
  const props = await prisma.property.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.propertyId))] } }, select: { id: true, name: true } });
  const pName = new Map(props.map((p) => [p.id, p.name]));
  return rows.map((e) => ({
    id: e.id, propertyId: e.propertyId, title: e.title, description: e.description, category: e.category,
    date: iso(e.date), startTime: e.startTime, endTime: e.endTime, location: e.location, capacity: e.capacity,
    expectedAttendance: e.expectedAttendance, status: e.status, createdBy: e.createdBy, propertyName: pName.get(e.propertyId) ?? "—",
  }));
}

function check(e) {
  const errors = {};
  if (e.startTime >= e.endTime) errors.endTime = "End time must be after the start time";
  if (e.expectedAttendance > e.capacity) errors.expectedAttendance = "Expected attendance cannot exceed capacity";
  if (Object.keys(errors).length) throw invalid(errors);
}

export async function list(auth, filters = {}) {
  let where;
  if (auth.role === "student") {
    const s = await prisma.studentProfile.findUnique({ where: { id: auth.studentId }, select: { propertyId: true } });
    where = { propertyId: s.propertyId };
  } else {
    where = await propertyScope(auth, filters.propertyId);
  }
  if (filters.status) where.status = filters.status;
  const rows = await prisma.hostelEvent.findMany({ where, orderBy: [{ date: "asc" }, { startTime: "asc" }] });
  return views(rows);
}

export async function create(auth, actorName, input) {
  requireRole(auth, "owner", "manager");
  const propertyId = auth.role === "owner" ? input.propertyId : auth.propertyId;
  if (!propertyId) throw invalid({ propertyId: "Choose a property" });
  await assertPropertyAccess(auth, propertyId);
  check(input);
  const e = await prisma.$transaction(async (tx) => {
    const row = await tx.hostelEvent.create({
      data: {
        propertyId, title: input.title.trim(), description: input.description.trim(), category: input.category,
        date: new Date(`${input.date}T00:00:00.000Z`), startTime: input.startTime, endTime: input.endTime,
        location: input.location.trim(), capacity: input.capacity, expectedAttendance: input.expectedAttendance, createdBy: actorName,
      },
    });
    await logActivity(tx, auth, actorName, "event", `Event scheduled: ${row.title} on ${input.date}`, propertyId, "/manager/events");
    return row;
  });
  return (await views([e]))[0];
}

async function own(auth, id) {
  requireRole(auth, "owner", "manager");
  const e = await prisma.hostelEvent.findUnique({ where: { id } });
  if (!e) throw notFound("Event");
  await assertPropertyAccess(auth, e.propertyId);
  return e;
}

export async function update(auth, id, input) {
  const e = await own(auth, id);
  if (e.status !== "scheduled") throw conflict(`A ${e.status} event cannot be edited.`);
  const merged = { ...e, ...input };
  check(merged);
  const { propertyId, date, ...rest } = input; // events never move between properties
  const data = { ...rest };
  if (date) data.date = new Date(`${date}T00:00:00.000Z`);
  for (const k of ["title", "description", "location"]) if (typeof data[k] === "string") data[k] = data[k].trim();
  const { count } = await prisma.hostelEvent.updateMany({ where: { id, status: "scheduled" }, data });
  if (!count) throw conflict("This event is no longer scheduled.");
  return (await views([await prisma.hostelEvent.findUnique({ where: { id } })]))[0];
}

export async function setStatus(auth, actorName, id, status) {
  const e = await own(auth, id);
  if (status === "scheduled") throw conflict("An event cannot be moved back to scheduled.");
  const row = await prisma.$transaction(async (tx) => {
    const { count } = await tx.hostelEvent.updateMany({ where: { id, status: "scheduled" }, data: { status } });
    if (!count) throw conflict(`This event is already ${e.status}.`);
    await logActivity(tx, auth, actorName, "event", `Event ${status}: ${e.title}`, e.propertyId, "/manager/events");
    if (status === "cancelled") {
      const students = await tx.studentProfile.findMany({ where: { propertyId: e.propertyId, status: { in: ["active", "notice"] } }, select: { id: true } });
      const users = await tx.user.findMany({ where: { studentId: { in: students.map((s) => s.id) }, disabledAt: null }, select: { id: true } });
      await notifyUsers(tx, users.map((u) => u.id), "Event cancelled", `${e.title} on ${iso(e.date)} has been cancelled.`, "event", "/student");
    }
    return tx.hostelEvent.findUnique({ where: { id } });
  });
  return (await views([row]))[0];
}
