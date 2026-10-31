import "./helpers/env.js";
import { describe, test, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { prisma, resetDb, seedWorld, disconnect, bedInvariantViolations } from "./helpers/db.js";
import { as } from "./helpers/api.js";

let w;
beforeEach(async () => { await resetDb(); w = await seedWorld(); });
after(disconnect);

const newStudent = (over = {}) => ({
  name: "Test Admit", email: "admit@example.test", phone: "9876543210", gender: "female", dob: "2005-02-02",
  studentCode: "ADM001", college: "College", course: "BA", year: 1, joinedOn: "2026-01-01", monthlyRent: 9000, ...over,
});

describe("admission (baseline)", () => {
  test("creating with a free bed occupies it and makes the student active, in one step", async () => {
    const mgr = await as(w.users.managerA);
    const res = await mgr.post("/students", newStudent({ bedId: w.roomA.beds[1].id }));
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.equal(res.body.data.status, "active");
    assert.equal((await prisma.bed.findUnique({ where: { id: w.roomA.beds[1].id } })).status, "occupied");
    assert.deepEqual(await bedInvariantViolations(), []);
  });

  test("creating without a bed leaves the student pending", async () => {
    const mgr = await as(w.users.managerA);
    const res = await mgr.post("/students", newStudent());
    assert.equal(res.status, 201);
    assert.equal(res.body.data.status, "pending");
  });

  test("an occupied bed is rejected and no student row is left behind", async () => {
    const mgr = await as(w.users.managerA);
    const res = await mgr.post("/students", newStudent({ bedId: w.roomA.beds[0].id }));
    assert.equal(res.status, 422);
    assert.equal(await prisma.studentProfile.count({ where: { studentCode: "ADM001" } }), 0, "partial failure left an orphan student");
  });

  test("a bed in another hostel is rejected", async () => {
    const mgr = await as(w.users.managerA);
    const res = await mgr.post("/students", newStudent({ bedId: w.roomB.beds[1].id }));
    assert.equal(res.status, 422);
    assert.equal(await prisma.studentProfile.count({ where: { studentCode: "ADM001" } }), 0);
  });

  test("a duplicate student code is a clean 409 CONFLICT, not a 500", async () => {
    const mgr = await as(w.users.managerA);
    assert.equal((await mgr.post("/students", newStudent())).status, 201);
    const dup = await mgr.post("/students", newStudent({ email: "other@example.test" }));
    assert.equal(dup.status, 409);
    assert.equal(dup.body.error.code, "CONFLICT");
  });

  test("a manager cannot change a student's hostel or bed through the update endpoint", async () => {
    const mgr = await as(w.users.managerA);
    await mgr.patch(`/students/${w.residentA.id}`, { propertyId: w.B.id, bedId: w.roomA.beds[1].id, college: "New College" });
    const s = await prisma.studentProfile.findUnique({ where: { id: w.residentA.id } });
    assert.equal(s.propertyId, w.A.id);
    assert.equal(s.bedId, w.roomA.beds[0].id);
    assert.equal(s.college, "New College");
  });
});

describe("student self-service (baseline)", () => {
  test("a student can update contact details but not rent or status", async () => {
    const c = await as(w.users.studentA);
    const res = await c.patch("/students/self", { address: "New address", monthlyRent: 1, status: "moved_out" });
    assert.equal(res.status, 200);
    const s = await prisma.studentProfile.findUnique({ where: { id: w.residentA.id } });
    assert.equal(s.address, "New address");
    assert.equal(s.monthlyRent, 9500);
    assert.equal(s.status, "active");
  });
});

describe("student self-service: login account stays in step", () => {
  test("[DEF-A6] a student's own email change is reflected on their login account", async () => {
    const c = await as(w.users.studentA);
    assert.equal((await c.patch("/students/self", { email: "changed@example.test" })).status, 200);
    const session = await c.get("/auth/session");
    assert.equal(session.body.data.user.email, "changed@example.test", "profile email changed but the sign-in account still has the old one");
  });
});

describe("modules that do not exist yet are omitted, not faked as empty", () => {
  test("[FAKE-EMPTY] student detail does not return fabricated empty complaint/leave/visitor/document lists", async () => {
    const res = await (await as(w.users.managerA)).get(`/students/${w.residentA.id}`);
    assert.equal(res.status, 200);
    for (const k of ["complaints", "leaves", "visitors", "documents"]) {
      assert.equal(k in res.body.data, false, `"${k}" is returned as [] though that module is not implemented`);
    }
  });

  test("property stats count real open complaints", async () => {
    const owner = await as(w.users.owner);
    assert.equal((await owner.get(`/properties/${w.A.id}`)).body.data.stats.openComplaints, 0);
    await prisma.complaint.create({ data: { ticketNo: "CMP-T1", propertyId: w.A.id, studentId: w.residentA.id, category: "plumbing", title: "Leak", description: "d", priority: "medium" } });
    await prisma.complaint.create({ data: { ticketNo: "CMP-T2", propertyId: w.A.id, studentId: w.residentA.id, category: "plumbing", title: "Done", description: "d", priority: "low", status: "closed" } });
    assert.equal((await owner.get(`/properties/${w.A.id}`)).body.data.stats.openComplaints, 1);
  });
});

describe("student codes", () => {
  const body = (over = {}) => ({
    name: "Auto Code", email: `auto${Math.random().toString(36).slice(2, 8)}@example.test`, phone: "9876543210",
    gender: "male", dob: "2005-02-02", college: "College", course: "BA", year: 1, joinedOn: "2026-01-01", monthlyRent: 9000, ...over,
  });

  test("a code is generated when omitted, and concurrent admissions never share one", async () => {
    const mgr = await as(w.users.managerA);
    const results = await Promise.all(Array.from({ length: 6 }, () => mgr.post("/students", body())));
    assert.ok(results.every((r) => r.status === 201), JSON.stringify(results.map((r) => [r.status, r.body.error?.message])));
    const codes = results.map((r) => r.body.data.studentCode);
    assert.equal(new Set(codes).size, 6, `duplicate codes: ${codes}`);
    assert.ok(codes.every((c) => /^MRK\d{4}$/.test(c)));
  });

  test("generated codes skip codes that already exist", async () => {
    const mgr = await as(w.users.managerA);
    for (const code of ["MRK0001", "MRK0002", "MRK0003"]) {
      assert.equal((await mgr.post("/students", body({ studentCode: code }))).status, 201);
    }
    const auto = await mgr.post("/students", body());
    assert.equal(auto.status, 201);
    assert.ok(!["MRK0001", "MRK0002", "MRK0003"].includes(auto.body.data.studentCode));
  });

  test("a duplicate supplied code is a field-level 409 and creates nothing", async () => {
    const mgr = await as(w.users.managerA);
    const first = await mgr.post("/students", body({ studentCode: "CUSTOM-1" }));
    assert.equal(first.status, 201);
    const dup = await mgr.post("/students", body({ studentCode: "CUSTOM-1" }));
    assert.equal(dup.status, 409);
    assert.equal(dup.body.error.code, "CONFLICT");
    assert.ok(dup.body.error.fieldErrors?.studentCode);
    assert.equal(await prisma.studentProfile.count({ where: { studentCode: "CUSTOM-1" } }), 1);
  });

  test("changing a code to one in use is rejected", async () => {
    const mgr = await as(w.users.managerA);
    const res = await mgr.patch(`/students/${w.waitlistA.id}`, { studentCode: w.residentA.studentCode });
    assert.equal(res.status, 409);
  });
});

describe("keeping the sign-in account in step with the profile", () => {
  test("a manager changing a student's email and phone updates their login too", async () => {
    const mgr = await as(w.users.managerA);
    const res = await mgr.patch(`/students/${w.residentA.id}`, { email: "Fresh@Example.test", phone: "9123456789" });
    assert.equal(res.status, 200);
    const u = await prisma.user.findUnique({ where: { id: w.users.studentA.id } });
    assert.equal(u.email, "fresh@example.test");
    assert.equal(u.phone, "9123456789");
  });

  test("an email already used by another account is a 409 and neither record changes", async () => {
    const c = await as(w.users.studentA);
    const res = await c.patch("/students/self", { email: w.users.studentB.email, address: "Should not stick" });
    assert.equal(res.status, 409);
    assert.ok(res.body.error.fieldErrors?.email);
    const profile = await prisma.studentProfile.findUnique({ where: { id: w.residentA.id } });
    assert.notEqual(profile.address, "Should not stick", "profile changed although the login update failed");
    const u = await prisma.user.findUnique({ where: { id: w.users.studentA.id } });
    assert.equal(u.email, w.users.studentA.email);
  });
});
