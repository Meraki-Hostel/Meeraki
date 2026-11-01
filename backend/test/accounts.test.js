import "./helpers/env.js";
import { describe, test, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { prisma, resetDb, seedWorld, disconnect, TEST_PASSWORD } from "./helpers/db.js";
import { api, as, rawRequest } from "./helpers/api.js";
import { outbox } from "../src/services/mail.js";
import { authLimiter } from "../src/middleware/rateLimit.js";

let w;
beforeEach(async () => {
  await resetDb();
  w = await seedWorld();
  outbox.length = 0;
  // The auth limiter (30 per 15 min per IP) is shared by every request in this file.
  for (const ip of ["::ffff:127.0.0.1", "127.0.0.1", "::1"]) await authLimiter.resetKey(ip);
});
after(async () => { await resetDb(); await disconnect(); });

const A = "/api/v1/auth";
const login = (email, password = TEST_PASSWORD, role) => rawRequest().post(`${A}/login`).send({ role, identifier: email, password });
const refresh = (refreshToken) => rawRequest().post(`${A}/refresh`).send({ refreshToken });
const session = (token) => api(token).get("/auth/session");
const linkToken = (text) => decodeURIComponent(/token=([^\s]+)/.exec(text)[1]);
const NEW_PASSWORD = "Fresh#Start2026";

describe("password reset by email", () => {
  test("link works once, ends every session, and only the new password signs in", async () => {
    const u = w.users.studentA;
    const before = (await login(u.email, TEST_PASSWORD, "student")).body.data;

    const req = await rawRequest().post(`${A}/forgot-password`).send({ identifier: u.email });
    assert.equal(req.status, 200);
    assert.match(req.body.data.maskedDestination, /^s•+@example\.test$/);
    assert.equal(outbox.length, 1);
    assert.equal(outbox[0].to, u.email);
    const token = linkToken(outbox[0].text);
    assert.match(outbox[0].text, /\/reset-password\?token=/);

    const weak = await rawRequest().post(`${A}/reset-password`).send({ token, password: "password" });
    assert.equal(weak.status, 422);
    assert.ok(weak.body.error.fieldErrors.password);

    assert.equal((await rawRequest().post(`${A}/reset-password`).send({ token, password: NEW_PASSWORD })).status, 200);
    assert.equal((await rawRequest().post(`${A}/reset-password`).send({ token, password: "Another#Pass99" })).status, 410, "a reset link worked twice");

    assert.equal((await session(before.accessToken)).status, 401, "an access token from before the reset still works");
    assert.equal((await refresh(before.refreshToken)).status, 401, "a refresh token from before the reset still works");
    assert.equal((await login(u.email, TEST_PASSWORD, "student")).status, 401);
    assert.equal((await login(u.email, NEW_PASSWORD, "student")).status, 200);
  });

  test("an unknown address gets the same answer and no email is sent", async () => {
    const res = await rawRequest().post(`${A}/forgot-password`).send({ identifier: "nobody@example.test" });
    assert.equal(res.status, 200);
    assert.ok(res.body.data.maskedDestination);
    assert.equal(outbox.length, 0);
  });

  test("only the newest link works, and an expired link is refused", async () => {
    const u = w.users.managerA;
    await rawRequest().post(`${A}/forgot-password`).send({ identifier: u.email });
    await rawRequest().post(`${A}/forgot-password`).send({ identifier: u.email });
    const [first, second] = outbox.map((m) => linkToken(m.text));
    assert.equal((await rawRequest().post(`${A}/reset-password`).send({ token: first, password: NEW_PASSWORD })).status, 410);
    await prisma.passwordResetToken.updateMany({ where: { userId: u.id, usedAt: null }, data: { expiresAt: new Date(Date.now() - 1000) } });
    assert.equal((await rawRequest().post(`${A}/reset-password`).send({ token: second, password: NEW_PASSWORD })).status, 410);
  });
});

describe("sessions", () => {
  test("a rotated-away refresh token reused after the grace period revokes the whole family", async () => {
    const r1 = (await login(w.users.managerA.email, TEST_PASSWORD, "manager")).body.data.refreshToken;
    const r2 = (await refresh(r1)).body.data.refreshToken;
    assert.ok(r2);
    // A parallel refresh moments later is refused, but does not end the session.
    assert.equal((await refresh(r1)).status, 401);
    const r3 = (await refresh(r2)).body.data.refreshToken;
    assert.ok(r3, "a parallel refresh inside the grace window killed the session");

    await prisma.refreshToken.updateMany({ where: { revokedAt: { not: null } }, data: { revokedAt: new Date(Date.now() - 60_000) } });
    assert.equal((await refresh(r1)).status, 401);
    assert.equal((await refresh(r3)).status, 401, "the stolen-token family was not revoked");
  });

  test("change password: wrong current refused; success returns a new session and ends the old ones", async () => {
    const old = (await login(w.users.owner.email, TEST_PASSWORD, "owner")).body.data;
    const wrong = await api(old.accessToken).post("/auth/change-password", { currentPassword: "nope", newPassword: NEW_PASSWORD });
    assert.equal(wrong.status, 422);
    assert.ok(wrong.body.error.fieldErrors.currentPassword);
    const same = await api(old.accessToken).post("/auth/change-password", { currentPassword: TEST_PASSWORD, newPassword: TEST_PASSWORD });
    assert.equal(same.status, 422);

    const ok = await api(old.accessToken).post("/auth/change-password", { currentPassword: TEST_PASSWORD, newPassword: NEW_PASSWORD });
    assert.equal(ok.status, 200);
    assert.equal((await session(old.accessToken)).status, 401);
    assert.equal((await refresh(old.refreshToken)).status, 401);
    assert.equal((await session(ok.body.data.accessToken)).status, 200);
    assert.equal((await login(w.users.owner.email, NEW_PASSWORD, "owner")).status, 200);
  });

  test("sign out everywhere ends access and refresh tokens on every device", async () => {
    const d1 = (await login(w.users.managerA.email, TEST_PASSWORD, "manager")).body.data;
    const d2 = (await login(w.users.managerA.email, TEST_PASSWORD, "manager")).body.data;
    assert.equal((await api(d1.accessToken).post("/auth/logout-all")).status, 200);
    for (const d of [d1, d2]) {
      assert.equal((await session(d.accessToken)).status, 401);
      assert.equal((await refresh(d.refreshToken)).status, 401);
    }
    assert.equal((await login(w.users.managerA.email, TEST_PASSWORD, "manager")).status, 200);
  });

  test("a deactivated account cannot sign in, refresh or use an existing token", async () => {
    const d = (await login(w.users.studentA.email, TEST_PASSWORD, "student")).body.data;
    await prisma.user.update({ where: { id: w.users.studentA.id }, data: { disabledAt: new Date() } });
    assert.equal((await login(w.users.studentA.email, TEST_PASSWORD, "student")).status, 403);
    assert.equal((await refresh(d.refreshToken)).status, 401);
    assert.equal((await session(d.accessToken)).status, 401);
  });
});

describe("invitations", () => {
  test("a manager invites a resident, who activates an account and signs in", async () => {
    const mgr = await as(w.users.managerA);
    const res = await mgr.post("/invitations", { studentId: w.waitlistA.id });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.equal(res.body.data.emailSent, true);
    assert.equal(res.body.data.invitation.role, "student");
    assert.equal(outbox.at(-1).to, w.waitlistA.email);
    const token = linkToken(res.body.data.inviteLink);
    assert.equal(linkToken(outbox.at(-1).text), token);
    assert.equal(JSON.stringify(await prisma.invitation.findMany()).includes(token), false, "the raw invitation token was stored");

    const info = await rawRequest().get(`${A}/invitations/${encodeURIComponent(token)}`);
    assert.equal(info.status, 200);
    assert.equal(info.body.data.name, "Waitlist A");
    assert.equal(info.body.data.invitedBy, "Manager A");

    assert.equal((await rawRequest().post(`${A}/invitations/accept`).send({ token, password: "short" })).status, 422);
    assert.equal((await rawRequest().post(`${A}/invitations/accept`).send({ token, password: NEW_PASSWORD })).status, 200);
    assert.equal((await rawRequest().post(`${A}/invitations/accept`).send({ token, password: NEW_PASSWORD })).status, 409, "an invitation was accepted twice");

    const signedIn = await login(w.waitlistA.email, NEW_PASSWORD, "student");
    assert.equal(signedIn.status, 200);
    assert.equal(signedIn.body.data.user.studentId, w.waitlistA.id);
    const me = await api(signedIn.body.data.accessToken).get("/students/me");
    assert.equal(me.body.data.student.id, w.waitlistA.id);
  });

  test("an owner invites a warden, who gets a manager login scoped to that hostel", async () => {
    const staff = await prisma.staffMember.create({
      data: { orgId: w.org.id, name: "Wanda Warden", role: "warden", propertyId: w.B.id, phone: "9800012345", email: "wanda@example.test", joinedOn: new Date("2025-01-01") },
    });
    const res = await (await as(w.users.owner)).post("/invitations", { staffId: staff.id });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.equal((await prisma.staffMember.findUnique({ where: { id: staff.id } })).status, "invited");
    const token = linkToken(res.body.data.inviteLink);
    assert.equal((await rawRequest().post(`${A}/invitations/accept`).send({ token, password: NEW_PASSWORD })).status, 200);
    assert.equal((await prisma.staffMember.findUnique({ where: { id: staff.id } })).status, "active");

    const d = (await login("wanda@example.test", NEW_PASSWORD, "manager")).body.data;
    assert.equal(d.user.role, "manager");
    assert.equal(d.user.propertyId, w.B.id);
    const students = (await api(d.accessToken).get("/students")).body.data;
    assert.ok(students.length && students.every((s) => s.propertyId === w.B.id));
  });

  test("who may invite whom", async () => {
    const cook = await prisma.staffMember.create({
      data: { orgId: w.org.id, name: "Cook", role: "cook", propertyId: w.A.id, phone: "9800012346", email: "cook@example.test", joinedOn: new Date("2025-01-01") },
    });
    const warden = await prisma.staffMember.create({
      data: { orgId: w.org.id, name: "Warden", role: "warden", propertyId: w.A.id, phone: "9800012347", email: "warden2@example.test", joinedOn: new Date("2025-01-01") },
    });
    const mgr = await as(w.users.managerA);
    assert.equal((await mgr.post("/invitations", { staffId: warden.id })).status, 403, "a manager invited staff");
    assert.equal((await mgr.post("/invitations", { role: "owner", name: "Co Owner", email: "co@example.test" })).status, 403);
    assert.equal((await mgr.post("/invitations", { studentId: w.residentB.id })).status, 403, "manager A invited hostel B's resident");
    assert.equal((await mgr.post("/invitations", { studentId: w.residentA.id })).status, 409, "a resident with an account was invited");
    assert.equal((await (await as(w.users.owner)).post("/invitations", { staffId: cook.id })).status, 422, "a cook got an app account");
    assert.equal((await (await as(w.users.studentA)).post("/invitations", { studentId: w.waitlistA.id })).status, 403);
  });

  test("expired and revoked invitations cannot be used; resending replaces the old link", async () => {
    const mgr = await as(w.users.managerA);
    const first = (await mgr.post("/invitations", { studentId: w.waitlistA.id })).body.data;
    const t1 = linkToken(first.inviteLink);
    const resent = (await mgr.post(`/invitations/${first.invitation.id}/resend`)).body.data;
    const t2 = linkToken(resent.inviteLink);
    assert.notEqual(t1, t2);
    assert.equal((await rawRequest().get(`${A}/invitations/${encodeURIComponent(t1)}`)).status, 410, "the replaced link still works");

    await prisma.invitation.updateMany({ where: { status: "pending" }, data: { expiresAt: new Date(Date.now() - 1000) } });
    assert.equal((await rawRequest().get(`${A}/invitations/${encodeURIComponent(t2)}`)).status, 410);
    assert.equal((await rawRequest().post(`${A}/invitations/accept`).send({ token: t2, password: NEW_PASSWORD })).status, 410);
    assert.equal(await prisma.user.count({ where: { email: w.waitlistA.email } }), 0);

    const third = (await mgr.post("/invitations", { studentId: w.waitlistA.id })).body.data;
    assert.equal((await mgr.post(`/invitations/${third.invitation.id}/revoke`)).status, 200);
    assert.equal((await rawRequest().post(`${A}/invitations/accept`).send({ token: linkToken(third.inviteLink), password: NEW_PASSWORD })).status, 410);
  });

  test("admitting a resident with an email sends their invitation", async () => {
    const res = await (await as(w.users.managerA)).post("/students", {
      name: "New Comer", email: "newcomer@example.test", phone: "9876512345", gender: "female", dob: "2005-02-02",
      college: "C", course: "B.A.", year: 1, joinedOn: "2026-01-10", monthlyRent: 9000,
    });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.equal(res.body.data.invite.emailSent, true);
    assert.equal(outbox.at(-1).to, "newcomer@example.test");
    const token = linkToken(res.body.data.invite.inviteLink);
    assert.equal((await rawRequest().post(`${A}/invitations/accept`).send({ token, password: NEW_PASSWORD })).status, 200);
    assert.equal((await login("newcomer@example.test", NEW_PASSWORD, "student")).status, 200);
  });
});
