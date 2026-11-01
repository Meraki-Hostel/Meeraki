import "./helpers/env.js";
import { describe, test, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { prisma, resetDb, seedWorld, seedOtherOrg, disconnect, makeRoom, makeStudent, makeUser } from "./helpers/db.js";
import { as } from "./helpers/api.js";

let w;
let x;
let upstairs; // a second resident of hostel A, in room 301 on floor 3
beforeEach(async () => {
  await resetDb();
  w = await seedWorld();
  x = await seedOtherOrg();
  const r = await makeRoom(w.A, "301", "single", ["A"]);
  await prisma.room.update({ where: { id: r.room.id }, data: { floor: 3 } });
  const s = await makeStudent(w.A, "Resident Up", { bed: r.beds[0] });
  upstairs = await makeUser(w.org, "student", "Resident Up", { propertyId: w.A.id, studentId: s.id });
});
after(async () => { await resetDb(); await disconnect(); });

const notice = (extra = {}) => ({ title: "Water off on Sunday", body: "Tank cleaning 10am-1pm.", category: "maintenance", audience: { type: "all", values: [] }, publish: false, ...extra });

describe("announcements", () => {
  test("a draft is invisible to residents and notifies nobody; publishing notifies the audience", async () => {
    const mgr = await as(w.users.managerA);
    const draft = await mgr.post("/announcements", notice());
    assert.equal(draft.status, 201);
    assert.equal(draft.body.data.status, "draft");
    assert.equal(draft.body.data.author, "Manager A");
    assert.deepEqual(draft.body.data.audience, { type: "all", values: [] });
    assert.equal((await (await as(w.users.studentA)).get("/announcements")).body.data.length, 0);
    assert.equal(await prisma.notification.count({ where: { category: "notice" } }), 0);

    const pub = await mgr.post(`/announcements/${draft.body.data.id}/publish`);
    assert.equal(pub.status, 200);
    assert.equal(pub.body.data.status, "published");
    assert.ok(pub.body.data.publishedAt);
    const notified = (await prisma.notification.findMany({ where: { category: "notice" } })).map((n) => n.recipientUserId).sort();
    assert.deepEqual(notified, [w.users.studentA.id, upstairs.id].sort(), "only hostel A residents");
    assert.equal((await mgr.post(`/announcements/${draft.body.data.id}/publish`)).status, 409);
  });

  test("floor and room audiences reach only the residents they name", async () => {
    const mgr = await as(w.users.managerA);
    await mgr.post("/announcements", notice({ title: "Floor 3 only", audience: { type: "floors", values: ["3"] }, publish: true }));
    await mgr.post("/announcements", notice({ title: "Room 101 only", audience: { type: "rooms", values: ["101"] }, publish: true }));
    await mgr.post("/announcements", notice({ title: "Everyone", publish: true }));
    const titles = async (u) => (await (await as(u)).get("/announcements")).body.data.map((a) => a.title).sort();
    assert.deepEqual(await titles(w.users.studentA), ["Everyone", "Room 101 only"]);
    assert.deepEqual(await titles(upstairs), ["Everyone", "Floor 3 only"]);
    assert.deepEqual(await titles(w.users.studentB), [], "another hostel sees nothing");
    assert.equal((await mgr.post("/announcements", notice({ audience: { type: "rooms", values: [] } }))).status, 422);
  });

  test("read state is per resident; readBy never reveals other residents", async () => {
    const mgr = await as(w.users.managerA);
    const a = (await mgr.post("/announcements", notice({ publish: true }))).body.data;
    const stuA = await as(w.users.studentA);
    const up = await as(upstairs);
    assert.deepEqual(await stuA.post(`/announcements/${a.id}/read`, { read: true }).then((r) => r.body.data), { ok: true });
    await up.post(`/announcements/${a.id}/read`, { read: true });
    const mine = (await stuA.get("/announcements")).body.data[0];
    assert.equal(mine.isRead, true);
    assert.deepEqual(mine.readBy, [w.users.studentA.studentId]);
    const staffView = (await mgr.get("/announcements")).body.data[0];
    assert.equal(staffView.readBy.length, 2);
    assert.equal("isRead" in staffView, false);
    await stuA.post(`/announcements/${a.id}/read`, { read: false });
    assert.equal((await stuA.get("/announcements")).body.data[0].isRead, false);
    await stuA.post("/announcements/read-all");
    assert.equal((await stuA.get("/announcements")).body.data[0].isRead, true);
  });

  test("staff cannot mark read; residents cannot create; a resident cannot mark a notice not meant for them", async () => {
    const mgr = await as(w.users.managerA);
    const a = (await mgr.post("/announcements", notice({ audience: { type: "floors", values: ["3"] }, publish: true }))).body.data;
    assert.equal((await mgr.post(`/announcements/${a.id}/read`, { read: true })).status, 403);
    assert.equal((await mgr.post("/announcements/read-all")).status, 403);
    const stuA = await as(w.users.studentA);
    assert.equal((await stuA.post("/announcements", notice())).status, 403);
    assert.equal((await stuA.post(`/announcements/${a.id}/read`, { read: true })).status, 404);
    assert.equal((await (await as(w.users.studentB)).post(`/announcements/${a.id}/read`, { read: true })).status, 404);
  });

  test("editing, archiving and scope", async () => {
    const mgr = await as(w.users.managerA);
    const a = (await mgr.post("/announcements", notice({ publish: true }))).body.data;
    const edited = await mgr.patch(`/announcements/${a.id}`, { ...notice(), title: "Water off on Monday" });
    assert.equal(edited.body.data.title, "Water off on Monday");
    assert.equal(edited.body.data.status, "published", "editing keeps it published");
    assert.equal((await mgr.post(`/announcements/${a.id}/archive`)).body.data.status, "archived");
    assert.equal((await mgr.patch(`/announcements/${a.id}`, notice())).status, 409);
    assert.equal((await mgr.post(`/announcements/${a.id}/archive`)).status, 409);
    assert.equal((await mgr.get("/announcements", { status: "archived" })).body.data.length, 1);
    assert.equal((await (await as(w.users.studentA)).get("/announcements")).body.data.length, 0, "archived notices disappear for residents");
    assert.equal((await (await as(w.users.managerB)).post(`/announcements/${a.id}/archive`)).status, 403);
    assert.equal((await (await as(x.users.ownerX)).patch(`/announcements/${a.id}`, notice())).status, 404);
  });

  test("an owner must choose a property of their own organization", async () => {
    const owner = await as(w.users.owner);
    assert.equal((await owner.post("/announcements", notice())).status, 422);
    assert.equal((await owner.post("/announcements", notice({ propertyId: x.X.id }))).status, 404);
    const ok = await owner.post("/announcements", notice({ propertyId: w.B.id, publish: true }));
    assert.equal(ok.status, 201);
    assert.equal(ok.body.data.propertyName, "Hostel B");
  });
});

const event = (extra = {}) => ({ title: "Diwali night", description: "Lights and food", category: "festival", date: "2026-11-08", startTime: "18:00", endTime: "22:00", location: "Terrace", capacity: 60, expectedAttendance: 40, ...extra });

describe("events", () => {
  test("staff create and edit; residents of the property see them", async () => {
    const mgr = await as(w.users.managerA);
    const e = await mgr.post("/events", event());
    assert.equal(e.status, 201);
    assert.equal(e.body.data.status, "scheduled");
    assert.equal(e.body.data.date, "2026-11-08");
    assert.equal(e.body.data.createdBy, "Manager A");
    const ed = await mgr.patch(`/events/${e.body.data.id}`, { location: "Common room", capacity: 50 });
    assert.equal(ed.body.data.location, "Common room");
    assert.equal((await (await as(w.users.studentA)).get("/events")).body.data.length, 1);
    assert.equal((await (await as(w.users.studentB)).get("/events")).body.data.length, 0);
    assert.equal((await (await as(w.users.studentA)).post("/events", event())).status, 403);
  });

  test("times, capacity and attendance are validated", async () => {
    const mgr = await as(w.users.managerA);
    const bad = await mgr.post("/events", event({ startTime: "22:00", endTime: "18:00", expectedAttendance: 100 }));
    assert.equal(bad.status, 422);
    assert.ok(bad.body.error.fieldErrors.endTime && bad.body.error.fieldErrors.expectedAttendance);
    assert.equal((await mgr.post("/events", event({ startTime: "25:00" }))).status, 422);
    const e = (await mgr.post("/events", event())).body.data;
    assert.equal((await mgr.patch(`/events/${e.id}`, { capacity: 10 })).status, 422, "attendance would exceed new capacity");
  });

  test("cancelling notifies residents; only scheduled events change status, once", async () => {
    const mgr = await as(w.users.managerA);
    const e = (await mgr.post("/events", event())).body.data;
    const c = await mgr.patch(`/events/${e.id}/status`, { status: "cancelled" });
    assert.equal(c.body.data.status, "cancelled");
    const notified = (await prisma.notification.findMany({ where: { category: "event" } })).map((n) => n.recipientUserId).sort();
    assert.deepEqual(notified, [w.users.studentA.id, upstairs.id].sort());
    assert.equal((await mgr.patch(`/events/${e.id}/status`, { status: "completed" })).status, 409);
    assert.equal((await mgr.patch(`/events/${e.id}`, { title: "Renamed" })).status, 409);
    const e2 = (await mgr.post("/events", event())).body.data;
    assert.equal((await mgr.patch(`/events/${e2.id}/status`, { status: "scheduled" })).status, 409);
    assert.equal((await mgr.get("/events", { status: "cancelled" })).body.data.length, 1);
    assert.equal((await (await as(w.users.studentA)).get("/events")).body.data.length, 2, "residents see cancellations too");
  });

  test("scope: other hostels and organizations", async () => {
    const mgr = await as(w.users.managerA);
    const e = (await mgr.post("/events", event())).body.data;
    assert.equal((await (await as(w.users.managerB)).patch(`/events/${e.id}`, { title: "x x x" })).status, 403);
    assert.equal((await (await as(x.users.ownerX)).patch(`/events/${e.id}/status`, { status: "cancelled" })).status, 404);
    assert.equal((await (await as(x.users.ownerX)).get("/events")).body.data.length, 0);
    const owner = await as(w.users.owner);
    assert.equal((await owner.post("/events", event({ propertyId: w.B.id }))).status, 201);
    assert.equal((await owner.get("/events")).body.data.length, 2);
    assert.equal((await owner.get("/events", { propertyId: w.B.id })).body.data.length, 1);
  });
});
