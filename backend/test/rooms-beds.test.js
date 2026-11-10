import "./helpers/env.js";
import { describe, test, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { prisma, resetDb, seedWorld, disconnect, bedInvariantViolations } from "./helpers/db.js";
import { as } from "./helpers/api.js";

let w;
beforeEach(async () => { await resetDb(); w = await seedWorld(); });
after(disconnect);

const roomByNumber = async (client, propertyId, number) => {
  const list = await client.get("/rooms", { propertyId });
  assert.equal(list.status, 200);
  return list.body.data.find((r) => r.number === number);
};

describe("bed assignment and vacating (baseline that must keep working)", () => {
  test("assigning a free bed marks it occupied and activates a pending resident", async () => {
    const mgr = await as(w.users.managerA);
    const res = await mgr.post("/beds/assign", { studentId: w.waitlistA.id, bedId: w.roomA.beds[1].id });
    assert.equal(res.status, 200);
    const s = await prisma.studentProfile.findUnique({ where: { id: w.waitlistA.id } });
    assert.equal(s.bedId, w.roomA.beds[1].id);
    assert.equal(s.status, "active");
    assert.deepEqual(await bedInvariantViolations(), []);
  });

  test("assigning an occupied bed → 409", async () => {
    const mgr = await as(w.users.managerA);
    const res = await mgr.post("/beds/assign", { studentId: w.waitlistA.id, bedId: w.roomA.beds[0].id });
    assert.equal(res.status, 409);
  });

  test("moving a resident frees the old bed", async () => {
    const mgr = await as(w.users.managerA);
    const res = await mgr.post("/beds/assign", { studentId: w.residentA.id, bedId: w.roomA.beds[1].id });
    assert.equal(res.status, 200);
    const old = await prisma.bed.findUnique({ where: { id: w.roomA.beds[0].id } });
    assert.equal(old.status, "available");
    assert.equal(old.studentId, null);
    assert.deepEqual(await bedInvariantViolations(), []);
  });

  test("vacate frees the bed and clears the resident's room and bed", async () => {
    const mgr = await as(w.users.managerA);
    assert.equal((await mgr.post("/beds/vacate", { studentId: w.residentA.id })).status, 200);
    const bed = await prisma.bed.findUnique({ where: { id: w.roomA.beds[0].id } });
    assert.equal(bed.status, "available");
    const s = await prisma.studentProfile.findUnique({ where: { id: w.residentA.id } });
    assert.equal(s.bedId, null);
    assert.deepEqual(await bedInvariantViolations(), []);
  });

  test("a bed can be blocked only while it is not occupied", async () => {
    const mgr = await as(w.users.managerA);
    assert.equal((await mgr.patch(`/beds/${w.roomA.beds[1].id}/status`, { status: "unavailable", reason: "repair" })).status, 200);
    assert.equal((await mgr.patch(`/beds/${w.roomA.beds[0].id}/status`, { status: "unavailable" })).status, 409);
  });

  test("two managers assigning two residents to one bed at once: exactly one wins, data stays consistent", async () => {
    // The unique indexes on Bed.studentId / StudentProfile.bedId already prevent a
    // double booking; this guards that this keeps true and the loser gets a clean 409.
    const mgr = await as(w.users.managerA);
    for (let round = 0; round < 5; round++) {
      await prisma.bed.update({ where: { id: w.roomA.beds[1].id }, data: { status: "available", studentId: null } });
      await prisma.studentProfile.updateMany({ where: { id: { in: [w.waitlistA.id] } }, data: { bedId: null, roomId: null, status: "pending" } });
      const other = await prisma.studentProfile.upsert({
        where: { studentCode: "RACE2" },
        update: { bedId: null, roomId: null, status: "pending" },
        create: { studentCode: "RACE2", name: "Racer", email: "racer@example.test", phone: "9876599999", gender: "male", dob: new Date("2004-01-01"),
          college: "c", course: "c", year: 1, propertyId: w.A.id, joinedOn: new Date("2024-07-01"), monthlyRent: 1 },
      });
      const bedId = w.roomA.beds[1].id;
      const results = await Promise.all([
        mgr.post("/beds/assign", { studentId: w.waitlistA.id, bedId }),
        mgr.post("/beds/assign", { studentId: other.id, bedId }),
      ]);
      const statuses = results.map((r) => r.status).sort();
      assert.deepEqual(statuses, [200, 409], `round ${round}: ${JSON.stringify(results.map((r) => [r.status, r.body.error?.message]))}`);
      assert.deepEqual(await bedInvariantViolations(), [], `round ${round}`);
    }
  });
});

describe("room creation and capacity", () => {
  const CAPACITY = { single: 1, double: 2, triple: 3, quad: 4 };

  for (const [type, count] of Object.entries(CAPACITY)) {
    test(`[DEF-04] creating a ${type} room creates ${count} bed(s) labelled from A`, async () => {
      const owner = await as(w.users.owner);
      const res = await owner.post("/rooms", { propertyId: w.A.id, number: `T-${type}`, floor: 2, type, rent: 8000 });
      assert.equal(res.status, 201);
      const room = await roomByNumber(owner, w.A.id, `T-${type}`);
      assert.deepEqual(room.beds.map((b) => b.label), ["A", "B", "C", "D"].slice(0, count));
      assert.ok(room.beds.every((b) => b.status === "available"));
    });
  }

  test("creating multiple rooms in one request creates every room and its beds", async () => {
    const owner = await as(w.users.owner);
    const res = await owner.post("/rooms/bulk", {
      propertyId: w.A.id,
      rooms: [
        { number: "T-B1", floor: 3, type: "single", rent: 8000 },
        { number: "T-B2", floor: 3, type: "double", rent: 9000 },
      ],
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.data.length, 2);
    const r1 = await roomByNumber(owner, w.A.id, "T-B1");
    const r2 = await roomByNumber(owner, w.A.id, "T-B2");
    assert.equal(r1.beds.length, 1);
    assert.equal(r2.beds.length, 2);
  });

  test("a bulk request where one room's number repeats is rejected and creates nothing", async () => {
    const owner = await as(w.users.owner);
    const before = await prisma.room.count();
    const res = await owner.post("/rooms/bulk", {
      propertyId: w.A.id,
      rooms: [
        { number: "T-C1", floor: 3, type: "single", rent: 8000 },
        { number: "T-C1", floor: 3, type: "single", rent: 8000 },
      ],
    });
    assert.equal(res.status, 422);
    assert.equal(await prisma.room.count(), before);
  });

  test("a bulk request that collides with an existing room number is rejected and creates nothing", async () => {
    const owner = await as(w.users.owner);
    const before = await prisma.room.count();
    const res = await owner.post("/rooms/bulk", {
      propertyId: w.A.id,
      rooms: [
        { number: "T-D1", floor: 3, type: "single", rent: 8000 },
        { number: "101", floor: 1, type: "single", rent: 8000 }, // already exists
      ],
    });
    assert.equal(res.status, 409);
    assert.equal(await prisma.room.count(), before);
  });

  test("[DEF-04] raising a room's type adds the extra beds", async () => {
    const owner = await as(w.users.owner);
    assert.equal((await owner.patch(`/rooms/${w.roomA2.room.id}`, { type: "double" })).status, 200);
    const room = await roomByNumber(owner, w.A.id, "102");
    assert.equal(room.beds.length, 2);
  });

  test("[DEF-04] lowering a room's type removes only empty extra beds", async () => {
    const owner = await as(w.users.owner);
    // room 101 has A (occupied) and B (free) → single keeps A and drops B
    assert.equal((await owner.patch(`/rooms/${w.roomA.room.id}`, { type: "single" })).status, 200);
    const room = await roomByNumber(owner, w.A.id, "101");
    assert.deepEqual(room.beds.map((b) => b.label), ["A"]);
    assert.deepEqual(await bedInvariantViolations(), []);
  });

  test("[DEF-04] lowering a room's type below its residents is rejected", async () => {
    const owner = await as(w.users.owner);
    await owner.post("/beds/assign", { studentId: w.waitlistA.id, bedId: w.roomA.beds[1].id });
    const res = await owner.patch(`/rooms/${w.roomA.room.id}`, { type: "single" });
    assert.equal(res.status, 422, `got ${res.status}`);
    assert.equal((await prisma.bed.count({ where: { roomId: w.roomA.room.id } })), 2);
  });
});

// Moving out requires the resident's dues to be settled first.
const settleA = (mgr) => mgr.post("/payments/record", { chargeId: w.chargeA.id, amount: 9500, method: "cash", paidOn: "2026-01-05", reference: "" });

describe("checkout releases the bed and updates occupancy", () => {
  test("moving out with unpaid dues is refused for a manager, and allowed for an owner who confirms", async () => {
    const mgr = await as(w.users.managerA);
    const refused = await mgr.patch(`/students/${w.residentA.id}/status`, { status: "moved_out", force: true });
    assert.equal(refused.status, 409);
    assert.match(refused.body.error.message, /owes/);
    const owner = await as(w.users.owner);
    assert.equal((await owner.patch(`/students/${w.residentA.id}/status`, { status: "moved_out" })).status, 409);
    assert.equal((await owner.patch(`/students/${w.residentA.id}/status`, { status: "moved_out", force: true })).status, 200);
    assert.deepEqual(await bedInvariantViolations(), []);
  });

  test("[DEF-03] setting a resident to moved_out frees their bed", async () => {
    const mgr = await as(w.users.managerA);
    assert.equal((await settleA(mgr)).status, 201);
    const res = await mgr.patch(`/students/${w.residentA.id}/status`, { status: "moved_out" });
    assert.equal(res.status, 200);
    const bed = await prisma.bed.findUnique({ where: { id: w.roomA.beds[0].id } });
    assert.equal(bed.status, "available", "bed is still occupied after checkout");
    assert.equal(bed.studentId, null);
    const s = await prisma.studentProfile.findUnique({ where: { id: w.residentA.id } });
    assert.equal(s.bedId, null);
    assert.deepEqual(await bedInvariantViolations(), []);
  });

  test("[DEF-03] property occupancy drops after a checkout", async () => {
    const mgr = await as(w.users.managerA);
    const before = (await mgr.get(`/properties/${w.A.id}`)).body.data.stats;
    await settleA(mgr);
    assert.equal((await mgr.patch(`/students/${w.residentA.id}/status`, { status: "moved_out" })).status, 200);
    const after = (await mgr.get(`/properties/${w.A.id}`)).body.data.stats;
    assert.equal(after.occupiedBeds, before.occupiedBeds - 1);
    assert.equal(after.availableBeds, before.availableBeds + 1);
  });

  test("a checked-out resident's bed can be given to someone else once released (via vacate)", async () => {
    const mgr = await as(w.users.managerA);
    await mgr.post("/beds/vacate", { studentId: w.residentA.id });
    assert.equal((await mgr.post("/beds/assign", { studentId: w.waitlistA.id, bedId: w.roomA.beds[0].id })).status, 200);
    assert.deepEqual(await bedInvariantViolations(), []);
  });
});

describe("integrity under concurrency and edge cases", () => {
  test("a moved-out resident cannot be given a bed", async () => {
    const mgr = await as(w.users.managerA);
    await settleA(mgr);
    assert.equal((await mgr.patch(`/students/${w.residentA.id}/status`, { status: "moved_out" })).status, 200);
    const res = await mgr.post("/beds/assign", { studentId: w.residentA.id, bedId: w.roomA.beds[1].id });
    assert.equal(res.status, 409);
  });

  test("two admissions racing for one bed: one gets it, the other is told it is not available", async () => {
    const mgr = await as(w.users.managerA);
    const bedId = w.roomA.beds[1].id;
    for (let round = 0; round < 15; round++) {
      const body = (n) => ({ name: `Racer ${round}-${n}`, email: `r${round}-${n}@example.test`, phone: `9100${String(round).padStart(4, "0")}0${n}`, gender: "male", dob: "2005-01-01",
        college: "c", course: "c", year: 1, joinedOn: "2026-01-01", monthlyRent: 1, bedId });
      const results = await Promise.all([mgr.post("/students", body(1)), mgr.post("/students", body(2))]);
      assert.deepEqual(results.map((r) => r.status).sort(), [201, 422], `round ${round}: ${JSON.stringify(results.map((r) => [r.status, r.body.error?.message]))}`);
      assert.equal(await prisma.studentProfile.count({ where: { name: { startsWith: `Racer ${round}-` } } }), 1, "the losing admission left a student behind");
      assert.deepEqual(await bedInvariantViolations(), [], `round ${round}`);
      // free the bed for the next round
      const winner = await prisma.studentProfile.findFirst({ where: { bedId } });
      await prisma.$transaction([
        prisma.bed.update({ where: { id: bedId }, data: { status: "available", studentId: null } }),
        prisma.studentProfile.update({ where: { id: winner.id }, data: { bedId: null, roomId: null, status: "pending" } }),
      ]);
    }
  });

  test("a duplicate room number is rejected and leaves no orphan beds", async () => {
    const owner = await as(w.users.owner);
    const before = await prisma.bed.count();
    const res = await owner.post("/rooms", { propertyId: w.A.id, number: "101", floor: 1, type: "quad", rent: 1 });
    assert.equal(res.status, 409);
    assert.equal(await prisma.bed.count(), before);
  });

  test("changing only a room's rent leaves its beds alone", async () => {
    const owner = await as(w.users.owner);
    assert.equal((await owner.patch(`/rooms/${w.roomA.room.id}`, { rent: 1234 })).status, 200);
    assert.equal(await prisma.bed.count({ where: { roomId: w.roomA.room.id } }), 2);
  });
});

describe("database integrity rules (migration 20261023120000_bed_integrity)", () => {
  test("the database refuses an occupied bed without a resident", async () => {
    await assert.rejects(prisma.bed.update({ where: { id: w.roomA.beds[1].id }, data: { status: "occupied" } }), /check constraint/i);
  });

  test("the database refuses a resident on a bed that is not marked occupied", async () => {
    await assert.rejects(prisma.bed.update({ where: { id: w.roomA.beds[0].id }, data: { status: "available" } }), /check constraint/i);
  });

  test("the database refuses a moved-out resident who still holds a bed", async () => {
    await assert.rejects(prisma.studentProfile.update({ where: { id: w.residentA.id }, data: { status: "moved_out" } }), /check constraint/i);
  });
});
