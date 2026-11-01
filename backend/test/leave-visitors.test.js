import "./helpers/env.js";
import { describe, test, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { prisma, resetDb, seedWorld, seedOtherOrg, disconnect } from "./helpers/db.js";
import { as } from "./helpers/api.js";
import { todayISO } from "../src/utils/money.js";

let w, x;
beforeEach(async () => { await resetDb(); w = await seedWorld(); x = await seedOtherOrg(); });
after(async () => { await resetDb(); await disconnect(); });

const plus = (n) => new Date(Date.parse(`${todayISO()}T00:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
const leave = (from = plus(2), to = plus(4)) => ({ from, to, destination: "Jaipur", contactPhone: "9876501111", reason: "Family function" });
const visit = (over = {}) => ({ visitorName: "Meena Sharma", visitorPhone: "9876502222", relation: "Mother", visitDate: plus(1), visitTime: "16:30", purpose: "Drop off books", ...over });

describe("leave", () => {
  test("a resident requests leave; JSON uses from/to; the manager is notified", async () => {
    const res = await (await as(w.users.studentA)).post("/leave", leave());
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.equal(res.body.data.from, plus(2));
    assert.equal(res.body.data.to, plus(4));
    assert.equal(res.body.data.status, "pending");
    assert.equal(res.body.data.studentName, "Resident A");
    assert.equal(res.body.data.roomNumber, "101");
    assert.equal(await prisma.notification.count({ where: { recipientUserId: w.users.managerA.id, category: "leave" } }), 1);
  });

  test("validation: past start, reversed dates, bad phone", async () => {
    const res = await (await as(w.users.studentA)).post("/leave", { ...leave(plus(-1), plus(-3)), contactPhone: "12" });
    assert.equal(res.status, 422);
    const f = res.body.error.fieldErrors;
    assert.ok(f.from && f.to && f.contactPhone, JSON.stringify(f));
  });

  test("overlapping leave is refused; adjacent leave is fine", async () => {
    const s = await as(w.users.studentA);
    assert.equal((await s.post("/leave", leave(plus(2), plus(4)))).status, 201);
    assert.equal((await s.post("/leave", leave(plus(4), plus(6)))).status, 409);
    assert.equal((await s.post("/leave", leave(plus(5), plus(6)))).status, 201);
  });

  test("decisions: reject needs a reason; only pending can be decided; scope enforced", async () => {
    const l = (await (await as(w.users.studentA)).post("/leave", leave())).body.data;
    const ma = await as(w.users.managerA);
    const noReason = await ma.post(`/leave/${l.id}/decide`, { decision: "rejected" });
    assert.equal(noReason.status, 422);
    assert.ok(noReason.body.error.fieldErrors.reason);
    assert.equal((await (await as(w.users.managerB)).post(`/leave/${l.id}/decide`, { decision: "approved" })).status, 403);
    assert.equal((await (await as(x.users.ownerX)).post(`/leave/${l.id}/decide`, { decision: "approved" })).status, 404);
    assert.equal((await (await as(w.users.studentA)).post(`/leave/${l.id}/decide`, { decision: "approved" })).status, 403);
    const ok = await ma.post(`/leave/${l.id}/decide`, { decision: "approved" });
    assert.equal(ok.status, 200);
    assert.equal(ok.body.data.decidedBy, "Manager A");
    assert.ok(ok.body.data.decidedAt);
    assert.equal((await ma.post(`/leave/${l.id}/decide`, { decision: "rejected", reason: "late" })).status, 409);
  });

  test("two managers deciding at once: exactly one decision applies", async () => {
    const l = (await (await as(w.users.studentA)).post("/leave", leave())).body.data;
    const res = await Promise.all([
      (await as(w.users.managerA)).post(`/leave/${l.id}/decide`, { decision: "approved" }),
      (await as(w.users.owner)).post(`/leave/${l.id}/decide`, { decision: "rejected", reason: "No" }),
    ]);
    assert.deepEqual(res.map((r) => r.status).sort(), [200, 409]);
  });

  test("cancel: own pending or future approved only; others' leave is forbidden", async () => {
    const s = await as(w.users.studentA);
    const l = (await s.post("/leave", leave())).body.data;
    assert.equal((await (await as(w.users.studentB)).post(`/leave/${l.id}/cancel`)).status, 403);
    await (await as(w.users.managerA)).post(`/leave/${l.id}/decide`, { decision: "approved" });
    assert.equal((await s.post(`/leave/${l.id}/cancel`)).body.data.status, "cancelled");
    assert.equal((await s.post(`/leave/${l.id}/cancel`)).status, 409);
    const started = await prisma.leaveRequest.create({ data: { studentId: w.residentA.id, propertyId: w.A.id, fromDate: new Date(`${todayISO()}T00:00:00Z`), toDate: new Date(`${plus(1)}T00:00:00Z`), destination: "x", contactPhone: "9876501111", reason: "x", status: "approved" } });
    assert.equal((await s.post(`/leave/${started.id}/cancel`)).status, 409, "leave already under way was cancelled");
  });

  test("lists are scoped and filterable", async () => {
    await (await as(w.users.studentA)).post("/leave", leave());
    await (await as(w.users.studentB)).post("/leave", leave());
    assert.equal((await (await as(w.users.studentA)).get("/leave")).body.data.length, 1);
    assert.equal((await (await as(w.users.managerA)).get("/leave")).body.data.length, 1);
    assert.equal((await (await as(w.users.owner)).get("/leave", { status: "pending" })).body.data.length, 2);
    assert.equal((await (await as(w.users.owner)).get("/leave", { status: "approved" })).body.data.length, 0);
  });
});

describe("visitors", () => {
  test("request → approve → check in → check out, with timestamps and notifications", async () => {
    const v = (await (await as(w.users.studentA)).post("/visitors", visit())).body.data;
    assert.equal(v.status, "pending");
    assert.equal(v.source, "request");
    const ma = await as(w.users.managerA);
    assert.equal((await ma.post(`/visitors/${v.id}/check-in`)).status, 409, "checked in before approval");
    assert.equal((await ma.post(`/visitors/${v.id}/decide`, { decision: "approved" })).body.data.status, "approved");
    const inn = await ma.post(`/visitors/${v.id}/check-in`);
    assert.equal(inn.body.data.status, "checked_in");
    assert.ok(inn.body.data.checkInAt);
    const out = await ma.post(`/visitors/${v.id}/check-out`);
    assert.equal(out.body.data.status, "checked_out");
    assert.ok(out.body.data.checkOutAt);
    assert.equal((await ma.post(`/visitors/${v.id}/cancel`)).status, 409);
    assert.ok(await prisma.notification.count({ where: { recipientUserId: w.users.studentA.id, category: "visitor" } }) >= 2);
  });

  test("validation and rejection reason", async () => {
    const bad = await (await as(w.users.studentA)).post("/visitors", visit({ visitorPhone: "1", visitDate: plus(-1), visitTime: "25:00" }));
    assert.equal(bad.status, 422);
    assert.ok(bad.body.error.fieldErrors.visitTime);
    const bad2 = await (await as(w.users.studentA)).post("/visitors", visit({ visitorPhone: "1", visitDate: plus(-1) }));
    assert.ok(bad2.body.error.fieldErrors.visitorPhone && bad2.body.error.fieldErrors.visitDate);
    const v = (await (await as(w.users.studentA)).post("/visitors", visit())).body.data;
    const r = await (await as(w.users.managerA)).post(`/visitors/${v.id}/decide`, { decision: "rejected" });
    assert.equal(r.status, 422);
    assert.ok(r.body.error.fieldErrors.reason);
  });

  test("walk-ins are checked in at once, only for residents in the manager's scope", async () => {
    const ma = await as(w.users.managerA);
    const res = await ma.post("/visitors/walk-in", { ...visit({ visitDate: todayISO() }), studentId: w.residentA.id });
    assert.equal(res.status, 201);
    assert.equal(res.body.data.source, "walk_in");
    assert.equal(res.body.data.status, "checked_in");
    assert.equal((await ma.post("/visitors/walk-in", { ...visit(), studentId: w.residentB.id })).status, 403);
    assert.equal((await (await as(w.users.owner)).post("/visitors/walk-in", { ...visit(), studentId: x.residentX.id })).status, 404);
    assert.equal((await (await as(w.users.studentA)).post("/visitors/walk-in", { ...visit(), studentId: w.residentA.id })).status, 403);
  });

  test("cancel: students only their own; scope and date filters on lists", async () => {
    const v = (await (await as(w.users.studentA)).post("/visitors", visit())).body.data;
    await (await as(w.users.studentB)).post("/visitors", visit({ visitDate: plus(3) }));
    assert.equal((await (await as(w.users.studentB)).post(`/visitors/${v.id}/cancel`)).status, 403);
    assert.equal((await (await as(w.users.managerB)).post(`/visitors/${v.id}/decide`, { decision: "approved" })).status, 403);
    assert.equal((await (await as(w.users.studentA)).get("/visitors")).body.data.length, 1);
    const owner = await as(w.users.owner);
    assert.equal((await owner.get("/visitors", { date: plus(1) })).body.data.length, 1);
    assert.equal((await owner.get("/visitors", { date: plus(3) })).body.data.length, 1);
    assert.equal((await owner.get("/visitors")).body.data.length, 2);
    assert.equal((await (await as(w.users.studentA)).post(`/visitors/${v.id}/cancel`)).body.data.status, "cancelled");
  });
});
