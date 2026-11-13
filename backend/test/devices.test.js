import "./helpers/env.js";
import { describe, test, beforeEach, afterEach, after } from "node:test";
import assert from "node:assert/strict";
import { prisma, resetDb, seedWorld, disconnect } from "./helpers/db.js";
import { as, api, rawRequest } from "./helpers/api.js";
import { env } from "../src/config/env.js";
import { pushOutbox } from "../src/services/push.js";
import { dispatchPending } from "../src/modules/devices/push.dispatch.js";
import { notifyUsers } from "../src/utils/sideEffects.js";

const TOKEN_A = "ExponentPushToken[aaaaaaaaaaaaaaaaaaaaaa]";
const TOKEN_B = "ExponentPushToken[bbbbbbbbbbbbbbbbbbbbbb]";
const enc = encodeURIComponent;

let w;
const realFetch = globalThis.fetch;
beforeEach(async () => {
  await resetDb();
  w = await seedWorld();
  pushOutbox.length = 0;
  env.push.mode = "console";
});
afterEach(() => { globalThis.fetch = realFetch; env.push.mode = "console"; });
after(disconnect);

const register = async (user, pushToken = TOKEN_A, platform = "android") =>
  (await as(user)).post("/devices", { pushToken, platform, appVersion: "1.0.0" });
const notify = (user, link = "/student/rent") => prisma.$transaction((tx) => notifyUsers(tx, [user.id], "Rent due", "₹9,500 is due.", "payment", link));

describe("POST /devices", () => {
  test("registers the caller's phone and lists it", async () => {
    const res = await register(w.users.studentA);
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.equal(res.body.data.platform, "android");
    const list = await (await as(w.users.studentA)).get("/devices");
    assert.equal(list.body.data.length, 1);
    assert.equal(list.body.data[0].pushToken, undefined, "the token itself is never echoed back");
  });

  test("registering again is idempotent", async () => {
    await register(w.users.studentA);
    await register(w.users.studentA, TOKEN_A, "ios");
    const rows = await prisma.device.findMany();
    assert.equal(rows.length, 1);
    assert.equal(rows[0].platform, "ios");
  });

  test("a token already on another account moves to the caller", async () => {
    await register(w.users.studentA);
    await register(w.users.managerA);
    const rows = await prisma.device.findMany();
    assert.equal(rows.length, 1);
    assert.equal(rows[0].userId, w.users.managerA.id);
  });

  test("rejects a token that is not an Expo push token, and an unknown platform", async () => {
    const bad = await register(w.users.studentA, "not-a-token");
    assert.equal(bad.status, 422);
    assert.ok(bad.body.error.fieldErrors.pushToken);
    const plat = await register(w.users.studentA, TOKEN_A, "windows");
    assert.equal(plat.status, 422);
    assert.ok(plat.body.error.fieldErrors.platform);
  });

  test("needs a signed-in user", async () => {
    const res = await api().post("/devices", { pushToken: TOKEN_A, platform: "ios" });
    assert.equal(res.status, 401);
  });

  test("push disabled → NOT_CONFIGURED, nothing stored", async () => {
    env.push.mode = "disabled";
    const res = await register(w.users.studentA);
    assert.equal(res.status, 503);
    assert.equal(res.body.error.code, "NOT_CONFIGURED");
    assert.equal(await prisma.device.count(), 0);
  });
});

