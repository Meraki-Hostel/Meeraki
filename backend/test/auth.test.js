import "./helpers/env.js";
import { describe, test, before, after } from "node:test";
import assert from "node:assert/strict";
import { prisma, resetDb, seedWorld, disconnect, TEST_PASSWORD } from "./helpers/db.js";
import { api, as, rawRequest, clearTokens } from "./helpers/api.js";
import { DEMO_BACKDOOR_PASSWORD } from "./helpers/env.js";
import jwt from "jsonwebtoken";

let w;
before(async () => { await resetDb(); clearTokens(); w = await seedWorld(); });
after(disconnect);

const login = (user, password = TEST_PASSWORD, role = user.role) =>
  rawRequest().post("/api/v1/auth/login").send({ role, identifier: user.email, password });

describe("auth: baseline behaviour that must keep working", () => {
  test("password login returns tokens and the user for each role", async () => {
    for (const u of [w.users.owner, w.users.managerA, w.users.studentA]) {
      const res = await login(u);
      assert.equal(res.status, 200, `${u.role}: ${JSON.stringify(res.body)}`);
      assert.ok(res.body.data.accessToken && res.body.data.refreshToken);
      assert.equal(res.body.data.user.email, u.email);
      assert.equal(res.body.data.user.passwordHash, undefined, "password hash must never be returned");
    }
  });

  test("wrong password → 401 UNAUTHENTICATED", async () => {
    const res = await login(w.users.managerA, "not-the-password");
    assert.equal(res.status, 401);
    assert.equal(res.body.error.code, "UNAUTHENTICATED");
  });

  test("signing in on the wrong role tab → 403 FORBIDDEN", async () => {
    const res = await login(w.users.studentA, TEST_PASSWORD, "owner");
    assert.equal(res.status, 403);
    assert.equal(res.body.error.code, "FORBIDDEN");
  });

  test("/auth/session needs a token and returns the signed-in user", async () => {
    assert.equal((await api().get("/auth/session")).status, 401);
    const res = await (await as(w.users.managerA)).get("/auth/session");
    assert.equal(res.status, 200);
    assert.equal(res.body.data.user.id, w.users.managerA.id);
  });

  test("refresh rotates the token and the old one stops working", async () => {
    const first = (await login(w.users.studentB)).body.data;
    const rotated = await rawRequest().post("/api/v1/auth/refresh").send({ refreshToken: first.refreshToken });
    assert.equal(rotated.status, 200);
    const reuse = await rawRequest().post("/api/v1/auth/refresh").send({ refreshToken: first.refreshToken });
    assert.equal(reuse.status, 401);
  });

  test("protected endpoints reject missing and garbage tokens", async () => {
    assert.equal((await api().get("/students")).status, 401);
    assert.equal((await api("garbage").get("/students")).status, 401);
  });
});

describe("auth: there is no demo authentication in the real API", () => {
  test("[DEF-02] POST /auth/login-as is gone and issues no tokens", async () => {
    const anon = await rawRequest().post("/api/v1/auth/login-as").send({ userId: w.users.owner.id });
    assert.equal(anon.status, 404, `login-as answered ${anon.status}`);
    assert.equal(anon.body?.data?.accessToken, undefined);
    const signedIn = await (await as(w.users.studentA)).post("/auth/login-as", { userId: w.users.owner.id });
    assert.equal(signedIn.status, 404, `login-as answered ${signedIn.status} for a signed-in student`);
    assert.equal(signedIn.body?.data?.accessToken, undefined);
  });

  test("[DEF-02] GET /auth/personas is gone and lists no accounts", async () => {
    const anon = await rawRequest().get("/api/v1/auth/personas");
    assert.equal(anon.status, 404, `personas answered ${anon.status}`);
    assert.equal(anon.body?.data, null);
    const signedIn = await (await as(w.users.studentA)).get("/auth/personas");
    assert.equal(signedIn.status, 404);
    assert.equal(signedIn.body?.data, null);
  });

  test("[DEF-02] the shared demo password does not sign in real accounts", async () => {
    const res = await login(w.users.owner, DEMO_BACKDOOR_PASSWORD);
    assert.equal(res.status, 401, `demo password logged in as ${w.users.owner.email}`);
  });
});

