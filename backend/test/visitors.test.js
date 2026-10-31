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
const newVisit = (over = {}) => ({
  visitorName: "Ramesh Kumar", visitorPhone: "98765 43210", relation: "Father", visitDate: inDays(0), visitTime: "16:00", purpose: "", ...over,
});
const newWalkIn = (over = {}) => ({
  studentId: w.residentA.id, visitorName: "Sita Devi", visitorPhone: "9123456780", relation: "Mother", visitTime: "11:30", purpose: "Dropping off books", ...over,
});

async function request(over, user = w.users.studentA) {
  const res = await (await as(user)).post("/visitors", newVisit(over));
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return res.body.data;
}

async function approved(over) {
  const v = await request(over);
  const res = await (await as(w.users.managerA)).post(`/visitors/${v.id}/decision`, { decision: "approved" });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  return res.body.data;
}

const notificationsFor = (user) => prisma.notification.findMany({ where: { recipientUserId: user.id }, orderBy: { createdAt: "asc" } });

describe("requesting a visit", () => {
  test("a resident requests a visit: pending, plain date, normalised phone, managers notified", async () => {
    const v = await request({ visitDate: inDays(3) });
    assert.equal(v.status, "pending");
    assert.equal(v.source, "request");
    assert.equal(v.visitDate, inDays(3));
    assert.equal(v.visitorPhone, "9876543210");
    assert.equal(v.purpose, "Visit", "an empty purpose gets a sensible default");
    assert.equal(v.propertyId, w.A.id);
    assert.equal(v.checkInAt, undefined, "absent fields are omitted, not null");
    assert.equal((await notificationsFor(w.users.managerA)).length, 1);
    assert.equal((await notificationsFor(w.users.managerB)).length, 0);
    assert.equal(await prisma.activityLog.count({ where: { category: "visitor", propertyId: w.A.id } }), 1);
  });

  test("past date, over 30 days ahead, outside visiting hours, bad phone, bad date, short name: field errors", async () => {
    const stu = await as(w.users.studentA);
    const cases = [
      [{ visitDate: inDays(-1) }, "visitDate"],
      [{ visitDate: inDays(31) }, "visitDate"],
      [{ visitDate: "2026-02-31" }, "visitDate"],
      [{ visitTime: "07:59" }, "visitTime"],
      [{ visitTime: "19:01" }, "visitTime"],
      [{ visitTime: "4pm" }, "visitTime"],
      [{ visitorPhone: "12345" }, "visitorPhone"],
      [{ visitorName: "Al" }, "visitorName"],
      [{ relation: " " }, "relation"],
    ];
    for (const [over, field] of cases) {
      const res = await stu.post("/visitors", newVisit(over));
      assert.equal(res.status, 422, `${JSON.stringify(over)} → ${res.status}`);
      assert.ok(res.body.error.fieldErrors[field], `${JSON.stringify(over)} should flag ${field}`);
    }
    assert.equal(await prisma.visitorRequest.count(), 0);
  });

  test("the edges of visiting hours and the 30-day window are allowed", async () => {
    await request({ visitTime: "08:00" });
    await request({ visitTime: "19:00", visitDate: inDays(30) });
  });

  test("staff cannot request a visit", async () => {
    assert.equal((await (await as(w.users.managerA)).post("/visitors", newVisit())).status, 403);
  });
});

describe("deciding", () => {
  test("approve: the student is notified", async () => {
    const v = await approved();
    assert.equal(v.status, "approved");
    const notes = await notificationsFor(w.users.studentA);
    assert.equal(notes.length, 1);
    assert.equal(notes[0].title, "Visitor approved");
  });

  test("reject needs a reason, which the student sees", async () => {
    const v = await request();
    const mgr = await as(w.users.managerA);
    const bare = await mgr.post(`/visitors/${v.id}/decision`, { decision: "rejected" });
    assert.equal(bare.status, 422);
    assert.ok(bare.body.error.fieldErrors.reason);

    const res = await mgr.post(`/visitors/${v.id}/decision`, { decision: "rejected", reason: "Exams this week" });
    assert.equal(res.body.data.status, "rejected");
    assert.equal(res.body.data.decisionReason, "Exams this week");
    assert.match((await notificationsFor(w.users.studentA))[0].body, /Exams this week/);
  });

  test("only a pending request can be decided (CONFLICT otherwise)", async () => {
    const v = await approved();
    const again = await (await as(w.users.managerA)).post(`/visitors/${v.id}/decision`, { decision: "rejected", reason: "Changed my mind" });
    assert.equal(again.status, 409);
    assert.equal((await prisma.visitorRequest.findUnique({ where: { id: v.id } })).status, "approved");
  });

  test("residents cannot decide; another hostel's manager cannot either; the owner can", async () => {
    const v = await request();
    assert.equal((await (await as(w.users.studentA)).post(`/visitors/${v.id}/decision`, { decision: "approved" })).status, 403);
    assert.equal((await (await as(w.users.managerB)).post(`/visitors/${v.id}/decision`, { decision: "approved" })).status, 403);
    assert.equal((await (await as(w.users.owner)).post(`/visitors/${v.id}/decision`, { decision: "approved" })).status, 200);
  });
});

