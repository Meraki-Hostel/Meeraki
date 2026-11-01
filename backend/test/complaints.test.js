import "./helpers/env.js";
import { describe, test, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { prisma, resetDb, seedWorld, seedOtherOrg, disconnect } from "./helpers/db.js";
import { as, rawRequest } from "./helpers/api.js";

let w, x;
beforeEach(async () => { await resetDb(); w = await seedWorld(); x = await seedOtherOrg(); });
after(async () => { await resetDb(); await disconnect(); });

const raise = async (user = w.users.studentA, over = {}) =>
  (await as(user)).post("/complaints", { category: "plumbing", title: "Tap leaking", description: "Bathroom tap drips all night", priority: "medium", ...over });
const staffOf = (property, name = "Ravi Fixit") =>
  prisma.staffMember.create({ data: { orgId: property.orgId, propertyId: property.id, name, role: "maintenance", phone: "9800000009", email: "", joinedOn: new Date() } });

describe("complaints: raising and reading", () => {
  test("a resident raises a complaint; it gets a ticket number, history and notifies the manager", async () => {
    const res = await raise();
    assert.equal(res.status, 201, JSON.stringify(res.body));
    const c = res.body.data;
    assert.match(c.ticketNo, /^CMP-\d{4}$/);
    assert.equal(c.status, "open");
    assert.equal(c.propertyId, w.A.id);
    assert.equal(c.roomId, w.roomA.room.id);
    assert.equal(c.roomNumber, "101");
    assert.equal(c.studentName, "Resident A");
    assert.equal(c.history.length, 1);
    assert.deepEqual(c.attachments, []);
    assert.equal(await prisma.notification.count({ where: { recipientUserId: w.users.managerA.id, category: "complaint" } }), 1);
    assert.equal(await prisma.notification.count({ where: { recipientUserId: w.users.managerB.id } }), 0);
  });

  test("staff cannot raise complaints; validation names fields", async () => {
    assert.equal((await raise(w.users.managerA)).status, 403);
    const bad = await raise(w.users.studentA, { title: "x", description: "" });
    assert.equal(bad.status, 422);
    assert.ok(bad.body.error.fieldErrors.title && bad.body.error.fieldErrors.description);
  });

  test("urgent complaints reach owners who opted in", async () => {
    await raise(w.users.studentA, { priority: "urgent" });
    assert.equal(await prisma.notification.count({ where: { recipientUserId: w.users.owner.id, title: "Urgent complaint" } }), 1);
    await prisma.organization.update({ where: { id: w.org.id }, data: { settings: { notifications: { newComplaint: false } } } });
    await raise(w.users.studentA, { priority: "urgent", title: "Sparking socket" });
    assert.equal(await prisma.notification.count({ where: { recipientUserId: w.users.owner.id, title: "Urgent complaint" } }), 1);
  });

  test("scope: students see only their own; managers only their property; other orgs 404", async () => {
    const a = (await raise()).body.data;
    const b = (await raise(w.users.studentB)).body.data;
    const sa = await as(w.users.studentA);
    assert.deepEqual((await sa.get("/complaints")).body.data.map((c) => c.id), [a.id]);
    assert.equal((await sa.get(`/complaints/${b.id}`)).status, 403);
    const ma = await as(w.users.managerA);
    assert.deepEqual((await ma.get("/complaints")).body.data.map((c) => c.id), [a.id]);
    assert.equal((await ma.get(`/complaints/${b.id}`)).status, 403);
    assert.equal((await ma.patch(`/complaints/${b.id}`, { status: "in_progress" })).status, 403);
    const owner = await as(w.users.owner);
    assert.equal((await owner.get("/complaints")).body.data.length, 2);
    assert.equal((await owner.get("/complaints", { propertyId: w.B.id })).body.data.length, 1);
    assert.equal((await (await as(x.users.ownerX)).get(`/complaints/${a.id}`)).status, 404);
    assert.equal((await owner.get("/complaints", { status: "resolved" })).body.data.length, 0);
  });
});

describe("complaints: staff handling", () => {
  test("status changes follow the allowed transitions and record history", async () => {
    const c = (await raise()).body.data;
    const ma = await as(w.users.managerA);
    const res = await ma.patch(`/complaints/${c.id}`, { status: "in_progress", note: "Plumber called" });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.status, "in_progress");
    assert.equal(res.body.data.history.at(-1).note, "Plumber called");
    assert.equal((await ma.patch(`/complaints/${c.id}`, { status: "resolved" })).status, 200);
    assert.equal((await ma.patch(`/complaints/${c.id}`, { status: "in_progress" })).status, 200, "reopen from resolved");
    assert.equal((await ma.patch(`/complaints/${c.id}`, { status: "closed" })).status, 200);
    assert.equal((await ma.patch(`/complaints/${c.id}`, { status: "open" })).status, 409, "closed is final");
    const n = await prisma.notification.count({ where: { recipientUserId: w.users.studentA.id, category: "complaint" } });
    assert.ok(n >= 4, `student got ${n} complaint notifications`);
  });

  test("students cannot change status; assignee must be active staff of the same property", async () => {
    const c = (await raise()).body.data;
    assert.equal((await (await as(w.users.studentA)).patch(`/complaints/${c.id}`, { status: "closed" })).status, 403);
    const ma = await as(w.users.managerA);
    const own = await staffOf(w.A);
    const elsewhere = await staffOf(w.B, "Other Hostel Guy");
    const bad = await ma.patch(`/complaints/${c.id}`, { assigneeStaffId: elsewhere.id });
    assert.equal(bad.status, 422);
    assert.ok(bad.body.error.fieldErrors.assigneeStaffId);
    const ok = await ma.patch(`/complaints/${c.id}`, { assigneeStaffId: own.id });
    assert.equal(ok.body.data.assigneeName, "Ravi Fixit");
    assert.equal((await ma.patch(`/complaints/${c.id}`, { assigneeStaffId: null })).body.data.assigneeStaffId, undefined);
  });

  test("internal comments are never shown to the student", async () => {
    const c = (await raise()).body.data;
    const ma = await as(w.users.managerA);
    await ma.post(`/complaints/${c.id}/comments`, { body: "Vendor overcharges, use Ravi", internal: true });
    await ma.post(`/complaints/${c.id}/comments`, { body: "We'll fix it today", internal: false });
    const sa = await as(w.users.studentA);
    const forced = await sa.post(`/complaints/${c.id}/comments`, { body: "Thanks!", internal: true });
    assert.equal(forced.status, 200);
    const seen = (await sa.get(`/complaints/${c.id}`)).body.data.comments;
    assert.deepEqual(seen.map((m) => m.body), ["We'll fix it today", "Thanks!"]);
    assert.ok(seen.every((m) => !m.internal));
    assert.ok(forced.body.data.comments.every((m) => !m.internal), "addComment response leaked an internal note");
    assert.ok((await sa.get("/complaints")).body.data[0].comments.every((m) => !m.internal), "list leaked an internal note");
    assert.equal((await ma.get(`/complaints/${c.id}`)).body.data.comments.length, 3);
    assert.equal((await (await as(w.users.studentB)).post(`/complaints/${c.id}/comments`, { body: "hi" })).status, 403);
  });

  test("two staff changing the same complaint at once: one wins, the other is told", async () => {
    const c = (await raise()).body.data;
    const [m1, m2] = [await as(w.users.managerA), await as(w.users.owner)];
    const res = await Promise.all([m1.patch(`/complaints/${c.id}`, { status: "resolved" }), m2.patch(`/complaints/${c.id}`, { status: "closed" })]);
    const codes = res.map((r) => r.status).sort();
    assert.ok(codes.includes(200), `codes ${codes}`);
    const final = await prisma.complaint.findUnique({ where: { id: c.id } });
    assert.ok(["resolved", "closed"].includes(final.status));
  });
});

