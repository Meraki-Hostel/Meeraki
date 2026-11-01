import { prisma } from "../../config/prisma.js";
import { toViews as complaintViews } from "../complaints/complaint.service.js";
import { toViews as leaveViews } from "../leave/leave.service.js";
import { toViews as visitorViews } from "../visitors/visitor.service.js";
import { ensureRecords, view as documentView } from "../documents/documents.service.js";

// The per-student lists on a profile. The caller has already checked that `auth`
// may see this student; complaint views still drop internal notes for students.
export async function studentExtras(auth, student) {
  const id = student.id;
  const include = { comments: { orderBy: { createdAt: "asc" } }, history: { orderBy: { at: "asc" } }, attachments: { where: { confirmedAt: { not: null } } } };
  const [complaints, leaves, visitors, documents] = await Promise.all([
    prisma.complaint.findMany({ where: { studentId: id }, include, orderBy: { createdAt: "desc" } }),
    prisma.leaveRequest.findMany({ where: { studentId: id }, orderBy: { createdAt: "desc" } }),
    prisma.visitorRequest.findMany({ where: { studentId: id }, orderBy: { createdAt: "desc" } }),
    ensureRecords(student),
  ]);
  return {
    complaints: await complaintViews(auth, complaints),
    leaves: await leaveViews(leaves),
    visitors: await visitorViews(visitors),
    documents: documents.map(documentView),
  };
}