describe("check-in and check-out", () => {
  test("an approved visit on its date: check in, then out; the student sees both times", async () => {
    const v = await approved();
    const mgr = await as(w.users.managerA);
    const inRes = await mgr.post(`/visitors/${v.id}/check-in`);
    assert.equal(inRes.status, 200, JSON.stringify(inRes.body));
    assert.equal(inRes.body.data.status, "checked_in");
    assert.ok(inRes.body.data.checkInAt);
    assert.equal((await notificationsFor(w.users.studentA)).at(-1).title, "Visitor checked in");

    const outRes = await mgr.post(`/visitors/${v.id}/check-out`);
    assert.equal(outRes.status, 200);
    assert.equal(outRes.body.data.status, "checked_out");

    const [mine] = (await (await as(w.users.studentA)).get("/visitors")).body.data;
    assert.ok(mine.checkInAt && mine.checkOutAt, "history is visible to the student");
  });

  test("check-in needs approval first; check-out needs check-in first (CONFLICT)", async () => {
    const pending = await request();
    const mgr = await as(w.users.managerA);
    assert.equal((await mgr.post(`/visitors/${pending.id}/check-in`)).status, 409);
    assert.equal((await mgr.post(`/visitors/${pending.id}/check-out`)).status, 409);

    const ok = await approved();
    assert.equal((await mgr.post(`/visitors/${ok.id}/check-out`)).status, 409);
    await mgr.post(`/visitors/${ok.id}/check-in`);
    await mgr.post(`/visitors/${ok.id}/check-out`);
    assert.equal((await mgr.post(`/visitors/${ok.id}/check-out`)).status, 409, "cannot check out twice");
    assert.equal((await mgr.post(`/visitors/${ok.id}/check-in`)).status, 409, "cannot check back in");
  });

  test("an approved visit cannot be checked in before its date", async () => {
    const v = await approved({ visitDate: inDays(2) });
    const res = await (await as(w.users.managerA)).post(`/visitors/${v.id}/check-in`);
    assert.equal(res.status, 409);
    assert.equal((await prisma.visitorRequest.findUnique({ where: { id: v.id } })).status, "approved");
  });

  test("residents and another hostel's manager cannot check visitors in", async () => {
    const v = await approved();
    assert.equal((await (await as(w.users.studentA)).post(`/visitors/${v.id}/check-in`)).status, 403);
    assert.equal((await (await as(w.users.managerB)).post(`/visitors/${v.id}/check-in`)).status, 403);
  });
});

describe("walk-ins", () => {
  test("a manager logs a walk-in: checked in today, marked walk-in, the resident is notified", async () => {
    const res = await (await as(w.users.managerA)).post("/visitors/walk-ins", newWalkIn({ visitDate: inDays(5) }));
    assert.equal(res.status, 201, JSON.stringify(res.body));
    const v = res.body.data;
    assert.equal(v.status, "checked_in");
    assert.equal(v.source, "walk_in");
    assert.equal(v.visitDate, todayISO(), "a client-sent date is ignored");
    assert.ok(v.checkInAt);
    assert.equal((await notificationsFor(w.users.studentA))[0].title, "Visitor at reception");
    assert.equal((await (await as(w.users.managerA)).post(`/visitors/${v.id}/check-out`)).status, 200);
  });

  test("only a current resident of a property the caller manages", async () => {
    const x = await seedOtherOrg();
    const cases = [
      [w.users.managerB, w.residentA.id, "another hostel's resident"],
      [w.users.managerA, w.waitlistA.id, "a resident without a bed yet"],
      [w.users.managerA, "no-such-student", "an unknown id"],
      [x.users.ownerX, w.residentA.id, "another business's resident"],
    ];
    for (const [user, studentId, what] of cases) {
      const res = await (await as(user)).post("/visitors/walk-ins", newWalkIn({ studentId }));
      assert.equal(res.status, 422, `${what} → ${res.status}`);
      assert.ok(res.body.error.fieldErrors.studentId, what);
    }
    assert.equal(await prisma.visitorRequest.count(), 0);
  });

  test("walk-ins also respect visiting hours and phone rules; students cannot log them", async () => {
    const mgr = await as(w.users.managerA);
    const res = await mgr.post("/visitors/walk-ins", newWalkIn({ visitTime: "21:00", visitorPhone: "123" }));
    assert.equal(res.status, 422);
    assert.ok(res.body.error.fieldErrors.visitTime && res.body.error.fieldErrors.visitorPhone);
    assert.equal((await (await as(w.users.studentA)).post("/visitors/walk-ins", newWalkIn())).status, 403);
  });
});

