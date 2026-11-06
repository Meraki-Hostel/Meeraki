import "./helpers/env.js";
import { describe, test, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { prisma, resetDb, seedWorld, disconnect } from "./helpers/db.js";
import { as } from "./helpers/api.js";

let w;
beforeEach(async () => { await resetDb(); w = await seedWorld(); });
after(disconnect);

const logs = () => prisma.activityLog.findMany({ orderBy: { createdAt: "asc" } });
const notesFor = (userId) => prisma.notification.findMany({ where: { recipientUserId: userId } });

// Runs the action and returns the activity rows it added.
async function added(action) {
  const before = await prisma.activityLog.count();
  const res = await action();
  assert.ok(res.status < 300, `${res.status} ${JSON.stringify(res.body)}`);
  const rows = await logs();
  return rows.slice(before);
}

describe("rooms and beds leave a trail (#23)", () => {
  test("adding a room logs one row with the room number and bed count", async () => {
    const mgr = await as(w.users.managerA);
    const rows = await added(() => mgr.post("/rooms", { number: "305", floor: 3, type: "triple", rent: 8000 }));
    assert.equal(rows.length, 1);
    assert.equal(rows[0].category, "room");
    assert.equal(rows[0].propertyId, w.A.id);
    assert.equal(rows[0].actorName, "Manager A");
    assert.match(rows[0].message, /Room 305 added \(triple, 3 beds\)/);
  });

  test("editing a room logs one row and mentions a type change", async () => {
    const mgr = await as(w.users.managerA);
    const rows = await added(() => mgr.patch(`/rooms/${w.roomA2.room.id}`, { type: "double" }));
    assert.equal(rows.length, 1);
    assert.match(rows[0].message, /Room 102 updated \(now double\)/);
  });

  test("marking a bed unavailable logs the bed and the reason; setting the same status again does not", async () => {
    const mgr = await as(w.users.managerA);
    const bed = w.roomA.beds[1];
    const rows = await added(() => mgr.patch(`/beds/${bed.id}/status`, { status: "unavailable", reason: "Broken frame" }));
    assert.equal(rows.length, 1);
    assert.match(rows[0].message, /Bed 101-B marked unavailable: Broken frame/);

    const again = await added(() => mgr.patch(`/beds/${bed.id}/status`, { status: "unavailable", reason: "Broken frame" }));
    assert.equal(again.length, 0);
  });

  test("assigning a bed logs it and tells the student", async () => {
    const mgr = await as(w.users.managerA);
    const rows = await added(() => mgr.post("/beds/assign", { studentId: w.waitlistA.id, bedId: w.roomA.beds[1].id }));
    assert.equal(rows.length, 1);
    assert.match(rows[0].message, /Waitlist A assigned to bed 101-B/);
  });

  test("moving a resident logs both beds and notifies them", async () => {
    const mgr = await as(w.users.managerA);
    const rows = await added(() => mgr.post("/beds/assign", { studentId: w.residentA.id, bedId: w.roomA2.beds[0].id }));
    assert.equal(rows.length, 1);
    assert.match(rows[0].message, /Resident A moved from bed 101-A to 102-A/);
    const notes = await notesFor(w.users.studentA.id);
    assert.equal(notes.length, 1);
    assert.equal(notes[0].title, "Your bed has changed");
    assert.match(notes[0].body, /101-A to 102-A/);
  });

  test("vacating a bed logs it and notifies the resident", async () => {
    const mgr = await as(w.users.managerA);
    const rows = await added(() => mgr.post("/beds/vacate", { studentId: w.residentA.id }));
    assert.equal(rows.length, 1);
    assert.match(rows[0].message, /Resident A vacated bed 101-A/);
    assert.equal((await notesFor(w.users.studentA.id)).length, 1);
  });

  test("a refused assignment writes nothing", async () => {
    const mgr = await as(w.users.managerA);
    const res = await mgr.post("/beds/assign", { studentId: w.waitlistA.id, bedId: w.roomA.beds[0].id });
    assert.equal(res.status, 409);
    assert.equal(await prisma.activityLog.count(), 0);
    assert.equal(await prisma.notification.count(), 0);
  });
});

describe("properties and residents leave a trail (#23)", () => {
  test("editing a property logs one row", async () => {
    const owner = await as(w.users.owner);
    const rows = await added(() => owner.patch(`/properties/${w.A.id}`, { baseRent: 9900 }));
    assert.equal(rows.length, 1);
    assert.equal(rows[0].category, "property");
    assert.match(rows[0].message, /Property details updated: Hostel A/);
  });

  test("changing a property's status logs it once; repeating it does not", async () => {
    const owner = await as(w.users.owner);
    const rows = await added(() => owner.patch(`/properties/${w.A.id}/status`, { status: "inactive" }));
    assert.equal(rows.length, 1);
    assert.match(rows[0].message, /Hostel A is now inactive/);
    assert.equal((await added(() => owner.patch(`/properties/${w.A.id}/status`, { status: "inactive" }))).length, 0);
  });

  test("editing a resident logs one row", async () => {
    const mgr = await as(w.users.managerA);
    const rows = await added(() => mgr.patch(`/students/${w.residentA.id}`, { college: "New College" }));
    assert.equal(rows.length, 1);
    assert.equal(rows[0].category, "student");
    assert.match(rows[0].message, /Resident details updated: Resident A/);
  });

  test("changing a resident's status logs it in plain words", async () => {
    const mgr = await as(w.users.managerA);
    const rows = await added(() => mgr.patch(`/students/${w.residentA.id}/status`, { status: "notice" }));
    assert.equal(rows.length, 1);
    assert.match(rows[0].message, /Resident A marked on notice/);
  });

  test("an owner forcing a move-out with dues is called out in the log", async () => {
    const owner = await as(w.users.owner);
    const rows = await added(() => owner.patch(`/students/${w.residentA.id}/status`, { status: "moved_out", force: true }));
    assert.equal(rows.length, 1);
    assert.match(rows[0].message, /Resident A marked moved out \(approved with dues outstanding\)/);
  });

  test("a refused move-out writes nothing", async () => {
    const mgr = await as(w.users.managerA);
    const res = await mgr.patch(`/students/${w.residentA.id}/status`, { status: "moved_out" });
    assert.equal(res.status, 409);
    assert.equal(await prisma.activityLog.count(), 0);
  });
});

describe("the activity feed shows these events to the right people", () => {
  test("manager A sees their hostel's events and manager B does not", async () => {
    await (await as(w.users.managerA)).post("/beds/vacate", { studentId: w.residentA.id });
    const a = await (await as(w.users.managerA)).get("/activity", { category: "room" });
    assert.equal(a.status, 200);
    assert.ok(a.body.data.some((r) => /vacated bed 101-A/.test(r.message)));
    const b = await (await as(w.users.managerB)).get("/activity", { category: "room" });
    assert.equal(b.body.data.length, 0);
  });

  test("the owner sees them on the organization-wide feed", async () => {
    await (await as(w.users.managerA)).post("/rooms", { number: "401", floor: 4, type: "single", rent: 9000 });
    const res = await (await as(w.users.owner)).get("/activity");
    assert.ok(res.body.data.some((r) => /Room 401 added/.test(r.message)));
  });
});
