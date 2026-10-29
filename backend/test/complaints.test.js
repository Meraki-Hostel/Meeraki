import "./helpers/env.js";
import { describe, test, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { prisma, resetDb, seedWorld, seedOtherOrg, disconnect } from "./helpers/db.js";
import { as } from "./helpers/api.js";

let w;
beforeEach(async () => { await resetDb(); w = await seedWorld(); });
after(disconnect);

const newComplaint = (over = {}) => ({
  category: "plumbing", priority: "medium", title: "Tap leaking in bathroom",
  description: "The bathroom tap has been dripping since last night.", attachments: [], ...over,
});

async function raise(over) {
  const res = await (await as(w.users.studentA)).post("/complaints", newComplaint(over));
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return res.body.data;
}

const staffAt = (property, over = {}) => prisma.staffMember.create({
  data: {
    orgId: w.org.id, propertyId: property.id, name: "Plumber Raju", role: "maintenance",
    phone: "9800022222", email: `staff${Math.random()}@example.test`, joinedOn: new Date("2025-01-01"), ...over,
  },
});

const notificationsFor = async (user) => prisma.notification.findMany({ where: { recipientUserId: user.id } });

describe("raising a complaint", () => {
  test("a resident raises one: ticket number, their room, open history entry, staff notified", async () => {
    const c = await raise();
    assert.match(c.ticketNo, /^CMP-\d{4}$/);
    assert.equal(c.status, "open");
    assert.equal(c.propertyId, w.A.id);
    assert.equal(c.roomId, w.roomA.room.id);
    assert.equal(c.roomNumber, "101");
    assert.equal(c.studentName, "Resident A");
    assert.deepEqual(c.history.map((h) => h.status), ["open"]);
    assert.equal(c.assigneeStaffId, undefined, "absent fields are omitted, not null");

    assert.equal((await notificationsFor(w.users.managerA)).length, 1);
    assert.equal((await notificationsFor(w.users.managerB)).length, 0, "another hostel's manager is not told");
    assert.equal((await notificationsFor(w.users.owner)).length, 0, "owners only hear about urgent ones");
    assert.equal(await prisma.activityLog.count({ where: { category: "complaint", propertyId: w.A.id } }), 1);
  });

  test("an urgent complaint also notifies the owner", async () => {
    await raise({ priority: "urgent" });
    assert.equal((await notificationsFor(w.users.owner)).length, 1);
  });

  test("ticket numbers are sequential and unique", async () => {
    const a = await raise();
    const b = await raise();
    assert.notEqual(a.ticketNo, b.ticketNo);
    assert.equal(Number(b.ticketNo.slice(4)), Number(a.ticketNo.slice(4)) + 1);
  });

  test("short title and description are field errors", async () => {
    const res = await (await as(w.users.studentA)).post("/complaints", newComplaint({ title: "Tap", description: "leaks" }));
    assert.equal(res.status, 422);
    assert.ok(res.body.error.fieldErrors.title);
    assert.ok(res.body.error.fieldErrors.description);
  });

  test("staff cannot raise a complaint", async () => {
    const res = await (await as(w.users.managerA)).post("/complaints", newComplaint());
    assert.equal(res.status, 403);
  });
});

describe("who sees which complaints", () => {
  test("a resident sees only their own; managers only their hostel; the owner all of theirs", async () => {
    await raise();
    const b = await (await as(w.users.studentB)).post("/complaints", newComplaint({ title: "Wi-Fi down on floor 2" }));
    assert.equal(b.status, 201);

    const ids = async (user, query) => (await (await as(user)).get("/complaints", query)).body.data.map((c) => c.propertyId);
    assert.deepEqual(await ids(w.users.studentA), [w.A.id]);
    assert.deepEqual(await ids(w.users.managerA), [w.A.id]);
    assert.deepEqual(await ids(w.users.managerB), [w.B.id]);
    assert.equal((await ids(w.users.owner)).length, 2);
    assert.deepEqual(await ids(w.users.owner, { propertyId: w.B.id }), [w.B.id]);
  });

  test("filters by status, priority and category", async () => {
    await raise({ priority: "high", category: "electrical" });
    await raise();
    const mgr = await as(w.users.managerA);
    assert.equal((await mgr.get("/complaints", { priority: "high" })).body.data.length, 1);
    assert.equal((await mgr.get("/complaints", { category: "plumbing" })).body.data.length, 1);
    assert.equal((await mgr.get("/complaints", { status: "resolved" })).body.data.length, 0);
  });

  test("another resident, another hostel's manager and another business cannot open it", async () => {
    const c = await raise();
    const x = await seedOtherOrg();
    assert.equal((await (await as(w.users.studentB)).get(`/complaints/${c.id}`)).status, 403);
    assert.equal((await (await as(w.users.managerB)).get(`/complaints/${c.id}`)).status, 403);
    assert.equal((await (await as(x.users.ownerX)).get(`/complaints/${c.id}`)).status, 404, "other tenants get not-found");
    assert.equal((await (await as(x.users.ownerX)).get("/complaints")).body.data.length, 0);
  });

  test("a student login with no resident profile gets nothing, not everything", async () => {
    await raise();
    const orphan = await prisma.user.update({ where: { id: w.users.studentB.id }, data: { studentId: null } });
    const res = await (await as(orphan)).get("/complaints");
    assert.equal(res.status, 403);
  });
});

describe("staff triage", () => {
  test("a status change is recorded with its note and the resident is notified", async () => {
    const c = await raise();
    const res = await (await as(w.users.managerA)).patch(`/complaints/${c.id}`, { status: "in_progress", note: "Plumber on the way" });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.data.status, "in_progress");
    assert.deepEqual(res.body.data.history.map((h) => [h.status, h.note]), [["open", undefined], ["in_progress", "Plumber on the way"]]);
    assert.equal(res.body.data.comments.length, 0, "a status note is not also a comment");
    assert.equal((await notificationsFor(w.users.studentA)).length, 1);
  });

  test("a note without a status change is a reply to the resident", async () => {
    const c = await raise();
    const res = await (await as(w.users.managerA)).patch(`/complaints/${c.id}`, { note: "Can we visit at 5pm?" });
    assert.equal(res.body.data.comments.length, 1);
    assert.equal(res.body.data.comments[0].internal, false);
    assert.equal(res.body.data.comments[0].authorRole, "manager");
  });

  test("assigning: staff of this hostel only, and null unassigns", async () => {
    const c = await raise();
    const mgr = await as(w.users.managerA);
    const here = await staffAt(w.A);
    const there = await staffAt(w.B);
    const gone = await staffAt(w.A, { status: "inactive" });

    const ok = await mgr.patch(`/complaints/${c.id}`, { assigneeStaffId: here.id });
    assert.equal(ok.body.data.assigneeStaffId, here.id);
    assert.equal(ok.body.data.assigneeName, "Plumber Raju");

    for (const s of [there, gone, { id: "no-such-staff" }]) {
      const bad = await mgr.patch(`/complaints/${c.id}`, { assigneeStaffId: s.id });
      assert.equal(bad.status, 422);
      assert.ok(bad.body.error.fieldErrors.assigneeStaffId);
    }

    const cleared = await mgr.patch(`/complaints/${c.id}`, { assigneeStaffId: null });
    assert.equal(cleared.body.data.assigneeStaffId, undefined);
  });

  test("residents cannot triage, and another hostel's manager cannot either", async () => {
    const c = await raise();
    assert.equal((await (await as(w.users.studentA)).patch(`/complaints/${c.id}`, { status: "closed" })).status, 403);
    assert.equal((await (await as(w.users.managerB)).patch(`/complaints/${c.id}`, { status: "closed" })).status, 403);
    assert.equal((await prisma.complaint.findUnique({ where: { id: c.id } })).status, "open");
  });

  test("the owner can triage a complaint in any of their hostels", async () => {
    const c = await raise();
    const res = await (await as(w.users.owner)).patch(`/complaints/${c.id}`, { priority: "high" });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.priority, "high");
  });
});

