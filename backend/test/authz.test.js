import "./helpers/env.js";
import { describe, test, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { prisma, resetDb, seedWorld, disconnect } from "./helpers/db.js";
import { api, as } from "./helpers/api.js";

// Fresh data per test: a wrongly-allowed write must not corrupt later tests.
let w;
beforeEach(async () => { await resetDb(); w = await seedWorld(); });
after(disconnect);

// ── Authorization matrix: who may call each write endpoint ───────────────────
// `denied` lists the roles that MUST get 401/403. Every other role is allowed
// to attempt it (a business rule may still answer 4xx, which we don't assert).
const unauthenticated = { label: "anonymous", user: () => null };
const ROLES = {
  anonymous: unauthenticated,
  student: { label: "student", user: (w) => w.users.studentA },
  managerB: { label: "manager of another hostel", user: (w) => w.users.managerB },
  managerA: { label: "manager of this hostel", user: (w) => w.users.managerA },
  owner: { label: "owner", user: (w) => w.users.owner },
};

const MATRIX = [
  // [name, (unused), method, path(w), body(w), roles that must be refused]
  ["create room", null, "post", () => "/rooms", (w) => ({ propertyId: w.A.id, number: "999", floor: 1, type: "single", rent: 100 }), ["anonymous", "student"]],
  ["update room", null, "patch", (w) => `/rooms/${w.roomA.room.id}`, () => ({ rent: 1 }), ["anonymous", "student", "managerB"]],
  ["set bed status", null, "patch", (w) => `/beds/${w.roomA.beds[1].id}/status`, () => ({ status: "unavailable", reason: "x" }), ["anonymous", "student", "managerB"]],
  ["assign bed", null, "post", () => "/beds/assign", (w) => ({ studentId: w.waitlistA.id, bedId: w.roomA.beds[1].id }), ["anonymous", "student", "managerB"]],
  ["vacate bed", null, "post", () => "/beds/vacate", (w) => ({ studentId: w.residentA.id }), ["anonymous", "student", "managerB"]],
  ["update property (rent, status…)", null, "patch", (w) => `/properties/${w.A.id}`, () => ({ baseRent: 1 }), ["anonymous", "student", "managerB", "managerA"]],
  ["create property", null, "post", () => "/properties", () => ({ name: "Zed", code: "ZED", type: "boys", locality: "l", city: "c", address: "a", pincode: "122003", phone: "9876500000", baseRent: 1 }), ["anonymous", "student", "managerA", "managerB"]],
  ["set property status", null, "patch", (w) => `/properties/${w.A.id}/status`, () => ({ status: "inactive" }), ["anonymous", "student", "managerA", "managerB"]],
  ["create student", null, "post", () => "/students", (w) => ({ name: "Newbie", email: "newbie@example.test", phone: "9876543210", gender: "male", dob: "2005-01-01", studentCode: "ZZ1", college: "c", course: "c", year: 1, joinedOn: "2026-01-01", monthlyRent: 1, propertyId: w.A.id }), ["anonymous", "student"]],
  ["update student", null, "patch", (w) => `/students/${w.residentA.id}`, () => ({ college: "Changed" }), ["anonymous", "student", "managerB"]],
  ["set student status", null, "patch", (w) => `/students/${w.waitlistA.id}/status`, () => ({ status: "notice" }), ["anonymous", "student", "managerB"]],
  ["record payment", null, "post", () => "/payments/record", (w) => ({ chargeId: w.chargeA.id, amount: 100, method: "cash", paidOn: "2026-01-06", reference: "" }), ["anonymous", "student", "managerB"]],
  ["send rent reminders", null, "post", () => "/payments/reminders", (w) => ({ chargeIds: [w.chargeA.id] }), ["anonymous", "student"]],
];

describe("authorization matrix (role × write endpoint)", () => {
  for (const [name, def, method, path, body, mustRefuse] of MATRIX) {
    for (const roleKey of mustRefuse) {
      const label = `${name}: ${ROLES[roleKey].label} is refused`;
      const run = async () => {
        const user = ROLES[roleKey].user(w);
        const client = user ? await as(user) : api();
        // Snapshot rooms/beds/property so a wrongly-allowed write is visible in the message.
        const res = await client[method](path(w), body(w));
        assert.ok([401, 403].includes(res.status), `expected 401/403, got ${res.status}: ${JSON.stringify(res.body).slice(0, 140)}`);
      };
      test(label, run);
    }
  }

  test("a manager naming another hostel when creating a room can only ever create it in their own hostel", async () => {
    const res = await (await as(w.users.managerB)).post("/rooms", { propertyId: w.A.id, number: "777", floor: 1, type: "single", rent: 100 });
    assert.ok([201, 403].includes(res.status), `got ${res.status}`);
    if (res.status === 201) assert.equal(res.body.data.propertyId, w.B.id, "room landed in the other hostel");
    assert.equal(await prisma.room.count({ where: { propertyId: w.A.id, number: "777" } }), 0);
  });

  test("a manager naming another hostel when admitting a student can only ever create it in their own hostel", async () => {
    const res = await (await as(w.users.managerB)).post("/students", {
      name: "Newbie", email: "newbie@example.test", phone: "9876543210", gender: "male", dob: "2005-01-01",
      studentCode: "ZZ1", college: "c", course: "c", year: 1, joinedOn: "2026-01-01", monthlyRent: 1, propertyId: w.A.id,
    });
    assert.ok([201, 403].includes(res.status), `got ${res.status}`);
    if (res.status === 201) assert.equal(res.body.data.propertyId, w.B.id, "student landed in the other hostel");
  });

  test("owner and the hostel's own manager can still perform staff actions", async () => {
    const mgr = await as(w.users.managerA);
    const res = await mgr.patch(`/students/${w.waitlistA.id}/status`, { status: "notice" });
    assert.equal(res.status, 200);
    const owner = await as(w.users.owner);
    assert.equal((await owner.patch(`/properties/${w.A.id}`, { phone: "9876500099" })).status, 200);
  });

  test("a manager can still manage rooms and beds in their own hostel", async () => {
    const mgr = await as(w.users.managerA);
    const room = await mgr.post("/rooms", { number: "301", floor: 3, type: "single", rent: 7000 });
    assert.equal(room.status, 201);
    assert.equal((await mgr.patch(`/rooms/${room.body.data.id}`, { rent: 7500 })).status, 200);
    assert.equal((await mgr.patch(`/beds/${w.roomA.beds[1].id}/status`, { status: "unavailable", reason: "repair" })).status, 200);
    assert.equal((await mgr.post("/beds/assign", { studentId: w.waitlistA.id, bedId: w.roomA2.beds[0].id })).status, 200);
    assert.equal((await mgr.post("/beds/vacate", { studentId: w.waitlistA.id })).status, 200);
  });

  test("a manager cannot edit their hostel's property record (owner-only)", async () => {
    const mgr = await as(w.users.managerA);
    for (const body of [{ baseRent: 1 }, { type: "boys" }, { status: "inactive" }, { managerStaffId: "x" }]) {
      assert.equal((await mgr.patch(`/properties/${w.A.id}`, body)).status, 403, JSON.stringify(body));
    }
  });
});

describe("student data privacy and cross-property isolation (must hold today)", () => {
  test("a student's student list contains only themselves", async () => {
    const res = await (await as(w.users.studentA)).get("/students");
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.data.map((s) => s.id), [w.residentA.id]);
  });

  test("a student cannot read another student's record (same hostel or other)", async () => {
    const c = await as(w.users.studentA);
    assert.equal((await c.get(`/students/${w.waitlistA.id}`)).status, 403);
    assert.equal((await c.get(`/students/${w.residentB.id}`)).status, 403);
  });

  test("a student cannot read another student's charges or receipts", async () => {
    const c = await as(w.users.studentA);
    const charges = await c.get("/charges");
    assert.equal(charges.status, 200);
    assert.ok(charges.body.data.every((x) => x.studentId === w.residentA.id));
  });

  test("a manager cannot read another hostel's students, students list is scoped", async () => {
    const c = await as(w.users.managerA);
    const list = await c.get("/students");
    assert.ok(list.body.data.every((s) => s.propertyId === w.A.id));
    assert.equal((await c.get(`/students/${w.residentB.id}`)).status, 403);
    assert.equal((await c.get("/students", { propertyId: w.B.id })).status, 403);
  });

  test("a manager cannot read or touch another hostel's property", async () => {
    const c = await as(w.users.managerA);
    assert.equal((await c.get(`/properties/${w.B.id}`)).status, 403);
    const list = await c.get("/properties");
    assert.deepEqual(list.body.data.map((p) => p.id), [w.A.id]);
  });

  test("a manager cannot assign a resident into another hostel's bed", async () => {
    const c = await as(w.users.managerA);
    const res = await c.post("/beds/assign", { studentId: w.waitlistA.id, bedId: w.roomB.beds[1].id });
    assert.ok([403, 409].includes(res.status), `got ${res.status}`);
  });

  test("a manager cannot pay against, or remind for, another hostel's charges", async () => {
    const c = await as(w.users.managerA);
    const rec = await c.post("/payments/record", { chargeId: w.chargeB.id, amount: 100, method: "cash", paidOn: "2026-01-06", reference: "" });
    assert.equal(rec.status, 403);
  });
});

describe("an owner and their organization", () => {
  // Isolation between different organizations is covered in tenancy.test.js.
  test("an owner sees every property of their own organization", async () => {
    const res = await (await as(w.users.owner)).get("/properties");
    assert.deepEqual(res.body.data.map((p) => p.id).sort(), [w.A.id, w.B.id].sort());
  });
});