describe("auth: access follows the database, not the token", () => {
  test("[DEF-A4] a manager moved to another hostel loses access to the old one immediately", async () => {
    const mgr = await prisma.user.create({
      data: { orgId: w.org.id, name: "Mover", email: "mover@example.test", phone: "9800099999", role: "manager", title: "m", propertyId: w.A.id,
        passwordHash: (await prisma.user.findUnique({ where: { id: w.users.managerA.id } })).passwordHash },
    });
    const token = (await login(mgr)).body.data.accessToken;
    const before = await api(token).get("/students");
    assert.equal(before.status, 200);
    assert.ok(before.body.data.length > 0, "precondition: sees hostel A students");

    await prisma.user.update({ where: { id: mgr.id }, data: { propertyId: w.B.id } });

    const res = await api(token).get("/students");
    const stillSeesA = res.status === 200 && res.body.data.some((s) => s.propertyId === w.A.id);
    assert.equal(stillSeesA, false, "old token still reads hostel A after reassignment");
  });

  test("a manager with no property is refused, never shown every tenant's rows", async () => {
    // Prisma reads `{ propertyId: undefined }` as "no filter"; that must never be reachable.
    const mgr = await prisma.user.create({
      data: { orgId: w.org.id, name: "Floating", email: "floating@example.test", phone: "9800077777", role: "manager", title: "m", propertyId: w.A.id,
        passwordHash: (await prisma.user.findUnique({ where: { id: w.users.managerA.id } })).passwordHash },
    });
    const token = (await login(mgr)).body.data.accessToken;
    await prisma.user.update({ where: { id: mgr.id }, data: { propertyId: null } });
    for (const path of ["/students", "/complaints", "/charges", "/staff", "/rooms"]) {
      const res = await api(token).get(path);
      assert.equal(res.status, 403, `${path} answered ${res.status}`);
    }
  });

  test("a deleted user's access token stops working", async () => {
    const u = await prisma.user.create({
      data: { orgId: w.org.id, name: "Gone", email: "gone@example.test", phone: "9800088888", role: "manager", title: "m", propertyId: w.A.id,
        passwordHash: (await prisma.user.findUnique({ where: { id: w.users.managerA.id } })).passwordHash },
    });
    const token = (await login(u)).body.data.accessToken;
    await prisma.user.delete({ where: { id: u.id } });
    assert.equal((await api(token).get("/students")).status, 401);
  });
});

// Full reset / invitation / session flows are covered in accounts.test.js.
describe("auth: link flows refuse unknown tokens without changing anything", () => {
  test("reset-password with an unknown token is EXPIRED and changes nothing", async () => {
    const before = (await prisma.user.findUnique({ where: { id: w.users.studentA.id } })).passwordHash;
    const res = await rawRequest().post("/api/v1/auth/reset-password").send({ token: "any-token", password: "NewPassw0rd!" });
    assert.equal(res.status, 410);
    assert.equal(res.body.error.code, "EXPIRED");
    assert.equal((await prisma.user.findUnique({ where: { id: w.users.studentA.id } })).passwordHash, before);
  });

  test("accepting an unknown invitation creates no account", async () => {
    const res = await rawRequest().post("/api/v1/auth/invitations/accept").send({ token: "no-such-invitation", password: "NewPassw0rd!" });
    assert.equal(res.status, 404);
    assert.equal(await prisma.user.count({ where: { email: "warden@example.test" } }), 0);
  });
});

describe("auth: the token proves identity; the database decides scope", () => {
  const sign = (payload) => jwt.sign(payload, process.env.JWT_ACCESS_SECRET, { expiresIn: "5m" });

  test("a validly signed token with a forged propertyId claim is ignored", async () => {
    const token = sign({ sub: w.users.managerA.id, role: "manager", propertyId: w.B.id });
    const res = await api(token).get("/students");
    assert.equal(res.status, 200);
    assert.ok(res.body.data.length > 0);
    assert.ok(res.body.data.every((s) => s.propertyId === w.A.id), "forged propertyId claim widened access");
    assert.equal((await api(token).get(`/students/${w.residentB.id}`)).status, 403);
  });

  test("a token whose role claim no longer matches the account is rejected", async () => {
    const token = sign({ sub: w.users.studentA.id, role: "owner" });
    assert.equal((await api(token).get("/properties")).status, 401);
  });

  test("access tokens carry only identity, role and token version, not scope", async () => {
    const token = (await login(w.users.owner)).body.data.accessToken;
    assert.deepEqual(Object.keys(jwt.decode(token)).sort(), ["exp", "iat", "role", "sub", "tv"]);
  });

  test("password guessing locks one account out, not everyone sharing the connection", async () => {
    const guess = (identifier) => rawRequest().post("/api/v1/auth/login").send({ role: "manager", identifier, password: "wrong-password-1" });
    for (let i = 0; i < 10; i++) assert.equal((await guess("target@example.test")).status, 401);
    const blocked = await guess("target@example.test");
    assert.equal(blocked.status, 429);
    assert.match(blocked.body.error.message, /Too many sign-in attempts/, "429 must use the API error envelope");
    // A neighbour on the same IP signs in normally.
    assert.equal((await login(w.users.managerB)).status, 200);
  });

  test("an unknown account and a wrong password are indistinguishable", async () => {
    const wrong = await login(w.users.managerA, "wrong-password-1");
    const unknown = await rawRequest().post("/api/v1/auth/login").send({ role: "manager", identifier: "nobody@example.test", password: "wrong-password-1" });
    assert.equal(unknown.status, wrong.status);
    assert.equal(unknown.body.error.message, wrong.body.error.message);
  });
});

describe("routing", () => {
  test("unknown URLs are 404 for everyone, while real endpoints still require a login", async () => {
    assert.equal((await rawRequest().get("/api/v1/no-such-thing")).status, 404);
    for (const path of ["/rooms", "/beds/x/status", "/charges", "/payments", "/notifications", "/activity", "/students", "/properties"]) {
      assert.equal((await rawRequest().get(`/api/v1${path}`)).status, 401, path);
    }
  });
});