describe("comments", () => {
  test("internal notes are hidden from the resident on every endpoint", async () => {
    const c = await raise();
    await (await as(w.users.managerA)).post(`/complaints/${c.id}/comments`, { body: "Resident was rude", internal: true });
    await (await as(w.users.managerA)).post(`/complaints/${c.id}/comments`, { body: "Fixing it tomorrow", internal: false });

    const staffView = (await (await as(w.users.managerA)).get(`/complaints/${c.id}`)).body.data;
    assert.equal(staffView.comments.length, 2);

    const stu = await as(w.users.studentA);
    const bodies = (d) => d.comments.map((x) => x.body);
    assert.deepEqual(bodies((await stu.get(`/complaints/${c.id}`)).body.data), ["Fixing it tomorrow"]);
    assert.deepEqual(bodies((await stu.get("/complaints")).body.data[0]), ["Fixing it tomorrow"]);
    const own = await stu.post(`/complaints/${c.id}/comments`, { body: "Thanks!" });
    assert.deepEqual(bodies(own.body.data), ["Fixing it tomorrow", "Thanks!"]);

    assert.equal((await notificationsFor(w.users.studentA)).length, 1, "only the public reply notifies the resident");
  });

  test("a resident cannot post an internal note", async () => {
    const c = await raise();
    const res = await (await as(w.users.studentA)).post(`/complaints/${c.id}/comments`, { body: "secret", internal: true });
    assert.equal(res.status, 403);
  });

  test("a resident's reply notifies the hostel's managers", async () => {
    const c = await raise();
    const before = (await notificationsFor(w.users.managerA)).length;
    await (await as(w.users.studentA)).post(`/complaints/${c.id}/comments`, { body: "Still leaking" });
    assert.equal((await notificationsFor(w.users.managerA)).length, before + 1);
  });

  test("a resident cannot reply to a closed complaint, staff still can", async () => {
    const c = await raise();
    await (await as(w.users.managerA)).patch(`/complaints/${c.id}`, { status: "closed" });
    assert.equal((await (await as(w.users.studentA)).post(`/complaints/${c.id}/comments`, { body: "It's back" })).status, 409);
    assert.equal((await (await as(w.users.managerA)).post(`/complaints/${c.id}/comments`, { body: "Noted" })).status, 201);
  });

  test("an empty comment is a field error", async () => {
    const c = await raise();
    const res = await (await as(w.users.studentA)).post(`/complaints/${c.id}/comments`, { body: "  " });
    assert.equal(res.status, 422);
    assert.ok(res.body.error.fieldErrors.body);
  });
});

describe("property stats", () => {
  test("openComplaints counts open and in-progress complaints of that hostel only", async () => {
    const a = await raise();
    const b = await raise();
    await raise();
    const mgr = await as(w.users.managerA);
    await mgr.patch(`/complaints/${a.id}`, { status: "in_progress" });
    await mgr.patch(`/complaints/${b.id}`, { status: "resolved" });

    const props = (await (await as(w.users.owner)).get("/properties")).body.data;
    const stat = (p) => props.find((x) => x.id === p.id).stats.openComplaints;
    assert.equal(stat(w.A), 2);
    assert.equal(stat(w.B), 0);
  });
});
