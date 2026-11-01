import { prisma } from "../../config/prisma.js";
import { invalid, notFound, forbidden, conflict } from "../../utils/ApiError.js";
import { requireRole, assertPropertyAccess, propertyScope } from "../../utils/scope.js";
import { nextValue, pad } from "../../utils/counters.js";
import { logActivity, notifyStudentUsers, notifyStaffUsers, notifyUsers } from "../../utils/sideEffects.js";
import { settingsFor } from "../settings/settings.service.js";
import { confirmMany, uploadView } from "../uploads/upload.service.js";

// Which status changes staff may make. Closed is final.
const NEXT = {
  open: ["in_progress", "resolved", "closed"],
  in_progress: ["open", "resolved", "closed"],
  resolved: ["closed", "in_progress"],
  closed: [],
};
const LABEL = { open: "Open", in_progress: "In progress", resolved: "Resolved", closed: "Closed" };
const include = { comments: { orderBy: { createdAt: "asc" } }, history: { orderBy: { at: "asc" } }, attachments: { where: { confirmedAt: { not: null } }, orderBy: { createdAt: "asc" } } };

/** ComplaintView for `auth`: students never see internal comments. */
export async function toViews(auth, rows) {
  const ids = (k) => [...new Set(rows.map((r) => r[k]).filter(Boolean))];
  const [students, props, rooms, staff] = await Promise.all([
    prisma.studentProfile.findMany({ where: { id: { in: ids("studentId") } }, select: { id: true, name: true } }),
    prisma.property.findMany({ where: { id: { in: ids("propertyId") } }, select: { id: true, name: true } }),
    prisma.room.findMany({ where: { id: { in: ids("roomId") } }, select: { id: true, number: true } }),
    prisma.staffMember.findMany({ where: { id: { in: ids("assigneeStaffId") } }, select: { id: true, name: true } }),
  ]);
  const m = (list, f) => new Map(list.map((x) => [x.id, x[f]]));
  const sN = m(students, "name"), pN = m(props, "name"), rN = m(rooms, "number"), aN = m(staff, "name");
  return rows.map((c) => ({
    id: c.id, ticketNo: c.ticketNo, propertyId: c.propertyId, studentId: c.studentId, roomId: c.roomId ?? undefined,
    category: c.category, title: c.title, description: c.description, priority: c.priority, status: c.status,
    assigneeStaffId: c.assigneeStaffId ?? undefined,
    attachments: (c.attachments ?? []).map((u) => u.fileName),
    attachmentFiles: (c.attachments ?? []).map(uploadView),
    comments: (c.comments ?? [])
      .filter((x) => auth.role !== "student" || !x.internal)
      .map((x) => ({ id: x.id, authorName: x.authorName, authorRole: x.authorRole, body: x.body, internal: x.internal, createdAt: x.createdAt.toISOString() })),
    history: (c.history ?? []).map((h) => ({ id: h.id, status: h.status, changedBy: h.changedBy, note: h.note ?? undefined, at: h.at.toISOString() })),
    createdAt: c.createdAt.toISOString(), updatedAt: c.updatedAt.toISOString(),
    studentName: sN.get(c.studentId) ?? "Unknown", propertyName: pN.get(c.propertyId) ?? "—",
    roomNumber: c.roomId ? rN.get(c.roomId) : undefined, assigneeName: c.assigneeStaffId ? aN.get(c.assigneeStaffId) : undefined,
  }));
}

async function loadVisible(auth, id) {
  const c = await prisma.complaint.findUnique({ where: { id }, include });
  if (!c) throw notFound("Complaint");
  if (auth.role === "student") {
    if (c.studentId !== auth.studentId) throw forbidden();
  } else {
    await assertPropertyAccess(auth, c.propertyId);
  }
  return c;
}

const view = async (auth, id) => (await toViews(auth, [await prisma.complaint.findUnique({ where: { id }, include })]))[0];

export async function list(auth, filters = {}) {
  const where = auth.role === "student" ? { studentId: auth.studentId } : await propertyScope(auth, filters.propertyId);
  for (const k of ["status", "priority", "category"]) if (filters[k]) where[k] = filters[k];
  const rows = await prisma.complaint.findMany({ where, include, orderBy: { createdAt: "desc" } });
  return toViews(auth, rows);
}

export async function get(auth, id) {
  return (await toViews(auth, [await loadVisible(auth, id)]))[0];
}

