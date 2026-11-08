import "./helpers/env.js";
import { describe, test, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { prisma, resetDb, seedWorld, seedOtherOrg, disconnect } from "./helpers/db.js";
import { as } from "./helpers/api.js";

let w;
let x;
let staffA;
let staffB;
beforeEach(async () => {
  await resetDb();
  w = await seedWorld();
  x = await seedOtherOrg();
  staffA = await prisma.staffMember.create({ data: { orgId: w.org.id, name: "Ravi Electrician", role: "maintenance", propertyId: w.A.id, phone: "9800022222", email: "ravi@example.test", joinedOn: new Date("2025-01-01") } });
  staffB = await prisma.staffMember.create({ data: { orgId: w.org.id, name: "Bina Plumber", role: "maintenance", propertyId: w.B.id, phone: "9800033333", email: "bina@example.test", joinedOn: new Date("2025-01-01") } });
});
after(async () => { await resetDb(); await disconnect(); });

const ticket = (extra = {}) => ({ title: "Geyser not heating", description: "Room 101 geyser", category: "appliance", location: "Room 101", priority: "high", estimatedCost: 1500, ...extra });

describe("maintenance", () => {
  test("a manager raises a ticket for their property, with a ticket number; assignee makes it 'assigned'", async () => {
    const mgr = await as(w.users.managerA);
    const open = await mgr.post("/maintenance", ticket());
    assert.equal(open.status, 201);
    assert.match(open.body.data.ticketNo, /^MNT-\d{4}$/);
    assert.equal(open.body.data.status, "open");
    assert.equal(open.body.data.propertyId, w.A.id);
    assert.equal(open.body.data.propertyName, "Hostel A");
    const assigned = await mgr.post("/maintenance", ticket({ assigneeStaffId: staffA.id }));
    assert.equal(assigned.body.data.status, "assigned");
    assert.equal(assigned.body.data.assigneeName, "Ravi Electrician");
    assert.notEqual(open.body.data.ticketNo, assigned.body.data.ticketNo);
    assert.equal((await prisma.activityLog.count({ where: { category: "maintenance" } })), 2);
  });

  test("the assignee must be active staff of the same property", async () => {
    const mgr = await as(w.users.managerA);
    const res = await mgr.post("/maintenance", ticket({ assigneeStaffId: staffB.id }));
    assert.equal(res.status, 422);
    assert.ok(res.body.error.fieldErrors.assigneeStaffId);
    await prisma.staffMember.update({ where: { id: staffA.id }, data: { status: "inactive" } });
    assert.equal((await mgr.post("/maintenance", ticket({ assigneeStaffId: staffA.id }))).status, 422);
  });

  test("students have no access; other organizations cannot see or touch tickets", async () => {
    const stu = await as(w.users.studentA);
    assert.equal((await stu.get("/maintenance")).status, 403);
    assert.equal((await stu.post("/maintenance", ticket())).status, 403);
    const t = (await (await as(w.users.managerA)).post("/maintenance", ticket())).body.data;
    const outsider = await as(x.users.ownerX);
    assert.equal((await outsider.patch(`/maintenance/${t.id}`, { priority: "low" })).status, 404);
    assert.equal((await outsider.get("/maintenance")).body.data.length, 0);
    const mgrB = await as(w.users.managerB);
    assert.equal((await mgrB.patch(`/maintenance/${t.id}`, { priority: "low" })).status, 403);
    assert.equal((await mgrB.get("/maintenance")).body.data.length, 0);
  });

  test("an owner raises a ticket for a property of their organization only", async () => {
    const owner = await as(w.users.owner);
    assert.equal((await owner.post("/maintenance", ticket({ propertyId: w.B.id }))).status, 201);
    assert.equal((await owner.post("/maintenance", ticket())).status, 422);
    assert.equal((await owner.post("/maintenance", ticket({ propertyId: x.X.id }))).status, 404);
    assert.equal((await owner.get("/maintenance", { priority: "high" })).body.data.length, 1);
  });

  test("status follows the allowed moves; completing needs the actual cost; completed is final", async () => {
    const mgr = await as(w.users.managerA);
    const t = (await mgr.post("/maintenance", ticket())).body.data;
    assert.equal((await mgr.patch(`/maintenance/${t.id}`, { status: "in_progress" })).body.data.status, "in_progress");
    assert.equal((await mgr.patch(`/maintenance/${t.id}`, { status: "assigned" })).status, 409);
    const noCost = await mgr.patch(`/maintenance/${t.id}`, { status: "completed" });
    assert.equal(noCost.status, 422);
    assert.ok(noCost.body.error.fieldErrors.actualCost);
    const done = await mgr.patch(`/maintenance/${t.id}`, { status: "completed", actualCost: 1800 });
    assert.equal(done.status, 200);
    assert.equal(done.body.data.actualCost, 1800);
    assert.equal((await mgr.patch(`/maintenance/${t.id}`, { status: "in_progress" })).status, 409);
    assert.equal((await mgr.patch(`/maintenance/${t.id}`, { assigneeStaffId: staffA.id })).status, 409);
  });

  test("assigning moves open → assigned, unassigning moves it back", async () => {
    const mgr = await as(w.users.managerA);
    const t = (await mgr.post("/maintenance", ticket())).body.data;
    assert.equal((await mgr.patch(`/maintenance/${t.id}`, { assigneeStaffId: staffA.id })).body.data.status, "assigned");
    const un = (await mgr.patch(`/maintenance/${t.id}`, { assigneeStaffId: null })).body.data;
    assert.equal(un.status, "open");
    assert.equal(un.assigneeStaffId, undefined);
  });

  test("filters by status and validates input", async () => {
    const mgr = await as(w.users.managerA);
    const t = (await mgr.post("/maintenance", ticket())).body.data;
    await mgr.post("/maintenance", ticket({ priority: "low" }));
    await mgr.patch(`/maintenance/${t.id}`, { status: "on_hold" });
    assert.equal((await mgr.get("/maintenance", { status: "on_hold" })).body.data.length, 1);
    const bad = await mgr.post("/maintenance", ticket({ title: "x", estimatedCost: -5 }));
    assert.equal(bad.status, 422);
    assert.ok(bad.body.error.fieldErrors.title && bad.body.error.fieldErrors.estimatedCost);
  });
});

const item = (extra = {}) => ({ name: "Bedsheet", sku: "lin-001", category: "linen", unit: "pcs", quantity: 20, reorderLevel: 5, unitCost: 300, ...extra });

describe("inventory", () => {
  test("creating an item records opening stock and normalises the SKU; duplicates are refused", async () => {
    const mgr = await as(w.users.managerA);
    const res = await mgr.post("/inventory", item());
    assert.equal(res.status, 201);
    assert.equal(res.body.data.sku, "LIN-001");
    assert.equal(res.body.data.lowStock, false);
    const txns = (await mgr.get("/inventory/transactions", { itemId: res.body.data.id })).body.data;
    assert.equal(txns.length, 1);
    assert.equal(txns[0].note, "Opening stock");
    assert.equal(txns[0].itemName, "Bedsheet");
    const dup = await mgr.post("/inventory", item({ sku: "LIN-001" }));
    assert.equal(dup.status, 409);
    assert.ok(dup.body.error.fieldErrors.sku);
    // The same SKU at another property is fine.
    assert.equal((await (await as(w.users.owner)).post("/inventory", item({ propertyId: w.B.id }))).status, 201);
  });

  test("stock in and out; 'out' beyond stock or without a note is refused", async () => {
    const mgr = await as(w.users.managerA);
    const it = (await mgr.post("/inventory", item())).body.data;
    assert.equal((await mgr.post("/inventory/adjust", { itemId: it.id, type: "in", quantity: 5, note: "" })).body.data.quantity, 25);
    const noNote = await mgr.post("/inventory/adjust", { itemId: it.id, type: "out", quantity: 1, note: "" });
    assert.equal(noNote.status, 422);
    assert.ok(noNote.body.error.fieldErrors.note);
    const tooMany = await mgr.post("/inventory/adjust", { itemId: it.id, type: "out", quantity: 26, note: "rooms" });
    assert.equal(tooMany.status, 422);
    assert.ok(tooMany.body.error.fieldErrors.quantity);
    for (const quantity of [0, -3, 1.5]) {
      assert.equal((await mgr.post("/inventory/adjust", { itemId: it.id, type: "in", quantity, note: "x" })).status, 422);
    }
    const out = await mgr.post("/inventory/adjust", { itemId: it.id, type: "out", quantity: 25, note: "issued" });
    assert.equal(out.body.data.quantity, 0);
    assert.equal(out.body.data.lowStock, true);
    const t = (await mgr.get("/inventory/transactions", { itemId: it.id })).body.data;
    assert.equal(t[0].type, "out");
    assert.equal(t[0].by, "Manager A");
  });

  test("two concurrent 'out' movements can never take more than is in stock", async () => {
    const mgr = await as(w.users.managerA);
    const it = (await mgr.post("/inventory", item({ quantity: 10, sku: "RACE" }))).body.data;
    for (let round = 0; round < 5; round++) {
      await prisma.inventoryItem.update({ where: { id: it.id }, data: { quantity: 10 } });
      const results = await Promise.all([
        mgr.post("/inventory/adjust", { itemId: it.id, type: "out", quantity: 7, note: "a" }),
        mgr.post("/inventory/adjust", { itemId: it.id, type: "out", quantity: 7, note: "b" }),
      ]);
      assert.deepEqual(results.map((r) => r.status).sort(), [200, 422], `round ${round}`);
      assert.equal((await prisma.inventoryItem.findUnique({ where: { id: it.id } })).quantity, 3);
    }
  });

  test("crossing the reorder level alerts managers once, and owners only when opted in", async () => {
    const mgr = await as(w.users.managerA);
    const it = (await mgr.post("/inventory", item({ quantity: 8, reorderLevel: 5, sku: "ALERT" }))).body.data;
    await mgr.post("/inventory/adjust", { itemId: it.id, type: "out", quantity: 3, note: "a" }); // 8 → 5: crosses
    await mgr.post("/inventory/adjust", { itemId: it.id, type: "out", quantity: 1, note: "b" }); // 5 → 4: already low
    assert.equal(await prisma.notification.count({ where: { recipientUserId: w.users.managerA.id, category: "inventory" } }), 1);
    assert.equal(await prisma.notification.count({ where: { recipientUserId: w.users.owner.id, category: "inventory" } }), 1, "lowStock is on by default");
    await prisma.organization.update({ where: { id: w.org.id }, data: { settings: { notifications: { lowStock: false } } } });
    await mgr.post("/inventory/adjust", { itemId: it.id, type: "in", quantity: 10, note: "" }); // back above
    await mgr.post("/inventory/adjust", { itemId: it.id, type: "out", quantity: 10, note: "c" }); // crosses again
    assert.equal(await prisma.notification.count({ where: { recipientUserId: w.users.managerA.id, category: "inventory" } }), 2);
    assert.equal(await prisma.notification.count({ where: { recipientUserId: w.users.owner.id, category: "inventory" } }), 1);
  });

  test("lists filter by category and low stock; scope is enforced", async () => {
    const mgr = await as(w.users.managerA);
    await mgr.post("/inventory", item({ sku: "A1" }));
    await mgr.post("/inventory", item({ sku: "A2", name: "Bulb", category: "electrical", quantity: 2, reorderLevel: 5 }));
    assert.equal((await mgr.get("/inventory", { lowStockOnly: "true" })).body.data.length, 1);
    assert.equal((await mgr.get("/inventory", { category: "linen" })).body.data.length, 1);
    assert.equal((await mgr.get("/inventory")).body.data.length, 2);
    const mgrB = await as(w.users.managerB);
    assert.equal((await mgrB.get("/inventory")).body.data.length, 0);
    assert.equal((await mgrB.get("/inventory", { propertyId: w.A.id })).status, 403);
    const it = (await mgr.get("/inventory")).body.data[0];
    assert.equal((await mgrB.post("/inventory/adjust", { itemId: it.id, type: "in", quantity: 1, note: "" })).status, 403);
    assert.equal((await (await as(x.users.ownerX)).post("/inventory/adjust", { itemId: it.id, type: "in", quantity: 1, note: "" })).status, 404);
    assert.equal((await (await as(x.users.ownerX)).get("/inventory/transactions", { itemId: it.id })).body.data.length, 0);
    const stu = await as(w.users.studentA);
    assert.equal((await stu.get("/inventory")).status, 403);
    assert.equal((await stu.post("/inventory/adjust", { itemId: it.id, type: "in", quantity: 1, note: "" })).status, 403);
  });
});
