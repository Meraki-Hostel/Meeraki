import "./helpers/env.js";
import { describe, test, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { prisma, resetDb, seedWorld, seedOtherOrg, disconnect } from "./helpers/db.js";
import { as } from "./helpers/api.js";

let w;
beforeEach(async () => { await resetDb(); w = await seedWorld(); });
after(async () => { await resetDb(); await disconnect(); });

describe("emergency alerts", () => {
  test("a resident's alert reaches every manager of the hostel and every owner, nobody else", async () => {
    const res = await (await as(w.users.studentA)).post("/emergency", { type: "medical", message: "Roommate fainted" });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    const a = res.body.data;
    assert.equal(a.status, "open");
    assert.equal(a.location, "Room 101, Bed A");
    assert.equal(a.studentName, "Resident A");
    assert.equal(a.roomNumber, "101");
    assert.equal(a.propertyName, "Hostel A");
    const told = async (u) => prisma.notification.count({ where: { recipientUserId: u.id, title: { startsWith: "EMERGENCY:" } } });
    assert.equal(await told(w.users.managerA), 1);
    assert.equal(await told(w.users.owner), 1);
    assert.equal(await told(w.users.managerB), 0, "a manager of another hostel was alerted");
    assert.equal(await told(w.users.studentB), 0);
    assert.equal(await prisma.activityLog.count({ where: { category: "student", message: { contains: "emergency" } } }), 1);
  });

  test("an explicit location is kept; staff and invalid types are refused", async () => {
    const st = await as(w.users.studentA);
    const res = await st.post("/emergency", { type: "fire", message: "Smoke", location: "Kitchen, ground floor" });
    assert.equal(res.body.data.location, "Kitchen, ground floor");
    assert.equal((await st.post("/emergency", { type: "alien", message: "x" })).status, 422);
    assert.equal((await st.post("/emergency", { type: "other", message: "" })).status, 422);
    assert.equal((await (await as(w.users.managerA)).post("/emergency", { type: "other", message: "x" })).status, 403);
  });

  test("at most three open alerts per resident", async () => {
    const st = await as(w.users.studentA);
    for (let i = 0; i < 3; i++) assert.equal((await st.post("/emergency", { type: "other", message: `m${i}` })).status, 201);
    assert.equal((await st.post("/emergency", { type: "other", message: "again" })).status, 409);
  });

  test("staff acknowledge then resolve; the resident is told; transitions are guarded", async () => {
    const id = (await (await as(w.users.studentA)).post("/emergency", { type: "security", message: "Stranger in corridor" })).body.data.id;
    const mgr = await as(w.users.managerA);
    const ack = await mgr.post(`/emergency/${id}/acknowledge`);
    assert.equal(ack.status, 200);
    assert.equal(ack.body.data.status, "acknowledged");
    assert.equal(ack.body.data.acknowledgedBy, "Manager A");
    assert.equal((await mgr.post(`/emergency/${id}/acknowledge`)).status, 409);
    const done = await mgr.post(`/emergency/${id}/resolve`, { note: "Visitor escorted out" });
    assert.equal(done.body.data.status, "resolved");
    assert.equal(done.body.data.resolutionNote, "Visitor escorted out");
    assert.equal((await mgr.post(`/emergency/${id}/resolve`)).status, 409);
    assert.equal(await prisma.notification.count({ where: { recipientUserId: w.users.studentA.id, title: { in: ["Help is on the way", "Alert resolved"] } } }), 2);
  });

  test("an alert can be resolved straight from open", async () => {
    const id = (await (await as(w.users.studentA)).post("/emergency", { type: "other", message: "Lift stuck" })).body.data.id;
    const res = await (await as(w.users.owner)).post(`/emergency/${id}/resolve`);
    assert.equal(res.body.data.status, "resolved");
    assert.ok(res.body.data.acknowledgedAt);
  });

  test("isolation: other hostels, other organizations and students cannot act or see", async () => {
    const id = (await (await as(w.users.studentA)).post("/emergency", { type: "other", message: "x" })).body.data.id;
    assert.equal((await (await as(w.users.managerB)).post(`/emergency/${id}/acknowledge`)).status, 403);
    assert.equal((await (await as(w.users.studentA)).post(`/emergency/${id}/acknowledge`)).status, 403);
    const x = await seedOtherOrg();
    assert.equal((await (await as(x.users.ownerX)).post(`/emergency/${id}/resolve`)).status, 404);
    assert.equal((await (await as(x.users.ownerX)).get("/emergency")).body.data.length, 0);
    assert.equal((await (await as(w.users.managerB)).get("/emergency")).body.data.length, 0);
    assert.equal((await (await as(w.users.studentB)).get("/emergency")).body.data.length, 0);
    assert.equal((await (await as(w.users.studentA)).get("/emergency")).body.data.length, 1);
    assert.equal((await (await as(w.users.managerA)).get("/emergency", { status: "resolved" })).body.data.length, 0);
  });
});

describe("search", () => {
  const titles = (res) => res.body.data.map((r) => `${r.kind}:${r.title}`);

  test("too short or too long queries return nothing", async () => {
    const mgr = await as(w.users.managerA);
    assert.deepEqual((await mgr.get("/search", { q: "R" })).body.data, []);
    assert.deepEqual((await mgr.get("/search", { q: "x".repeat(61) })).body.data, []);
    assert.deepEqual((await mgr.get("/search")).body.data, []);
  });

  test("a manager finds only their own hostel's records", async () => {
    const mgr = await as(w.users.managerA);
    const res = await mgr.get("/search", { q: "Resident" });
    assert.ok(titles(res).includes("student:Resident A"));
    assert.ok(!titles(res).includes("student:Resident B"), "manager A saw hostel B's resident");
    const hit = res.body.data.find((r) => r.title === "Resident A");
    assert.equal(hit.link, `/manager/students/${w.residentA.id}`);
    assert.ok(!titles(await mgr.get("/search", { q: "201" })).some((t) => t.startsWith("room:")), "manager A saw hostel B's room");
    assert.ok(titles(await mgr.get("/search", { q: "101" })).includes("room:Room 101"));
    assert.ok(!titles(await mgr.get("/search", { q: "Hostel" })).some((t) => t.startsWith("property:")), "managers do not search properties");
  });

  test("an owner searches the whole organization but never another one", async () => {
    const x = await seedOtherOrg();
    const res = await (await as(w.users.owner)).get("/search", { q: "Resident" });
    assert.ok(titles(res).includes("student:Resident A") && titles(res).includes("student:Resident B"));
    assert.ok(!titles(res).includes("student:Resident X"), "owner saw another organization's resident");
    const props = titles(await (await as(w.users.owner)).get("/search", { q: "Hostel" }));
    assert.ok(props.includes("property:Hostel A") && !props.includes("property:Hostel X"));
    assert.ok(!titles(await (await as(x.users.ownerX)).get("/search", { q: "Resident A" })).includes("student:Resident A"));
  });

  test("complaints, staff, notices and receipts are found in scope", async () => {
    await prisma.complaint.create({ data: { ticketNo: "CMP-0042", propertyId: w.A.id, studentId: w.residentA.id, category: "plumbing", title: "Leaking geyser", description: "d", priority: "high" } });
    await prisma.staffMember.create({ data: { orgId: w.org.id, name: "Ramesh Warden", role: "warden", propertyId: w.A.id, phone: "9800000099", email: "r@example.test", joinedOn: new Date("2025-01-01") } });
    await prisma.announcement.create({ data: { propertyId: w.A.id, title: "Water shutdown Sunday", body: "b", category: "maintenance", status: "published", author: "Manager A", publishedAt: new Date() } });
    const mgr = await as(w.users.managerA);
    const c = (await mgr.get("/search", { q: "geyser" })).body.data.find((r) => r.kind === "complaint");
    assert.equal(c.link, `/manager/complaints?id=${c.id}`);
    assert.ok(titles(await mgr.get("/search", { q: "CMP-0042" })).includes("complaint:Leaking geyser"));
    assert.ok(titles(await mgr.get("/search", { q: "ramesh" })).includes("staff:Ramesh Warden"));
    assert.ok(titles(await mgr.get("/search", { q: "shutdown" })).includes("notice:Water shutdown Sunday"));
    assert.ok(!titles(await (await as(w.users.managerB)).get("/search", { q: "geyser" })).length, "manager B saw hostel A's complaint");

    await mgr.post("/payments/record", { chargeId: w.chargeA.id, amount: 1000, method: "cash", paidOn: "2026-01-05", reference: "" });
    const receipt = (await prisma.payment.findFirst()).receiptNo;
    assert.ok(titles(await mgr.get("/search", { q: receipt })).includes(`payment:${receipt}`));
  });

  test("a student finds only their own receipts, their hostel's published notices and pages", async () => {
    await (await as(w.users.managerA)).post("/payments/record", { chargeId: w.chargeA.id, amount: 1000, method: "cash", paidOn: "2026-01-05", reference: "" });
    await (await as(w.users.managerB)).post("/payments/record", { chargeId: w.chargeB.id, amount: 1000, method: "cash", paidOn: "2026-01-05", reference: "" });
    await prisma.announcement.create({ data: { propertyId: w.A.id, title: "Mess menu change", body: "b", category: "mess", status: "published", author: "M", publishedAt: new Date() } });
    await prisma.announcement.create({ data: { propertyId: w.A.id, title: "Mess draft plan", body: "b", category: "mess", status: "draft", author: "M" } });
    await prisma.announcement.create({ data: { propertyId: w.B.id, title: "Mess in hostel B", body: "b", category: "mess", status: "published", author: "M", publishedAt: new Date() } });
    const st = await as(w.users.studentA);
    const pays = (await st.get("/search", { q: "RCPT" })).body.data.filter((r) => r.kind === "payment");
    assert.equal(pays.length, 1, "a student saw another resident's receipt");
    assert.equal(pays[0].link, "/student/rent");
    const notices = titles(await st.get("/search", { q: "mess" }));
    assert.deepEqual(notices.filter((t) => t.startsWith("notice:")), ["notice:Mess menu change"]);
    const people = (await st.get("/search", { q: "Resident" })).body.data;
    assert.ok(!people.some((r) => r.kind === "student"), "a student searched other students");
    const pagesHit = (await st.get("/search", { q: "rent" })).body.data.find((r) => r.kind === "page");
    assert.equal(pagesHit.link, "/student/rent");
  });
});
