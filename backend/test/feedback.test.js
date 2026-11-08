import "./helpers/env.js";
import { describe, test, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { prisma, resetDb, seedWorld, seedOtherOrg, disconnect } from "./helpers/db.js";
import { as } from "./helpers/api.js";

let w;
let x;
beforeEach(async () => {
  await resetDb();
  w = await seedWorld();
  x = await seedOtherOrg();
});
after(async () => { await resetDb(); await disconnect(); });

const fb = (extra = {}) => ({ category: "food", rating: 4, comment: "Dal was great today", anonymous: false, ...extra });

describe("feedback", () => {
  test("a resident submits feedback and sees it in their history", async () => {
    const stu = await as(w.users.studentA);
    const res = await stu.post("/feedback", fb());
    assert.equal(res.status, 201);
    assert.equal(res.body.data.studentId, w.residentA.id);
    assert.equal(res.body.data.propertyId, w.A.id);
    const mine = (await stu.get("/feedback/mine")).body.data;
    assert.equal(mine.length, 1);
    assert.equal(mine[0].comment, "Dal was great today");
    assert.equal((await (await as(w.users.studentB)).get("/feedback/mine")).body.data.length, 0);
  });

  test("rating and comment are validated", async () => {
    const stu = await as(w.users.studentA);
    for (const rating of [0, 6, 2.5]) {
      const r = await stu.post("/feedback", fb({ rating }));
      assert.equal(r.status, 422, `rating ${rating}`);
      assert.ok(r.body.error.fieldErrors.rating);
    }
    const r = await stu.post("/feedback", fb({ comment: " a " }));
    assert.equal(r.status, 422);
    assert.ok(r.body.error.fieldErrors.comment);
    assert.equal(await prisma.feedback.count(), 0);
  });

  test("one submission per category per week", async () => {
    const stu = await as(w.users.studentA);
    assert.equal((await stu.post("/feedback", fb())).status, 201);
    assert.equal((await stu.post("/feedback", fb({ rating: 1 }))).status, 409);
    assert.equal((await stu.post("/feedback", fb({ category: "internet" }))).status, 201);
    await prisma.feedback.updateMany({ where: { category: "food" }, data: { createdAt: new Date(Date.now() - 8 * 864e5) } });
    assert.equal((await stu.post("/feedback", fb())).status, 201);
  });

  test("anonymous feedback never reveals the resident to staff, in the list or the activity log", async () => {
    await (await as(w.users.studentA)).post("/feedback", fb({ anonymous: true, rating: 2, comment: "Bathrooms dirty" }));
    for (const u of [w.users.managerA, w.users.owner]) {
      const list = await (await as(u)).get("/feedback");
      assert.equal(list.status, 200);
      const [row] = list.body.data;
      assert.equal(row.studentName, "Anonymous");
      assert.equal(row.studentId, "");
      assert.ok(!JSON.stringify(list.body).includes(w.residentA.id), "student id leaked");
      assert.ok(!JSON.stringify(list.body).includes("Resident A"), "student name leaked");
    }
    const act = await prisma.activityLog.findFirst({ where: { category: "feedback" } });
    assert.ok(!act.message.includes("Resident A") && !act.actorName.includes("Resident A"));
    // The author still sees it as theirs.
    assert.equal((await (await as(w.users.studentA)).get("/feedback/mine")).body.data[0].studentId, w.residentA.id);
  });

  test("summary: average, per category and distribution, scoped", async () => {
    await (await as(w.users.studentA)).post("/feedback", fb({ rating: 5 }));
    await (await as(w.users.studentA)).post("/feedback", fb({ category: "internet", rating: 2 }));
    await (await as(w.users.studentB)).post("/feedback", fb({ rating: 3 }));
    const a = (await (await as(w.users.managerA)).get("/feedback/summary")).body.data;
    assert.equal(a.total, 2);
    assert.equal(a.average, 3.5);
    assert.deepEqual(a.distribution.map((d) => d.count), [0, 1, 0, 0, 1]);
    assert.deepEqual(a.byCategory.map((c) => c.category).sort(), ["food", "internet"]);
    const all = (await (await as(w.users.owner)).get("/feedback/summary")).body.data;
    assert.equal(all.total, 3);
    assert.equal(all.average, 3.3);
    assert.equal(all.byCategory.find((c) => c.category === "food").average, 4);
    assert.equal((await (await as(w.users.owner)).get("/feedback/summary", { propertyId: w.B.id })).body.data.total, 1);
    assert.equal((await (await as(x.users.ownerX)).get("/feedback/summary")).body.data.total, 0);
    assert.equal((await (await as(x.users.ownerX)).get("/feedback/summary", { propertyId: w.A.id })).status, 404);
    const empty = (await (await as(x.users.managerX)).get("/feedback/summary")).body.data;
    assert.deepEqual(empty, { average: 0, total: 0, byCategory: [], distribution: [1, 2, 3, 4, 5].map((rating) => ({ rating, count: 0 })) });
  });

  test("roles: staff cannot submit; residents cannot list or summarise; filters and scope apply", async () => {
    const mgr = await as(w.users.managerA);
    assert.equal((await mgr.post("/feedback", fb())).status, 403);
    assert.equal((await mgr.get("/feedback/mine")).status, 403);
    const stu = await as(w.users.studentA);
    assert.equal((await stu.get("/feedback")).status, 403);
    assert.equal((await stu.get("/feedback/summary")).status, 403);
    await stu.post("/feedback", fb());
    await stu.post("/feedback", fb({ category: "staff" }));
    assert.equal((await mgr.get("/feedback", { category: "staff" })).body.data.length, 1);
    assert.equal((await (await as(w.users.managerB)).get("/feedback")).body.data.length, 0);
    assert.equal((await (await as(w.users.managerB)).get("/feedback", { propertyId: w.A.id })).status, 403);
    assert.equal((await (await as(x.users.ownerX)).get("/feedback")).body.data.length, 0);
  });
});