export async function create(auth, actorName, input) {
  requireRole(auth, "student");
  const s = await prisma.studentProfile.findUnique({ where: { id: auth.studentId } });
  if (!s || !["active", "notice"].includes(s.status)) throw conflict("Only current residents can raise complaints.");
  const e = {};
  if (input.title.trim().length < 3) e.title = "Give the complaint a short title";
  if (input.description.trim().length < 5) e.description = "Describe the problem";
  if (Object.keys(e).length) throw invalid(e);
  const uploads = input.attachments.length ? await confirmMany(auth, input.attachments, "complaint") : [];

  const id = await prisma.$transaction(async (tx) => {
    const c = await tx.complaint.create({
      data: {
        ticketNo: `CMP-${pad(await nextValue(tx, "complaint"))}`, propertyId: s.propertyId, studentId: s.id, roomId: s.roomId,
        category: input.category, title: input.title.trim(), description: input.description.trim(), priority: input.priority,
      },
    });
    if (uploads.length) {
      const { count } = await tx.upload.updateMany({ where: { id: { in: uploads.map((u) => u.id) }, complaintId: null }, data: { complaintId: c.id } });
      if (count !== uploads.length) throw conflict("A file is already attached to another complaint.");
    }
    await tx.complaintHistory.create({ data: { complaintId: c.id, status: "open", changedBy: actorName, note: "Complaint raised" } });
    await logActivity(tx, auth, actorName, "complaint", `${s.name} raised complaint ${c.ticketNo}: ${c.title}`, s.propertyId, `/manager/complaints?id=${c.id}`);
    await notifyStaffUsers(tx, s.propertyId, input.priority === "urgent" ? "Urgent complaint" : "New complaint", `${c.ticketNo} · ${c.title} (${s.name})`, "complaint", `/manager/complaints?id=${c.id}`);
    if (input.priority === "urgent") {
      const settings = await settingsFor(auth.orgId, tx);
      if (settings.notifications.newComplaint) {
        const owners = await tx.user.findMany({ where: { orgId: auth.orgId, role: "owner", disabledAt: null }, select: { id: true } });
        await notifyUsers(tx, owners.map((o) => o.id), "Urgent complaint", `${c.ticketNo} · ${c.title}`, "complaint", `/owner/complaints?id=${c.id}`);
      }
    }
    return c.id;
  });
  return view(auth, id);
}

export async function update(auth, actorName, id, patch) {
  requireRole(auth, "owner", "manager");
  const c = await loadVisible(auth, id);
  if (c.status === "closed" && (patch.status || patch.priority || patch.assigneeStaffId !== undefined)) throw conflict("This complaint is closed.");
  if (patch.status && patch.status !== c.status && !NEXT[c.status].includes(patch.status)) {
    throw conflict(`A ${LABEL[c.status].toLowerCase()} complaint cannot be moved to ${LABEL[patch.status].toLowerCase()}.`);
  }
  let assigneeName;
  if (patch.assigneeStaffId) {
    const st = await prisma.staffMember.findUnique({ where: { id: patch.assigneeStaffId } });
    if (!st || st.propertyId !== c.propertyId || st.status === "inactive") throw invalid({ assigneeStaffId: "Choose an active staff member of this property" });
    assigneeName = st.name;
  }

  await prisma.$transaction(async (tx) => {
    const data = {};
    if (patch.priority) data.priority = patch.priority;
    if (patch.assigneeStaffId !== undefined) data.assigneeStaffId = patch.assigneeStaffId || null;
    const statusChange = patch.status && patch.status !== c.status;
    if (statusChange) data.status = patch.status;
    // Guard on the status we read, so two concurrent changes cannot both apply.
    const { count } = await tx.complaint.updateMany({ where: { id, status: c.status }, data: { ...data, updatedAt: new Date() } });
    if (!count) throw conflict("This complaint was just changed by someone else. Refresh and try again.");
    if (statusChange || patch.note?.trim()) {
      await tx.complaintHistory.create({ data: { complaintId: id, status: statusChange ? patch.status : c.status, changedBy: actorName, note: patch.note?.trim() || null } });
    }
    const link = "/student/complaints";
    if (statusChange) {
      await logActivity(tx, auth, actorName, "complaint", `Complaint ${c.ticketNo} marked ${LABEL[patch.status].toLowerCase()}`, c.propertyId, `/manager/complaints?id=${id}`);
      await notifyStudentUsers(tx, c.studentId, patch.status === "resolved" ? "Complaint resolved" : "Complaint update", `${c.ticketNo} “${c.title}” is now ${LABEL[patch.status]}.${patch.note?.trim() ? ` ${patch.note.trim()}` : ""}`, "complaint", link);
    }
    if (assigneeName && patch.assigneeStaffId !== c.assigneeStaffId) {
      await logActivity(tx, auth, actorName, "complaint", `Complaint ${c.ticketNo} assigned to ${assigneeName}`, c.propertyId, `/manager/complaints?id=${id}`);
      await notifyStudentUsers(tx, c.studentId, "Complaint assigned", `${assigneeName} will look into “${c.title}”.`, "complaint", link);
    }
  });
  return view(auth, id);
}

export async function addComment(auth, actorName, id, { body, internal }) {
  const c = await loadVisible(auth, id);
  if (!body.trim()) throw invalid({ body: "Write a message" });
  if (c.status === "closed") throw conflict("This complaint is closed.");
  const isStudent = auth.role === "student";
  const hidden = !isStudent && Boolean(internal);
  await prisma.$transaction(async (tx) => {
    await tx.complaintComment.create({ data: { complaintId: id, authorUserId: auth.userId, authorName: actorName, authorRole: auth.role, body: body.trim(), internal: hidden } });
    await tx.complaint.update({ where: { id }, data: { updatedAt: new Date() } });
    if (isStudent) {
      await notifyStaffUsers(tx, c.propertyId, "Reply on complaint", `${c.ticketNo}: ${body.trim().slice(0, 120)}`, "complaint", `/manager/complaints?id=${id}`);
    } else if (!hidden) {
      await notifyStudentUsers(tx, c.studentId, "Reply from the office", `${c.ticketNo}: ${body.trim().slice(0, 120)}`, "complaint", "/student/complaints");
    }
  });
  return view(auth, id);
}
