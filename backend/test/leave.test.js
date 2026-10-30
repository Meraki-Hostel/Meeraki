import "./helpers/env.js";
import { describe, test, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { prisma, resetDb, seedWorld, seedOtherOrg, disconnect } from "./helpers/db.js";
import { as } from "./helpers/api.js";
import { todayISO, iso } from "../src/utils/money.js";

let w;
beforeEach(async () => { await resetDb(); w = await seedWorld(); });
after(disconnect);

const inDays = (n) => iso(new Date(new Date(`${todayISO()}T00:00:00.000Z`).getTime() + n * 86_400_000));
const newLeave = (over = {}) => ({
  from: inDays(2), to: inDays(4), destination: "Jaipur", contactPhone: "98765 43210", reason: "Family function", ...over,
});

async function request(over, user = w.users.studentA) {
  const res = await (await as(user)).post("/leave", newLeave(over));
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return res.body.data;
}

const notificationsFor = (user) => prisma.notification.findMany({ where: { recipientUserId: user.id } });

describe("requesting leave", () => {
  test("a resident requests leave: pending, plain dates, normalised phone, managers notified", async () => {
    const l = await request();
    assert.equal(l.status, "pending");
    assert.equal(l.from, inDays(2));
    assert.equal(l.to, inDays(4));
    assert.equal(l.contactPhone, "9876543210");
    assert.equal(l.propertyId, w.A.id);
    assert.equal(l.decidedBy, undefined, "absent fields are omitted, not null");
    assert.equal((await notificationsFor(w.users.managerA)).length, 1);
    assert.equal((await notificationsFor(w.users.managerB)).length, 0);
    assert.equal(await prisma.activityLog.count({ where: { category: "leave", propertyId: w.A.id } }), 1);
  });

  test("a single-day leave (return on the departure date) is allowed", async () => {
    await request({ from: inDays(1), to: inDays(1) });
  });

  test("return before departure is a field error, not a 500", async () => {
    const res = await (await as(w.users.studentA)).post("/leave", newLeave({ from: inDays(5), to: inDays(3) }));
    assert.equal(res.status, 422);
    assert.ok(res.body.error.fieldErrors.to);
  });

  test("departure in the past, over 30 days, bad phone, bad date: field errors", async () => {
    const stu = await as(w.users.studentA);
    const cases = [
      [{ from: inDays(-1) }, "from"],
      [{ to: inDays(40) }, "to"],
      [{ contactPhone: "12345" }, "contactPhone"],
      [{ from: "2026-02-31" }, "from"],
      [{ reason: "x" }, "reason"],
    ];
    for (const [over, field] of cases) {
      const res = await stu.post("/leave", newLeave(over));
      assert.equal(res.status, 422, `${JSON.stringify(over)} → ${res.status}`);
      assert.ok(res.body.error.fieldErrors[field], `${JSON.stringify(over)} should flag ${field}`);
    }
    assert.equal(await prisma.leaveRequest.count(), 0);
  });

  test("overlapping an active request is refused; overlapping a cancelled one is fine", async () => {
    const first = await request();
    const res = await (await as(w.users.studentA)).post("/leave", newLeave({ from: inDays(3), to: inDays(6) }));
    assert.equal(res.status, 422);
    assert.ok(res.body.error.fieldErrors.from);

    await (await as(w.users.studentA)).post(`/leave/${first.id}/cancel`);
    await request({ from: inDays(3), to: inDays(6) });
  });

  test("two simultaneous overlapping requests: exactly one is created", async () => {
    const stu = await as(w.users.studentA);
    const results = await Promise.all([stu.post("/leave", newLeave()), stu.post("/leave", newLeave())]);
    assert.deepEqual(results.map((r) => r.status).sort(), [201, 422]);
    assert.equal(await prisma.leaveRequest.count(), 1);
  });

  test("staff cannot request leave", async () => {
    assert.equal((await (await as(w.users.managerA)).post("/leave", newLeave())).status, 403);
  });
});

describe("deciding", () => {
  test("approve: decided by and at are recorded, the student is notified", async () => {
    const l = await request();
    const res = await (await as(w.users.managerA)).post(`/leave/${l.id}/decision`, { decision: "approved" });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.data.status, "approved");
    assert.equal(res.body.data.decidedBy, "Manager A");
    assert.ok(res.body.data.decidedAt);
    const notes = await notificationsFor(w.users.studentA);
    assert.equal(notes.length, 1);
    assert.equal(notes[0].title, "Leave approved");
  });

  test("reject needs a reason, which the student sees", async () => {
    const l = await request();
    const mgr = await as(w.users.managerA);
    const bare = await mgr.post(`/leave/${l.id}/decision`, { decision: "rejected" });
    assert.equal(bare.status, 422);
    assert.ok(bare.body.error.fieldErrors.reason);

    const res = await mgr.post(`/leave/${l.id}/decision`, { decision: "rejected", reason: "Exams that week" });
    assert.equal(res.body.data.status, "rejected");
    assert.equal(res.body.data.decisionReason, "Exams that week");
    assert.match((await notificationsFor(w.users.studentA))[0].body, /Exams that week/);
  });

  test("only a pending request can be decided (CONFLICT otherwise)", async () => {
    const l = await request();
    const mgr = await as(w.users.managerA);
    await mgr.post(`/leave/${l.id}/decision`, { decision: "approved" });
    const again = await mgr.post(`/leave/${l.id}/decision`, { decision: "rejected", reason: "Changed my mind" });
    assert.equal(again.status, 409);
    assert.equal((await prisma.leaveRequest.findUnique({ where: { id: l.id } })).status, "approved");
  });

  test("residents cannot decide; another hostel's manager cannot either; the owner can", async () => {
    const l = await request();
    assert.equal((await (await as(w.users.studentA)).post(`/leave/${l.id}/decision`, { decision: "approved" })).status, 403);
    assert.equal((await (await as(w.users.managerB)).post(`/leave/${l.id}/decision`, { decision: "approved" })).status, 403);
    assert.equal((await (await as(w.users.owner)).post(`/leave/${l.id}/decision`, { decision: "approved" })).status, 200);
  });
});

