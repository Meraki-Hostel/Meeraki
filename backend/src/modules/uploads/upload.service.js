import { randomUUID } from "node:crypto";
import { prisma } from "../../config/prisma.js";
import { env } from "../../config/env.js";
import { invalid, notFound, forbidden, conflict } from "../../utils/ApiError.js";
import { requireRole, assertPropertyAccess } from "../../utils/scope.js";
import { storage } from "../../services/storage.js";

// What each kind of upload may be. Checked when the upload link is issued AND
// again against the stored object before the file is accepted.
export const ALLOWED = {
  document: { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png" },
  complaint: { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "video/mp4": "mp4", "video/quicktime": "mov" },
};
const maxBytes = () => env.storage.maxMb * 1024 * 1024;

export const uploadView = (u) => ({ id: u.id, fileName: u.fileName, contentType: u.contentType, sizeKb: Math.max(1, Math.round(u.sizeBytes / 1024)) });

/**
 * Issues a short-lived upload link for one file. Students upload their own
 * documents and complaint photos. The object key holds ids only (no names).
 */
export async function createUpload(auth, { purpose, fileName, contentType, sizeBytes }) {
  requireRole(auth, "student");
  const s = await prisma.studentProfile.findUnique({ where: { id: auth.studentId }, select: { propertyId: true } });
  const e = {};
  const ext = ALLOWED[purpose]?.[contentType];
  if (!ext) e.file = purpose === "document" ? "Upload a PDF, JPG or PNG file" : "Upload a photo (JPG, PNG, WebP) or a short MP4/MOV video";
  if (!(Number.isInteger(sizeBytes) && sizeBytes > 0)) e.file = "The file is empty";
  else if (sizeBytes > maxBytes()) e.file = `The file is larger than ${env.storage.maxMb} MB`;
  if (Object.keys(e).length) throw invalid(e);

  const id = randomUUID();
  const key = `org/${auth.orgId}/property/${s.propertyId}/${purpose}s/${auth.userId}/${id}.${ext}`;
  const target = await storage().createUploadUrl({ key, contentType, sizeBytes });
  await prisma.upload.create({
    data: { id, key, purpose, orgId: auth.orgId, propertyId: s.propertyId, ownerUserId: auth.userId, fileName: fileName.trim().slice(0, 120) || `file.${ext}`, contentType, sizeBytes },
  });
  return { uploadId: id, ...target, maxBytes: maxBytes(), expiresIn: env.storage.signedUrlTtl };
}

/**
 * Accepts an upload only when the stored object exists and matches the size and
 * type that were signed. A mismatch deletes the object. Idempotent.
 */
export async function confirmUpload(auth, id, purpose) {
  const u = await prisma.upload.findUnique({ where: { id } });
  if (!u || u.ownerUserId !== auth.userId || (purpose && u.purpose !== purpose)) throw notFound("Upload");
  if (u.confirmedAt) return u;
  const stored = await storage().head(u.key);
  if (!stored) throw invalid({ file: "The file did not finish uploading. Try again." });
  if (stored.sizeBytes !== u.sizeBytes || (stored.contentType && stored.contentType !== u.contentType)) {
    await storage().remove(u.key).catch(() => {});
    await prisma.upload.delete({ where: { id: u.id } }).catch(() => {});
    throw invalid({ file: "The uploaded file did not match what was expected. Try again." });
  }
  return prisma.upload.update({ where: { id: u.id }, data: { confirmedAt: new Date() } });
}

/** Confirms several of the caller's uploads at once (complaint photos). */
export async function confirmMany(auth, ids, purpose) {
  if (ids.length > 3) throw invalid({ attachments: "Attach at most 3 files" });
  const out = [];
  for (const id of ids) {
    const u = await confirmUpload(auth, id, purpose);
    if (u.complaintId) throw conflict("A file is already attached to another complaint.");
    out.push(u);
  }
  return out;
}

/** Short-lived download link, after checking the caller may see the file. */
export async function downloadUrl(auth, id) {
  const u = await prisma.upload.findUnique({ where: { id }, include: { complaint: { select: { studentId: true } }, document: { select: { studentId: true } } } });
  if (!u || !u.confirmedAt) throw notFound("File");
  if (auth.role === "student") {
    const own = u.ownerUserId === auth.userId || u.complaint?.studentId === auth.studentId || u.document?.studentId === auth.studentId;
    if (!own) throw forbidden();
  } else {
    await assertPropertyAccess(auth, u.propertyId);
  }
  return { url: await storage().createDownloadUrl(u.key, u.fileName), fileName: u.fileName, contentType: u.contentType, expiresIn: env.storage.signedUrlTtl };
}

/** Removes an object and its row (replaced document, failed upload, cleanup job). */
export async function deleteUpload(u) {
  await storage().remove(u.key).catch((err) => console.error(`Could not delete stored file ${u.id}:`, err.message));
  await prisma.upload.deleteMany({ where: { id: u.id } });
}

/** Cleanup job: uploads issued more than a day ago and never confirmed. */
export async function purgeAbandoned(olderThanMs = 24 * 60 * 60 * 1000) {
  const stale = await prisma.upload.findMany({ where: { confirmedAt: null, createdAt: { lt: new Date(Date.now() - olderThanMs) } }, take: 500 });
  for (const u of stale) await deleteUpload(u);
  return stale.length;
}