describe("complaints: photo attachments", () => {
  async function upload(user, bytes = Buffer.from("fake-jpeg-bytes"), contentType = "image/jpeg") {
    const s = await as(user);
    const res = await s.post("/uploads", { purpose: "complaint", fileName: "leak.jpg", contentType, sizeBytes: bytes.length });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    const put = await rawRequest().put(new URL(res.body.data.url).pathname).set("Content-Type", contentType).send(bytes);
    assert.equal(put.status, 200);
    return res.body.data.uploadId;
  }

  test("an uploaded photo is attached and listed by name", async () => {
    const id = await upload(w.users.studentA);
    const res = await raise(w.users.studentA, { attachments: [id] });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.deepEqual(res.body.data.attachments, ["leak.jpg"]);
    assert.equal(res.body.data.attachmentFiles[0].id, id);
    assert.equal((await prisma.upload.findUnique({ where: { id } })).complaintId, res.body.data.id);
    const url = await (await as(w.users.managerA)).get(`/uploads/${id}/url`);
    assert.equal(url.status, 200);
    assert.equal((await (await as(w.users.managerB)).get(`/uploads/${id}/url`)).status, 403);
  });

  test("someone else's upload or a never-uploaded file cannot be attached", async () => {
    const theirs = await upload(w.users.studentB);
    assert.equal((await raise(w.users.studentA, { attachments: [theirs] })).status, 404);
    const s = await as(w.users.studentA);
    const issued = await s.post("/uploads", { purpose: "complaint", fileName: "x.jpg", contentType: "image/jpeg", sizeBytes: 10 });
    const res = await raise(w.users.studentA, { attachments: [issued.body.data.uploadId] });
    assert.equal(res.status, 422);
    assert.equal(await prisma.complaint.count(), 0);
  });

  test("a file can only be attached to one complaint", async () => {
    const id = await upload(w.users.studentA);
    assert.equal((await raise(w.users.studentA, { attachments: [id] })).status, 201);
    assert.equal((await raise(w.users.studentA, { attachments: [id] })).status, 409);
  });
});
