import "./helpers/env.js";
import { describe, test, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { prisma, resetDb, seedWorld, seedOtherOrg, disconnect } from "./helpers/db.js";
import { as } from "./helpers/api.js";
import { todayISO } from "../src/utils/money.js";

// Org One (w): hostels A and B.  Org Two (x): hostel X.  Nothing may cross between them.
let w, x;
beforeEach(async () => { await resetDb(); w = await seedWorld(); x = await seedOtherOrg(); });
after(disconnect);

const hidden = (res) => assert.ok([403, 404].includes(res.status), `expected 403/404, got ${res.status}: ${JSON.stringify(res.body).slice(0, 120)}`);

describe("an owner sees only their own organization", () => {
  test("property list, in both directions", async () => {
    const one = (await (await as(w.users.owner)).get("/properties")).body.data.map((p) => p.id).sort();
    assert.deepEqual(one, [w.A.id, w.B.id].sort());
    const two = (await (await as(x.users.ownerX)).get("/properties")).body.data.map((p) => p.id);
    assert.deepEqual(two, [x.X.id]);
  });

  test("another organization's property is not found: read, edit, status", async () => {
    const owner = await as(w.users.owner);
    assert.equal((await owner.get(`/properties/${x.X.id}`)).status, 404);
    assert.equal((await owner.patch(`/properties/${x.X.id}`, { baseRent: 1 })).status, 404);
    assert.equal((await owner.patch(`/properties/${x.X.id}/status`, { status: "inactive" })).status, 404);
    const X = await prisma.property.findUnique({ where: { id: x.X.id } });
    assert.equal(X.baseRent, 9500);
    assert.equal(X.status, "active");
  });

  test("rooms, students, charges and payments lists never include the other organization", async () => {
    await (await as(x.users.managerX)).post("/payments/record", { chargeId: x.chargeX.id, amount: 100, method: "cash", paidOn: todayISO(), reference: "" });
    const owner = await as(w.users.owner);
    const rooms = (await owner.get("/rooms")).body.data;
    assert.ok(rooms.length && rooms.every((r) => r.propertyId !== x.X.id));
    const students = (await owner.get("/students")).body.data;
    assert.ok(students.length && students.every((s) => s.propertyId !== x.X.id));
    const charges = (await owner.get("/charges")).body.data;
    assert.ok(charges.length && charges.every((c) => c.propertyId !== x.X.id));
    const payments = (await owner.get("/payments")).body.data;
    assert.ok(payments.every((p) => p.propertyId !== x.X.id));
  });

  test("asking for the other organization's property by filter is refused, not answered empty", async () => {
    const owner = await as(w.users.owner);
    for (const path of ["/rooms", "/students", "/charges", "/payments", "/payments/summary", "/activity"]) {
      hidden(await owner.get(path, { propertyId: x.X.id }));
    }
  });

  test("collection summary totals only count the owner's organization", async () => {
    const sum = (await (await as(w.users.owner)).get("/payments/summary", { period: "all" })).body.data;
    assert.equal(sum.expected, 9500 * 2, "summary includes another organization's dues");
  });

  test("individual records of the other organization are not found", async () => {
    const paid = (await (await as(x.users.managerX)).post("/payments/record", { chargeId: x.chargeX.id, amount: 100, method: "cash", paidOn: todayISO(), reference: "" })).body.data;
    const owner = await as(w.users.owner);
    hidden(await owner.get(`/students/${x.residentX.id}`));
    hidden(await owner.get(`/payments/${paid.id}/receipt`));
  });
});

describe("an owner cannot change the other organization", () => {
  test("rooms, beds, students and payments writes are refused and change nothing", async () => {
    const owner = await as(w.users.owner);
    hidden(await owner.post("/rooms", { propertyId: x.X.id, number: "666", floor: 1, type: "single", rent: 1 }));
    hidden(await owner.patch(`/rooms/${x.roomX.room.id}`, { rent: 1 }));
    hidden(await owner.patch(`/beds/${x.roomX.beds[1].id}/status`, { status: "unavailable", reason: "x" }));
    hidden(await owner.post("/beds/vacate", { studentId: x.residentX.id }));
    hidden(await owner.post("/students", { name: "Intruder", email: "i@example.test", phone: "9876543210", gender: "male", dob: "2005-01-01", college: "c", course: "c", year: 1, joinedOn: "2026-01-01", monthlyRent: 1, propertyId: x.X.id }));
    hidden(await owner.patch(`/students/${x.residentX.id}`, { college: "Changed" }));
    hidden(await owner.patch(`/students/${x.residentX.id}/status`, { status: "moved_out" }));
    hidden(await owner.post("/payments/record", { chargeId: x.chargeX.id, amount: 100, method: "cash", paidOn: todayISO(), reference: "" }));

    assert.equal(await prisma.room.count({ where: { propertyId: x.X.id } }), 1);
    assert.equal((await prisma.room.findUnique({ where: { id: x.roomX.room.id } })).rent, 9500);
    const resident = await prisma.studentProfile.findUnique({ where: { id: x.residentX.id } });
    assert.equal(resident.status, "active");
    assert.equal(resident.college, "Test College");
    assert.equal((await prisma.bed.findUnique({ where: { id: x.roomX.beds[0].id } })).status, "occupied");
    assert.equal(await prisma.payment.count({ where: { propertyId: x.X.id } }), 0);
    assert.equal(await prisma.studentProfile.count({ where: { name: "Intruder" } }), 0);
  });

  test("a property can't be given the other organization's staff member as manager", async () => {
    const owner = await as(w.users.owner);
    const created = await owner.post("/properties", { name: "New One", code: "NEW1", type: "boys", locality: "l", city: "c", address: "a", pincode: "122003", phone: "9876500000", baseRent: 1, managerStaffId: x.staffX.id });
    assert.equal(created.status, 422);
    assert.ok(created.body.error.fieldErrors?.managerStaffId);
    assert.equal((await owner.patch(`/properties/${w.A.id}`, { managerStaffId: x.staffX.id })).status, 422);
  });
});

describe("new records belong to the creator's organization", () => {
  test("a property an owner creates is theirs and invisible to the other owner", async () => {
    const res = await (await as(w.users.owner)).post("/properties", { name: "Fresh", code: "FRSH", type: "girls", locality: "l", city: "c", address: "a", pincode: "122003", phone: "9876500000", baseRent: 1 });
    assert.equal(res.status, 201);
    assert.equal((await prisma.property.findUnique({ where: { id: res.body.data.id } })).orgId, w.org.id);
    const seenByOther = (await (await as(x.users.ownerX)).get("/properties")).body.data.map((p) => p.id);
    assert.ok(!seenByOther.includes(res.body.data.id));
  });

  test("activity is recorded per organization and each owner's feed holds only theirs", async () => {
    await (await as(x.users.managerX)).post("/payments/record", { chargeId: x.chargeX.id, amount: 100, method: "cash", paidOn: todayISO(), reference: "" });
    await (await as(w.users.managerA)).post("/payments/record", { chargeId: w.chargeA.id, amount: 100, method: "cash", paidOn: todayISO(), reference: "" });
    assert.equal((await prisma.activityLog.findFirst({ where: { propertyId: x.X.id } })).orgId, x.org.id);
    const feed = (await (await as(w.users.owner)).get("/activity")).body.data;
    assert.ok(feed.length >= 1 && feed.every((a) => a.propertyId !== x.X.id));
  });

  test("payment notifications reach only the property's own owner", async () => {
    // simulated online payment notifies staff + owners of that property's organization
    await (await as(x.users.studentX)).post("/payments/pay-now", { chargeId: x.chargeX.id, method: "upi" });
    assert.ok(await prisma.notification.count({ where: { recipientUserId: x.users.ownerX.id } }) >= 1);
    assert.equal(await prisma.notification.count({ where: { recipientUserId: w.users.owner.id } }), 0, "another business's owner was notified");
  });
});

describe("membership follows the database", () => {
  test("an owner moved to another organization immediately sees only the new one", async () => {
    const owner = await as(w.users.owner); // token issued while in Org One
    await prisma.user.update({ where: { id: w.users.owner.id }, data: { orgId: x.org.id } });
    const ids = (await owner.get("/properties")).body.data.map((p) => p.id);
    assert.deepEqual(ids, [x.X.id]);
  });
});

describe("the database refuses cross-organization links", () => {
  test("a manager whose organization differs from their property's", async () => {
    await assert.rejects(prisma.user.create({
      data: { orgId: w.org.id, name: "Crossed", email: "crossed@example.test", phone: "9800000001", role: "manager", title: "m", passwordHash: "x", propertyId: x.X.id },
    }), /Foreign key constraint/i);
  });

  test("moving a hostel's manager into another organization without their hostel", async () => {
    await assert.rejects(prisma.user.update({ where: { id: w.users.managerA.id }, data: { orgId: x.org.id } }), /Foreign key constraint/i);
  });

  test("staff, invitations and activity rows pointing across organizations", async () => {
    await assert.rejects(prisma.staffMember.create({ data: { orgId: w.org.id, name: "s", role: "warden", propertyId: x.X.id, phone: "1", email: "s@example.test", joinedOn: new Date() } }), /Foreign key constraint/i);
    await assert.rejects(prisma.invitation.create({ data: { orgId: w.org.id, tokenHash: "t-x", name: "n", email: "n@example.test", role: "manager", propertyId: x.X.id, invitedBy: "x", expiresAt: new Date() } }), /Foreign key constraint/i);
    await assert.rejects(prisma.activityLog.create({ data: { orgId: w.org.id, propertyId: x.X.id, actorName: "a", actorRole: "owner", category: "c", message: "m" } }), /Foreign key constraint/i);
  });
});
