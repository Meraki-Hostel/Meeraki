import { prisma } from "../../config/prisma.js";
import { invalid, notFound, forbidden, conflict } from "../../utils/ApiError.js";
import { requireRole, propertyScope, assertPropertyAccess } from "../../utils/scope.js";
import { logActivity, notifyStudentUsers, notifyStaffUsers, nextCounter } from "../../utils/effects.js";

const STAFF_LINK = "/manager/complaints";
const OWNER_LINK = "/owner/complaints";
const STUDENT_LINK = "/student/complaints";
const statusLabel = (s) => s.replace("_", " ");

const withThread = {
  comments: { orderBy: { createdAt: "asc" } },
  history: { orderBy: { at: "asc" } },
};

// A student login without a resident profile must never fall through to an
// unfiltered query (Prisma ignores `studentId: undefined`).
function ownStudentId(auth) {
  if (!auth.studentId) throw forbidden();
  return auth.studentId;
}

// ── Shared helpers ───────────────────────────────────────────────────────────
// Display names for exactly the rows being returned (never a scan of every tenant's data).
async function lookupsFor(rows) {
  const ids = (key) => [...new Set(rows.map((r) => r[key]).filter(Boolean))];
  const [students, properties, rooms, staff] = await Promise.all([
    prisma.studentProfile.findMany({ where: { id: { in: ids("studentId") } }, select: { id: true, name: true } }),
    prisma.property.findMany({ where: { id: { in: ids("propertyId") } }, select: { id: true, name: true } }),
    prisma.room.findMany({ where: { id: { in: ids("roomId") } }, select: { id: true, number: true } }),
    prisma.staffMember.findMany({ where: { id: { in: ids("assigneeStaffId") } }, select: { id: true, name: true } }),
  ]);
  const byId = (list, field) => new Map(list.map((x) => [x.id, x[field]]));
  return {
    sById: byId(students, "name"), pById: byId(properties, "name"),
    rById: byId(rooms, "number"), aById: byId(staff, "name"),
  };
}

// Internal notes are staff-only: a resident never receives them, from any endpoint.
// Absent optional fields are omitted rather than null, matching domain.ts.
function toView(c, lk, includeInternal) {
  return {
    ...c,
    roomId: c.roomId ?? undefined,
    assigneeStaffId: c.assigneeStaffId ?? undefined,
    comments: c.comments.filter((x) => includeInternal || !x.internal),
    history: c.history.map((h) => ({ ...h, note: h.note ?? undefined })),
    studentName: lk.sById.get(c.studentId) ?? "Unknown",
    propertyName: lk.pById.get(c.propertyId) ?? "—",
    roomNumber: c.roomId ? lk.rById.get(c.roomId) : undefined,
    assigneeName: c.assigneeStaffId ? lk.aById.get(c.assigneeStaffId) : undefined,
  };
}

async function views(auth, rows) {
  const lk = await lookupsFor(rows);
  return rows.map((c) => toView(c, lk, auth.role !== "student"));
}

// One complaint the caller may see: their own as a student, their property's as staff.
async function loadVisible(auth, id) {
  const c = await prisma.complaint.findUnique({ where: { id }, include: withThread });
  if (!c) throw notFound("Complaint");
  if (auth.role === "student") {
    if (c.studentId !== ownStudentId(auth)) throw forbidden();
  } else {
    await assertPropertyAccess(auth, c.propertyId);
  }
  return c;
}

// Serialises writes to one complaint, so two staff updates cannot both act on a stale status.
async function lockComplaint(tx, id) {
  await tx.$queryRaw`SELECT "id" FROM "Complaint" WHERE "id" = ${id} FOR UPDATE`;
  return tx.complaint.findUnique({ where: { id } });
}

// ── Reads ────────────────────────────────────────────────────────────────────
export async function list(auth, filters = {}) {
  const where = auth.role === "student"
    ? { studentId: ownStudentId(auth) }
    : { ...(await propertyScope(auth, filters.propertyId)) };
  if (filters.status) where.status = filters.status;
  if (filters.priority) where.priority = filters.priority;
  if (filters.category) where.category = filters.category;

  const rows = await prisma.complaint.findMany({ where, include: withThread, orderBy: { updatedAt: "desc" } });
  return views(auth, rows);
}

export async function get(auth, id) {
  const [view] = await views(auth, [await loadVisible(auth, id)]);
  return view;
}

