import "./helpers/env.js";
import { describe, test, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { prisma, resetDb, seedWorld, disconnect } from "./helpers/db.js";
import { as } from "./helpers/api.js";

let w;
beforeEach(async () => { await resetDb(); w = await seedWorld(); });
after(disconnect);

describe("activity log: property, room, bed and student changes (#23)", () => {
  test("updating a property logs one activity row", async () => {
    const owner = await as(w.users.owner);
    assert.equal((await owner.patch(`/properties/${w.A.id}`, { phone: "9876500099" })).status, 200);
    assert.equal(await prisma.activityLog.count({ where: { category: "property", propertyId: w.A.id, message: { contains: "updated" } } }), 1);
  });

  test("changing a property's status logs one activity row", async () => {
    const owner = await as(w.users.owner);
    assert.equal((await owner.patch(`/properties/${w.A.id}/status`, { status: "inactive" })).status, 200);
    assert.equal(await prisma.activityLog.count({ where: { category: "property", propertyId: w.A.id, message: { contains: "status changed" } } }), 1);
  });

  test("updating a resident logs one activity row", async () => {
    const mgr = await as(w.users.managerA);
    assert.equal((await mgr.patch(`/students/${w.residentA.id}`, { college: "New College" })).status, 200);
    assert.equal(await prisma.activityLog.count({ where: { category: "student", propertyId: w.A.id, message: { contains: "details updated" } } }), 1);
  });

  test("changing a resident's status logs one activity row", async () => {
    const mgr = await as(w.users.managerA);
    assert.equal((await mgr.patch(`/students/${w.waitlistA.id}/status`, { status: "notice" })).status, 200);
    assert.equal(await prisma.activityLog.count({ where: { category: "student", propertyId: w.A.id, message: { contains: "status changed" } } }), 1);
  });

  test("creating a room logs one activity row", async () => {
    const mgr = await as(w.users.managerA);
    assert.equal((await mgr.post("/rooms", { propertyId: w.A.id, number: "301", floor: 3, type: "double", rent: 9500 })).status, 201);
    assert.equal(await prisma.activityLog.count({ where: { category: "room", propertyId: w.A.id, message: { contains: "Room added: 301" } } }), 1);
  });

  test("updating a room logs one activity row", async () => {
    const mgr = await as(w.users.managerA);
    assert.equal((await mgr.patch(`/rooms/${w.roomA2.room.id}`, { rent: 10000 })).status, 200);
    assert.equal(await prisma.activityLog.count({ where: { category: "room", propertyId: w.A.id, message: { contains: "Room updated: 102" } } }), 1);
  });

  test("blocking a bed logs one activity row", async () => {
    const mgr = await as(w.users.managerA);
    assert.equal((await mgr.patch(`/beds/${w.roomA.beds[1].id}/status`, { status: "unavailable", reason: "repair" })).status, 200);
    assert.equal(await prisma.activityLog.count({ where: { category: "room", propertyId: w.A.id, message: { contains: "marked unavailable" } } }), 1);
  });

  test("assigning a bed logs one activity row", async () => {
    const mgr = await as(w.users.managerA);
    assert.equal((await mgr.post("/beds/assign", { studentId: w.waitlistA.id, bedId: w.roomA.beds[1].id })).status, 200);
    assert.equal(await prisma.activityLog.count({ where: { category: "room", propertyId: w.A.id, message: { contains: "Assigned Waitlist A" } } }), 1);
  });

  test("transferring a resident to another bed logs one activity row and notifies them", async () => {
    const mgr = await as(w.users.managerA);
    assert.equal((await mgr.post("/beds/assign", { studentId: w.residentA.id, bedId: w.roomA.beds[1].id })).status, 200);
    assert.equal(await prisma.activityLog.count({ where: { category: "room", propertyId: w.A.id, message: { contains: "Transferred Resident A" } } }), 1);
    assert.equal(await prisma.notification.count({ where: { recipientUserId: w.users.studentA.id, category: "system", title: "Room changed" } }), 1);
  });

  test("vacating a bed logs one activity row and notifies the resident", async () => {
    const mgr = await as(w.users.managerA);
    assert.equal((await mgr.post("/beds/vacate", { studentId: w.residentA.id })).status, 200);
    assert.equal(await prisma.activityLog.count({ where: { category: "room", propertyId: w.A.id, message: { contains: "Vacated Resident A" } } }), 1);
    assert.equal(await prisma.notification.count({ where: { recipientUserId: w.users.studentA.id, category: "system", title: "Bed vacated" } }), 1);
  });
});
