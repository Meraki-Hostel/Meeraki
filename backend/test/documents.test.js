import "./helpers/env.js";
import { describe, test, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { prisma, resetDb, seedWorld, seedOtherOrg, disconnect } from "./helpers/db.js";
import { as, rawRequest } from "./helpers/api.js";

let w;
beforeEach(async () => { await resetDb(); w = await seedWorld(); });
after(async () => { await resetDb(); await disconnect(); });

const PDF = Buffer.from("%PDF-1.4\n% test document\n%%EOF\n");

/** POST /uploads, then PUT the bytes to the signed link exactly as a browser would. */
async function uploadFile(client, { buf = PDF, contentType = "application/pdf", sizeBytes = buf.length, putType = contentType, fileName = "id.pdf" } = {}) {
  const res = await client.post("/uploads", { purpose: "document", fileName, contentType, sizeBytes });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  const { uploadId, url, method, headers } = res.body.data;
  assert.equal(method, "PUT");
  assert.equal(headers["Content-Type"], contentType);
  const put = await rawRequest().put(new URL(url).pathname).set("Content-Type", putType).send(buf);
  return { uploadId, putStatus: put.status };
}

async function docOf(client, type = "id_proof") {
  const res = await client.get("/documents/mine");
  assert.equal(res.status, 200);
  return res.body.data.find((d) => d.type === type);
}

describe("documents: listing", () => {
  test("a student gets one record per document type, all missing at first, created once", async () => {
    const st = await as(w.users.studentA);
    const first = (await st.get("/documents/mine")).body.data;
    assert.deepEqual(first.map((d) => d.type), ["id_proof", "admission_letter", "photo", "police_verification", "rent_agreement", "medical"]);
    assert.ok(first.every((d) => d.status === "missing" && d.studentId === w.residentA.id));
    await st.get("/documents/mine");
    assert.equal(await prisma.documentRecord.count({ where: { studentId: w.residentA.id } }), 6);
  });

  test("staff list a resident's documents in scope only", async () => {
    assert.equal((await (await as(w.users.managerA)).get("/documents", { studentId: w.residentA.id })).body.data.length, 6);
    assert.equal((await (await as(w.users.managerB)).get("/documents", { studentId: w.residentA.id })).status, 403);
    const x = await seedOtherOrg();
    assert.equal((await (await as(x.users.ownerX)).get("/documents", { studentId: w.residentA.id })).status, 404);
    assert.equal((await (await as(w.users.studentA)).get("/documents", { studentId: w.residentB.id })).status, 403);
  });
});

describe("documents: upload, review, reject, re-upload", () => {
  test("full cycle with a real stored file", async () => {
    const st = await as(w.users.studentA);
    const mgr = await as(w.users.managerA);
    const doc = await docOf(st);

    const { uploadId, putStatus } = await uploadFile(st);
    assert.equal(putStatus, 200);
    const up = await st.post(`/documents/${doc.id}/upload`, { uploadId });
    assert.equal(up.status, 200, JSON.stringify(up.body));
    assert.equal(up.body.data.status, "uploaded");
    assert.equal(up.body.data.fileName, "id.pdf");
    assert.equal(up.body.data.fileSizeKb, 1);
    assert.ok(up.body.data.uploadedAt);
    assert.equal(JSON.stringify(up.body).includes("org/"), false, "a storage key leaked");
    assert.equal(await prisma.notification.count({ where: { recipientUserId: w.users.managerA.id, title: "Document uploaded" } }), 1);

    // Uploading again while it awaits review is refused.
    const again = await uploadFile(st);
    assert.equal((await st.post(`/documents/${doc.id}/upload`, { uploadId: again.uploadId })).status, 409);

    // The manager downloads the real bytes through a signed link.
    const file = await mgr.get(`/documents/${doc.id}/file`);
    assert.equal(file.status, 200);
    assert.equal(file.body.data.fileName, "id.pdf");
    const bytes = await rawRequest().get(new URL(file.body.data.url).pathname).buffer(true);
    assert.equal(bytes.status, 200);
    assert.equal(Buffer.compare(Buffer.from(bytes.body), PDF), 0);

    // Rejecting needs a note; the student is told why.
    const noNote = await mgr.post(`/documents/${doc.id}/review`, { decision: "rejected" });
    assert.equal(noNote.status, 422);
    assert.ok(noNote.body.error.fieldErrors.note);
    const rej = await mgr.post(`/documents/${doc.id}/review`, { decision: "rejected", note: "Photo is blurry." });
    assert.equal(rej.body.data.status, "rejected");
    assert.equal(rej.body.data.note, "Photo is blurry.");
    assert.equal(await prisma.notification.count({ where: { recipientUserId: w.users.studentA.id, title: "Document rejected" } }), 1);
    assert.equal((await mgr.post(`/documents/${doc.id}/review`, { decision: "verified" })).status, 409, "only an uploaded document can be reviewed");

    // Re-upload replaces the old file, which is deleted from storage.
    const oldUpload = (await prisma.documentRecord.findUnique({ where: { id: doc.id } })).uploadId;
    const second = await uploadFile(st, { fileName: "id-v2.pdf" });
    const re = await st.post(`/documents/${doc.id}/upload`, { uploadId: second.uploadId });
    assert.equal(re.body.data.status, "uploaded");
    assert.equal(re.body.data.note, undefined);
    assert.equal(re.body.data.fileName, "id-v2.pdf");
    assert.equal(await prisma.upload.findUnique({ where: { id: oldUpload } }), null, "the replaced file was not deleted");

    const ver = await mgr.post(`/documents/${doc.id}/review`, { decision: "verified" });
    assert.equal(ver.body.data.status, "verified");
    assert.equal((await st.post(`/documents/${doc.id}/remove`)).status, 409, "a verified document cannot be removed");
  });

  test("a student can remove an uploaded (unverified) file", async () => {
    const st = await as(w.users.studentA);
    const doc = await docOf(st, "photo");
    const { uploadId } = await uploadFile(st, { buf: Buffer.from([0x89, 0x50, 0x4e, 0x47]), contentType: "image/png", fileName: "me.png" });
    await st.post(`/documents/${doc.id}/upload`, { uploadId });
    const rm = await st.post(`/documents/${doc.id}/remove`);
    assert.equal(rm.status, 200);
    assert.equal(rm.body.data.status, "missing");
    assert.equal(rm.body.data.fileName, undefined);
    assert.equal(await prisma.upload.findUnique({ where: { id: uploadId } }), null);
  });
});

describe("documents: what the server refuses", () => {
  test("disallowed type and oversize files are refused before any link is issued", async () => {
    const st = await as(w.users.studentA);
    const exe = await st.post("/uploads", { purpose: "document", fileName: "x.exe", contentType: "application/x-msdownload", sizeBytes: 10 });
    assert.equal(exe.status, 422);
    const big = await st.post("/uploads", { purpose: "document", fileName: "big.pdf", contentType: "application/pdf", sizeBytes: 6 * 1024 * 1024 });
    assert.equal(big.status, 422);
  });

  test("bytes that differ from what was signed are refused at upload", async () => {
    const st = await as(w.users.studentA);
    const wrongSize = await uploadFile(st, { sizeBytes: PDF.length + 5 });
    assert.equal(wrongSize.putStatus, 403);
    const wrongType = await uploadFile(st, { putType: "image/png" });
    assert.equal(wrongType.putStatus, 403);
    const doc = await docOf(st);
    const res = await st.post(`/documents/${doc.id}/upload`, { uploadId: wrongSize.uploadId });
    assert.equal(res.status, 422, "a file that never arrived was accepted");
    assert.equal((await docOf(st)).status, "missing");
  });

  test("another student can neither attach their upload to my document nor read my file", async () => {
    const a = await as(w.users.studentA);
    const b = await as(w.users.studentB);
    const docA = await docOf(a);
    const fromB = await uploadFile(b);
    assert.equal((await b.post(`/documents/${docA.id}/upload`, { uploadId: fromB.uploadId })).status, 403);
    const fromA = await uploadFile(a);
    assert.equal((await a.post(`/documents/${docA.id}/upload`, { uploadId: fromB.uploadId })).status, 404, "B's upload was attached by A");
    await a.post(`/documents/${docA.id}/upload`, { uploadId: fromA.uploadId });
    assert.equal((await b.get(`/documents/${docA.id}/file`)).status, 403);
    assert.equal((await b.get(`/uploads/${fromA.uploadId}/url`)).status, 403);
  });

  test("a manager of another hostel cannot review or download", async () => {
    const st = await as(w.users.studentA);
    const doc = await docOf(st);
    const { uploadId } = await uploadFile(st);
    await st.post(`/documents/${doc.id}/upload`, { uploadId });
    const mgrB = await as(w.users.managerB);
    assert.equal((await mgrB.post(`/documents/${doc.id}/review`, { decision: "verified" })).status, 403);
    assert.equal((await mgrB.get(`/documents/${doc.id}/file`)).status, 403);
    assert.equal((await (await as(w.users.studentA)).post(`/documents/${doc.id}/review`, { decision: "verified" })).status, 403, "a student verified their own document");
  });

  test("an expired or tampered upload link is refused", async () => {
    const st = await as(w.users.studentA);
    const res = await st.post("/uploads", { purpose: "document", fileName: "id.pdf", contentType: "application/pdf", sizeBytes: PDF.length });
    const path = new URL(res.body.data.url).pathname;
    const tampered = path.slice(0, -3) + (path.endsWith("aaa") ? "bbb" : "aaa");
    assert.equal((await rawRequest().put(tampered).set("Content-Type", "application/pdf").send(PDF)).status, 403);
  });
});