describe("cancelling", () => {
  test("a resident cancels their own pending request", async () => {
    const l = await request();
    const res = await (await as(w.users.studentA)).post(`/leave/${l.id}/cancel`);
    assert.equal(res.status, 200);
    assert.equal(res.body.data.status, "cancelled");
  });

  test("only a pending request can be cancelled (CONFLICT otherwise)", async () => {
    const l = await request();
    await (await as(w.users.managerA)).post(`/leave/${l.id}/decision`, { decision: "approved" });
    assert.equal((await (await as(w.users.studentA)).post(`/leave/${l.id}/cancel`)).status, 409);
  });

  test("a decision and a cancellation at the same time: exactly one wins", async () => {
    const l = await request();
    const [d, c] = await Promise.all([
      (await as(w.users.managerA)).post(`/leave/${l.id}/decision`, { decision: "approved" }),
      (await as(w.users.studentA)).post(`/leave/${l.id}/cancel`),
    ]);
    assert.deepEqual([d.status, c.status].sort(), [200, 409]);
  });

  test("another resident and staff cannot cancel someone's request", async () => {
    const l = await request();
    assert.equal((await (await as(w.users.studentB)).post(`/leave/${l.id}/cancel`)).status, 403);
    assert.equal((await (await as(w.users.managerA)).post(`/leave/${l.id}/cancel`)).status, 403);
  });
});

describe("who sees which requests", () => {
  test("a resident sees only their own; managers only their hostel; the owner all of theirs", async () => {
    await request();
    await request({}, w.users.studentB);
    const ids = async (user, query) => (await (await as(user)).get("/leave", query)).body.data.map((l) => l.propertyId);
    assert.deepEqual(await ids(w.users.studentA), [w.A.id]);
    assert.deepEqual(await ids(w.users.managerA), [w.A.id]);
    assert.deepEqual(await ids(w.users.managerB), [w.B.id]);
    assert.equal((await ids(w.users.owner)).length, 2);
    assert.deepEqual(await ids(w.users.owner, { propertyId: w.B.id }), [w.B.id]);
  });

  test("the list carries display names and filters by status", async () => {
    const l = await request();
    const mgr = await as(w.users.managerA);
    const [row] = (await mgr.get("/leave")).body.data;
    assert.equal(row.studentName, "Resident A");
    assert.equal(row.roomNumber, "101");
    assert.equal(row.propertyName, "Hostel A");
    await mgr.post(`/leave/${l.id}/decision`, { decision: "approved" });
    assert.equal((await mgr.get("/leave", { status: "pending" })).body.data.length, 0);
    assert.equal((await mgr.get("/leave", { status: "approved" })).body.data.length, 1);
  });

  test("another business cannot see or act on it (NOT_FOUND)", async () => {
    const l = await request();
    const x = await seedOtherOrg();
    const ownerX = await as(x.users.ownerX);
    assert.equal((await ownerX.get("/leave")).body.data.length, 0);
    assert.equal((await ownerX.post(`/leave/${l.id}/decision`, { decision: "approved" })).status, 404);
    assert.equal((await ownerX.get("/leave", { propertyId: w.A.id })).status, 404);
  });

  test("a student login with no resident profile gets nothing, not everything", async () => {
    await request();
    const orphan = await prisma.user.update({ where: { id: w.users.studentB.id }, data: { studentId: null } });
    assert.equal((await (await as(orphan)).get("/leave")).status, 403);
  });
});
