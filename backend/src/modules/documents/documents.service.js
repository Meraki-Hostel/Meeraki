import { prisma } from "../../config/prisma.js";
import { invalid, notFound, forbidden, conflict } from "../../utils/ApiError.js";
import { requireRole, assertPropertyAccess } from "../../utils/scope.js";
import { logActivity, notifyStaffUsers, notifyStudentUsers } from "../../utils/sideEffects.js";
import { confirmUpload, deleteUpload, downloadUrl } from "../uploads/upload.service.js";

export const DOCUMENT_TYPES = ["id_proof", "admission_letter", "photo", "police_verification", "rent_agreement", "medical"];
const LABEL = {
  id_proof: "ID proof", admission_letter: "Admission letter", photo: "Photo",
  police_verification: "Police verification", rent_agreement: "Rent agreement", medical: "Medical certificate",
};

// DocumentRecord as the frontend types it. Storage keys never leave the server.
export function view(d) {
  const u = d.upload;
  return {
    id: d.id, studentId: d.studentId, type: d.type, status: d.status,
    fileName: u?.fileName ?? undefined,
    fileSizeKb: u ? Math.max(1, Math.round(u.sizeBytes / 1024)) : undefined,
    uploadedAt: u?.confirmedAt ? u.confirmedAt.toISOString() : undefined,
    note: d.note ?? undefined,
  };
}

/** One record per document type, created on first look. */
export async function ensureRecords(student) {
  await prisma.documentRecord.createMany({
    data: DOCUMENT_TYPES.map((type) => ({ studentId: student.id, propertyId: student.propertyId, type })),
    skipDuplicates: true,
  });
  const rows = await prisma.documentRecord.findMany({ where: { studentId: student.id }, include: { upload: true } });
  return rows.sort((a, b) => DOCUMENT_TYPES.indexOf(a.type) - DOCUMENT_TYPES.indexOf(b.type));
}

export async function mine(auth) {
  requireRole(auth, "student");
  const s = await prisma.studentProfile.findUnique({ where: { id: auth.studentId } });
  return (await ensureRecords(s)).map(view);
}

export async function forStudent(auth, studentId) {
  if (auth.role === "student") {
    if (studentId && studentId !== auth.studentId) throw forbidden();
    return mine(auth);
  }
  if (!studentId) throw invalid({ studentId: "Choose a resident" });
  const s = await prisma.studentProfile.findUnique({ where: { id: studentId } });
  if (!s) throw notFound("Student");
  await assertPropertyAccess(auth, s.propertyId);
  return (await ensureRecords(s)).map(view);
}

async function ownDoc(auth, docId) {
  const d = await prisma.documentRecord.findUnique({ where: { id: docId }, include: { upload: true } });
  if (!d) throw notFound("Document");
  if (auth.role === "student") {
    if (d.studentId !== auth.studentId) throw forbidden();
  } else {
    await assertPropertyAccess(auth, d.propertyId);
  }
  return d;
}

export async function upload(auth, actorName, docId, uploadId) {
  requireRole(auth, "student");
  const d = await ownDoc(auth, docId);
  if (!["missing", "rejected"].includes(d.status)) throw conflict("This document is already uploaded. Remove it first to replace it.");
  const u = await confirmUpload(auth, uploadId, "document");
  if (await prisma.documentRecord.findFirst({ where: { uploadId: u.id, NOT: { id: d.id } }, select: { id: true } })) {
    throw conflict("This file is already attached to another document.");
  }
  const previous = d.upload;
  const updated = await prisma.$transaction(async (tx) => {
    const { count } = await tx.documentRecord.updateMany({
      where: { id: d.id, status: { in: ["missing", "rejected"] } },
      data: { uploadId: u.id, status: "uploaded", note: null, reviewedBy: null, reviewedAt: null },
    });
    if (!count) throw conflict("This document changed meanwhile. Reload and try again.");
    await logActivity(tx, auth, actorName, "student", `${actorName} uploaded ${LABEL[d.type]}`, d.propertyId, `/manager/students/${d.studentId}`);
    await notifyStaffUsers(tx, d.propertyId, "Document uploaded", `${actorName} uploaded ${LABEL[d.type]} for review.`, "system", `/manager/students/${d.studentId}`);
    return tx.documentRecord.findUnique({ where: { id: d.id }, include: { upload: true } });
  });
  if (previous && previous.id !== u.id) await deleteUpload(previous);
  return view(updated);
}

export async function remove(auth, actorName, docId) {
  requireRole(auth, "student");
  const d = await ownDoc(auth, docId);
  if (d.status !== "uploaded") throw conflict(d.status === "verified" ? "A verified document cannot be removed. Ask the office." : "There is no uploaded file to remove.");
  const updated = await prisma.$transaction(async (tx) => {
    const { count } = await tx.documentRecord.updateMany({ where: { id: d.id, status: "uploaded" }, data: { uploadId: null, status: "missing", note: null } });
    if (!count) throw conflict("This document changed meanwhile. Reload and try again.");
    await logActivity(tx, auth, actorName, "student", `${actorName} removed ${LABEL[d.type]}`, d.propertyId, `/manager/students/${d.studentId}`);
    return tx.documentRecord.findUnique({ where: { id: d.id }, include: { upload: true } });
  });
  if (d.upload) await deleteUpload(d.upload);
  return view(updated);
}

export async function review(auth, actorName, docId, decision, note) {
  requireRole(auth, "owner", "manager");
  const d = await ownDoc(auth, docId);
  if (decision === "rejected" && !note?.trim()) throw invalid({ note: "Tell the resident what is wrong with the file" });
  if (d.status !== "uploaded") throw conflict("Only an uploaded document awaiting review can be verified or rejected.");
  const updated = await prisma.$transaction(async (tx) => {
    const { count } = await tx.documentRecord.updateMany({
      where: { id: d.id, status: "uploaded" },
      data: { status: decision, note: decision === "rejected" ? note.trim() : note?.trim() || null, reviewedBy: actorName, reviewedAt: new Date() },
    });
    if (!count) throw conflict("This document changed meanwhile. Reload and try again.");
    const st = await tx.studentProfile.findUnique({ where: { id: d.studentId }, select: { name: true } });
    await logActivity(tx, auth, actorName, "student", `${LABEL[d.type]} of ${st.name} ${decision}`, d.propertyId, `/manager/students/${d.studentId}`);
    await notifyStudentUsers(tx, d.studentId,
      decision === "verified" ? "Document verified" : "Document rejected",
      decision === "verified" ? `Your ${LABEL[d.type]} has been verified.` : `Your ${LABEL[d.type]} was rejected: ${note.trim()} Please upload a new copy.`,
      "system", "/student/documents");
    return tx.documentRecord.findUnique({ where: { id: d.id }, include: { upload: true } });
  });
  return view(updated);
}

export async function fileUrl(auth, docId) {
  const d = await ownDoc(auth, docId);
  if (!d.uploadId) throw notFound("File");
  return downloadUrl(auth, d.uploadId);
}