// ── Writes ───────────────────────────────────────────────────────────────────
export async function create(auth, actorName, input) {
  requireRole(auth, "student");
  const st = await prisma.studentProfile.findUnique({
    where: { id: ownStudentId(auth) }, select: { id: true, name: true, propertyId: true, roomId: true },
  });
  if (!st) throw notFound("Student");

  const id = await prisma.$transaction(async (tx) => {
    const ticketNo = `CMP-${String(await nextCounter(tx, "complaint")).padStart(4, "0")}`;
    const c = await tx.complaint.create({
      data: {
        ticketNo, propertyId: st.propertyId, studentId: st.id, roomId: st.roomId,
        category: input.category, title: input.title, description: input.description,
        priority: input.priority, attachments: input.attachments,
        history: { create: { status: "open", changedBy: actorName } },
      },
    });
    await logActivity(tx, auth, actorName, "complaint", `Raised complaint ${ticketNo}: ${input.title}`, st.propertyId, STAFF_LINK);
    await notifyStaffUsers(tx, st.propertyId, `New ${input.priority} complaint`, `${st.name}: ${input.title}`, "complaint",
      STAFF_LINK, input.priority === "urgent" ? OWNER_LINK : undefined);
    return c.id;
  });
  return get(auth, id);
}

// Triage by staff. A status change is recorded in the history (with the note, if
// any); a note without a status change is posted as a reply to the resident.
export async function update(auth, actorName, id, patch) {
  requireRole(auth, "owner", "manager");
  const current = await loadVisible(auth, id);

  let assigneeName = null;
  if (patch.assigneeStaffId) {
    const s = await prisma.staffMember.findUnique({ where: { id: patch.assigneeStaffId }, select: { name: true, propertyId: true, status: true } });
    if (!s || s.propertyId !== current.propertyId || s.status === "inactive")
      throw invalid({ assigneeStaffId: "Assignee must be active staff at this property" });
    assigneeName = s.name;
  }

  await prisma.$transaction(async (tx) => {
    const x = await lockComplaint(tx, id);
    const data = {};
    const changes = [];
    const note = patch.note?.trim();

    if (patch.priority && patch.priority !== x.priority) {
      data.priority = patch.priority;
      changes.push(`priority → ${patch.priority}`);
    }
    if (patch.assigneeStaffId !== undefined && (patch.assigneeStaffId || null) !== x.assigneeStaffId) {
      data.assigneeStaffId = patch.assigneeStaffId || null;
      changes.push(`assigned to ${assigneeName ?? "nobody"}`);
    }
    if (patch.status && patch.status !== x.status) {
      data.status = patch.status;
      data.history = { create: { status: patch.status, changedBy: actorName, note: note || null } };
      changes.push(`status → ${statusLabel(patch.status)}`);
      await notifyStudentUsers(tx, x.studentId, "Complaint update", `“${x.title}” is now ${statusLabel(patch.status)}.`, "complaint", STUDENT_LINK);
    } else if (note) {
      data.comments = { create: { authorName: actorName, authorRole: auth.role, body: note } };
      await notifyStudentUsers(tx, x.studentId, "New reply on your complaint", note.slice(0, 90), "complaint", STUDENT_LINK);
    }

    if (Object.keys(data).length) await tx.complaint.update({ where: { id }, data });
    if (changes.length) await logActivity(tx, auth, actorName, "complaint", `${x.ticketNo}: ${changes.join(", ")}`, x.propertyId, STAFF_LINK);
  });
  return get(auth, id);
}

export async function addComment(auth, actorName, id, { body, internal }) {
  const c = await loadVisible(auth, id);
  if (auth.role === "student" && internal) throw forbidden("Students cannot add internal notes.");
  if (auth.role === "student" && c.status === "closed") throw conflict("This complaint is closed. Raise a new one if the issue is back.");

  await prisma.$transaction(async (tx) => {
    await tx.complaint.update({
      where: { id },
      data: { comments: { create: { authorName: actorName, authorRole: auth.role, body, internal } } },
    });
    if (auth.role === "student")
      await notifyStaffUsers(tx, c.propertyId, `Reply on ${c.ticketNo}`, `${actorName}: ${body.slice(0, 80)}`, "complaint", STAFF_LINK);
    else if (!internal)
      await notifyStudentUsers(tx, c.studentId, "New reply on your complaint", body.slice(0, 90), "complaint", STUDENT_LINK);
  });
  return get(auth, id);
}