describe("cancelling", () => {
  test("a resident cancels their own pending or approved visit", async () => {
    const stu = await as(w.users.studentA);
    const p = await request();
    assert.equal((await stu.post(`/visitors/${p.id}/cancel`)).body.data.status, "cancelled");
    const a = await approved();
    assert.equal((await stu.post(`/visitors/${a.id}/cancel`)).body.data.status, "cancelled");
  });

  test("a visit already checked in cannot be cancelled (CONFLICT)", async () => {
    const v = await approved();
    await (await as(w.users.managerA)).post(`/visitors/${v.id}/check-in`);
    assert.equal((await (await as(w.users.studentA)).post(`/visitors/${v.id}/cancel`)).status, 409);
  });

  test("a check-in and a cancellation at the same time: exactly one wins", async () => {
    const v = await approved();
    const [i, c] = await Promise.all([
      (await as(w.users.managerA)).post(`/visitors/${v.id}/check-in`),
      (await as(w.users.studentA)).post(`/visitors/${v.id}/cancel`),
    ]);
    assert.deepEqual([i.status, c.status].sort(), [200, 409]);
  });

  test("another resident and staff cannot cancel someone's visit", async () => {
    const v = await request();
    assert.equal((await (await as(w.users.studentB)).post(`/visitors/${v.id}/cancel`)).status, 403);
    assert.equal((await (await as(w.users.managerA)).post(`/visitors/${v.id}/cancel`)).status, 403);
  });
});

describe("who sees which visits", () => {
  test("a resident sees only their own; managers only their hostel; the owner all of theirs", async () => {
    await request();
    await request({}, w.users.studentB);
    const ids = async (user, query) => (await (await as(user)).get("/visitors", query)).body.data.map((v) => v.propertyId);
    assert.deepEqual(await ids(w.users.studentA), [w.A.id]);
    assert.deepEqual(await ids(w.users.managerA), [w.A.id]);
    assert.deepEqual(await ids(w.users.managerB), [w.B.id]);
    assert.equal((await ids(w.users.owner)).length, 2);
    assert.deepEqual(await ids(w.users.owner, { propertyId: w.B.id }), [w.B.id]);
  });

  test("the list carries display names and filters by status and date", async () => {
    const v = await request();
    await request({ visitDate: inDays(4) });
    const mgr = await as(w.users.managerA);
    const all = (await mgr.get("/visitors")).body.data;
    assert.deepEqual(all.map((x) => x.visitDate), [inDays(4), inDays(0)], "newest visit date first");
    assert.equal(all[1].studentName, "Resident A");
    assert.equal(all[1].roomNumber, "101");
    assert.equal(all[1].propertyName, "Hostel A");

    assert.equal((await mgr.get("/visitors", { date: todayISO() })).body.data.length, 1);
    await mgr.post(`/visitors/${v.id}/decision`, { decision: "approved" });
    assert.equal((await mgr.get("/visitors", { status: "pending" })).body.data.length, 1);
    assert.equal((await mgr.get("/visitors", { status: "approved" })).body.data.length, 1);
    assert.equal((await mgr.get("/visitors", { date: "today" })).status, 422);
  });

  test("another business cannot see or act on it (NOT_FOUND)", async () => {
    const v = await request();
    const x = await seedOtherOrg();
    const ownerX = await as(x.users.ownerX);
    assert.equal((await ownerX.get("/visitors")).body.data.length, 0);
    assert.equal((await ownerX.post(`/visitors/${v.id}/decision`, { decision: "approved" })).status, 404);
    assert.equal((await ownerX.post(`/visitors/${v.id}/check-in`)).status, 404);
    assert.equal((await ownerX.get("/visitors", { propertyId: w.A.id })).status, 404);
  });

  test("a student login with no resident profile gets nothing, not everything", async () => {
    await request();
    const orphan = await prisma.user.update({ where: { id: w.users.studentB.id }, data: { studentId: null } });
    assert.equal((await (await as(orphan)).get("/visitors")).status, 403);
  });
});
