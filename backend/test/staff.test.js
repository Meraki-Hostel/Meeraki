import "./helpers/env.js";
import { describe, test, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { prisma, resetDb, seedWorld, seedOtherOrg, disconnect, makeUser } from "./helpers/db.js";
import { as, api, tokenFor, clearTokens } from "./helpers/api.js";

let w, x;
beforeEach(async () => { clearTokens(); await resetDb(); w = await seedWorld(); x = await seedOtherOrg(); });
after(async () => { await resetDb(); await disconnect(); });

const person = (over = {}) => ({ name: "Sunita Rao", role: "warden", phone: "9811122233", email: "sunita@example.test", shift: "night", ...over });

describe("staff: listing and scope", () => {
  test("owner sees all staff of the organization, never another org's; manager only their property", async () => {
    const owner = await as(w.users.owner);
    const a = await owner.post("/staff", { ...person(), propertyId: w.A.id });
    const b = await owner.post("/staff", { ...person({ name: "Bala", email: "b@example.test" }), propertyId: w.B.id });
    assert.equal(a.status, 201);
    assert.equal(a.body.data.propertyName, "Hostel A");
    const all = (await owner.get("/staff")).body.data;
    assert.deepEqual(all.map((s) => s.name).sort(), ["Bala", "Sunita Rao"]);
    assert.ok(all.every((s) => s.id !== x.staffX.id), "another organization's staff leaked");
    assert.equal((await owner.get("/staff", { propertyId: w.B.id })).body.data.length, 1);
    assert.equal((await owner.get("/staff", { propertyId: x.X.id })).status, 404);
    const mgr = (await (await as(w.users.managerA)).get("/staff")).body.data;
    assert.deepEqual(mgr.map((s) => s.id), [a.body.data.id]);
    assert.ok(b.body.data.id);
  });

  test("students cannot list staff", async () => {
    assert.equal((await (await as(w.users.studentA)).get("/staff")).status, 403);
  });
});

describe("staff: writes", () => {
  test("a manager adds staff only to their own property and cannot add or edit managers", async () => {
    const mgr = await as(w.users.managerA);
    const res = await mgr.post("/staff", { ...person(), propertyId: w.B.id });
    assert.equal(res.status, 201);
    assert.equal(res.body.data.propertyId, w.A.id, "manager's staff landed outside their property");
    assert.equal((await mgr.post("/staff", person({ role: "manager" }))).status, 403);
    const boss = await prisma.staffMember.create({ data: { orgId: w.org.id, propertyId: w.A.id, name: "Boss", role: "manager", phone: "9800000001", email: "", joinedOn: new Date() } });
    assert.equal((await mgr.patch(`/staff/${boss.id}`, { name: "Changed" })).status, 403);
    const other = await prisma.staffMember.create({ data: { orgId: w.org.id, propertyId: w.B.id, name: "Other", role: "cook", phone: "9800000002", email: "", joinedOn: new Date() } });
    assert.equal((await mgr.patch(`/staff/${other.id}/status`, { status: "on_leave" })).status, 403);
  });

  test("another organization's staff member is not found", async () => {
    const owner = await as(w.users.owner);
    assert.equal((await owner.patch(`/staff/${x.staffX.id}`, { name: "Hijack" })).status, 404);
    assert.equal((await owner.patch(`/staff/${x.staffX.id}/status`, { status: "inactive" })).status, 404);
  });

  test("validation errors name the fields", async () => {
    const res = await (await as(w.users.owner)).post("/staff", person({ phone: "123", email: "nope", name: "A" }));
    assert.equal(res.status, 422);
    assert.ok(res.body.error.fieldErrors.phone && res.body.error.fieldErrors.email && res.body.error.fieldErrors.name);
  });

  test("the plan's staff limit is enforced", async () => {
    await prisma.organization.update({ where: { id: w.org.id }, data: { planId: "starter" } });
    for (let i = 0; i < 10; i++) {
      await prisma.staffMember.create({ data: { orgId: w.org.id, propertyId: w.A.id, name: `S${i}`, role: "cook", phone: "9800000003", email: "", joinedOn: new Date() } });
    }
    const res = await (await as(w.users.owner)).post("/staff", { ...person(), propertyId: w.A.id });
    assert.equal(res.status, 409);
    assert.match(res.body.error.message, /plan/i);
  });
});

describe("staff: invitations and deactivation", () => {
  test("owner invites a warden; accepting creates a property-scoped manager login", async () => {
    const owner = await as(w.users.owner);
    const res = await owner.post("/staff", { ...person(), propertyId: w.A.id, sendInvite: true });
    assert.equal(res.status, 201);
    assert.equal(res.body.data.status, "invited");
    const token = new URL(res.body.data.invite.inviteLink).searchParams.get("token");
    const acc = await api().post("/auth/invitations/accept", { token, password: "Warden#2026x" });
    assert.equal(acc.status, 200, JSON.stringify(acc.body));
    const u = await prisma.user.findFirst({ where: { email: "sunita@example.test" } });
    assert.equal(u.role, "manager");
    assert.equal(u.propertyId, w.A.id);
    assert.equal((await prisma.staffMember.findUnique({ where: { id: res.body.data.id } })).status, "active");
  });

  test("invitations only for login roles, and only by the owner", async () => {
    const owner = await as(w.users.owner);
    const cook = await owner.post("/staff", { ...person({ role: "cook" }), propertyId: w.A.id, sendInvite: true });
    assert.equal(cook.status, 422);
    assert.ok(cook.body.error.fieldErrors.sendInvite);
    assert.equal((await (await as(w.users.managerA)).post("/staff", { ...person(), sendInvite: true })).status, 403);
  });

  test("deactivating a staff member ends their sign-in immediately; reactivating restores it", async () => {
    const st = await prisma.staffMember.create({ data: { orgId: w.org.id, propertyId: w.A.id, name: "Warden W", role: "warden", phone: "9800000004", email: "ww@example.test", joinedOn: new Date() } });
    const user = await makeUser(w.org, "manager", "Warden W", { propertyId: w.A.id, staffId: st.id });
    const token = await tokenFor(user);
    assert.equal((await api(token).get("/students")).status, 200);
    const owner = await as(w.users.owner);
    assert.equal((await owner.patch(`/staff/${st.id}/status`, { status: "inactive" })).status, 200);
    assert.equal((await api(token).get("/students")).status, 401, "a deactivated staff member's token still works");
    const relogin = await api().post("/auth/login", { role: "manager", identifier: user.email, password: "Test#Passw0rd1" });
    assert.equal(relogin.status, 403);
    assert.equal(await prisma.refreshToken.count({ where: { userId: user.id, revokedAt: null } }), 0);
    assert.equal((await owner.patch(`/staff/${st.id}/status`, { status: "active" })).status, 200);
    clearTokens();
    assert.equal((await api().post("/auth/login", { role: "manager", identifier: user.email, password: "Test#Passw0rd1" })).status, 200);
  });
});