describe("DELETE /devices/:pushToken", () => {
  test("removes the caller's own phone", async () => {
    await register(w.users.studentA);
    const res = await (await as(w.users.studentA)).del(`/devices/${enc(TOKEN_A)}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.data.removed, 1);
    assert.equal(await prisma.device.count(), 0);
  });

  test("cannot remove someone else's phone", async () => {
    await register(w.users.studentA);
    const res = await (await as(w.users.studentB)).del(`/devices/${enc(TOKEN_A)}`);
    assert.equal(res.body.data.removed, 0);
    assert.equal(await prisma.device.count(), 1);
  });

  test("signing out everywhere removes every phone of that user", async () => {
    await register(w.users.studentA, TOKEN_A);
    await register(w.users.studentA, TOKEN_B, "ios");
    await register(w.users.studentB, "ExponentPushToken[cccccccccccccccccccccc]");
    const res = await (await as(w.users.studentA)).post("/auth/logout-all");
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.deepEqual((await prisma.device.findMany()).map((d) => d.userId), [w.users.studentB.id]);
  });
});

describe("push dispatch (outbox)", () => {
  test("a committed notification is pushed once to each of the recipient's phones", async () => {
    await register(w.users.studentA, TOKEN_A);
    await register(w.users.studentA, TOKEN_B, "ios");
    await notify(w.users.studentA);

    const r1 = await dispatchPending();
    assert.equal(r1.claimed, 1);
    assert.equal(r1.sent, 2);
    assert.deepEqual(pushOutbox.map((m) => m.to).sort(), [TOKEN_A, TOKEN_B]);
    const m = pushOutbox[0];
    assert.equal(m.title, "Rent due");
    assert.equal(m.data.link, "/student/rent");
    assert.equal(m.data.category, "payment");
    assert.equal(m.badge, 1, "badge is the recipient's unread count");

    const r2 = await dispatchPending();
    assert.equal(r2.claimed, 0, "never pushed twice");
    assert.equal(pushOutbox.length, 2);
  });

  test("a notification whose transaction rolled back is never pushed", async () => {
    await register(w.users.studentA);
    await assert.rejects(prisma.$transaction(async (tx) => {
      await notifyUsers(tx, [w.users.studentA.id], "Rolled back", "x", "system");
      throw new Error("boom");
    }));
    await dispatchPending();
    assert.equal(pushOutbox.length, 0);
  });

  test("a user without a phone: the row is claimed, nothing is sent", async () => {
    await notify(w.users.studentB);
    const r = await dispatchPending();
    assert.equal(r.claimed, 1);
    assert.equal(r.sent, 0);
    assert.ok((await prisma.notification.findFirst()).pushedAt);
  });

  test("notifications older than an hour are not pushed", async () => {
    await register(w.users.studentA);
    await prisma.notification.create({
      data: { recipientUserId: w.users.studentA.id, title: "Old", body: "x", category: "system", createdAt: new Date(Date.now() - 2 * 3600e3) },
    });
    const r = await dispatchPending();
    assert.equal(r.claimed, 0);
    assert.equal(pushOutbox.length, 0);
  });

  test("a disabled user's phones get nothing", async () => {
    await register(w.users.studentA);
    await prisma.user.update({ where: { id: w.users.studentA.id }, data: { disabledAt: new Date() } });
    await notify(w.users.studentA);
    await dispatchPending();
    assert.equal(pushOutbox.length, 0);
  });

  test("push disabled: nothing is claimed", async () => {
    await register(w.users.studentA);
    await notify(w.users.studentA);
    env.push.mode = "disabled";
    const r = await dispatchPending();
    assert.equal(r.claimed, 0);
    assert.equal((await prisma.notification.findFirst()).pushedAt, null);
  });

  describe("expo mode", () => {
    test("sends to Expo and removes tokens Expo reports as DeviceNotRegistered", async () => {
      await register(w.users.studentA, TOKEN_A);
      await register(w.users.studentA, TOKEN_B, "ios");
      await notify(w.users.studentA);
      env.push.mode = "expo";
      let sentBody;
      globalThis.fetch = async (url, init) => {
        assert.equal(url, "https://exp.host/--/api/v2/push/send");
        sentBody = JSON.parse(init.body);
        return new Response(JSON.stringify({
          data: sentBody.map((m) => (m.to === TOKEN_B
            ? { status: "error", message: "gone", details: { error: "DeviceNotRegistered" } }
            : { status: "ok", id: "t1" })),
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      };
      const r = await dispatchPending();
      assert.equal(sentBody.length, 2);
      assert.equal(r.sent, 1);
      assert.equal(r.removedDevices, 1);
      assert.deepEqual((await prisma.device.findMany()).map((d) => d.pushToken), [TOKEN_A]);
    });

    test("a failed request releases the rows so the next sweep retries", async () => {
      await register(w.users.studentA);
      await notify(w.users.studentA);
      env.push.mode = "expo";
      globalThis.fetch = async () => new Response("upstream down", { status: 502 });
      await assert.rejects(dispatchPending(), /Expo push refused/);
      assert.equal((await prisma.notification.findFirst()).pushedAt, null);

      globalThis.fetch = async (_u, init) => new Response(JSON.stringify({ data: JSON.parse(init.body).map(() => ({ status: "ok" })) }), { status: 200 });
      const r = await dispatchPending();
      assert.equal(r.sent, 1);
    });
  });
});

describe("GET /app/config", () => {
  test("is public and reports versions and integrations", async () => {
    const res = await rawRequest().get("/api/v1/app/config");
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.data, { minVersion: "1.0.0", latestVersion: "1.2.0", pushEnabled: true, onlinePayments: true });
  });
});

describe("GET /notifications contract", () => {
  test("does not expose the push outbox marker", async () => {
    await notify(w.users.studentA);
    await dispatchPending();
    const res = await (await as(w.users.studentA)).get("/notifications");
    assert.equal(res.status, 200);
    assert.equal(res.body.data.length, 1);
    assert.equal("pushedAt" in res.body.data[0], false);
  });
});
