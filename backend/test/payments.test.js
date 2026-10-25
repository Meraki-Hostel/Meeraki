import "./helpers/env.js";
import crypto from "node:crypto";
import { describe, test, beforeEach, afterEach, after } from "node:test";
import assert from "node:assert/strict";
import { prisma, resetDb, seedWorld, disconnect, makeCharge } from "./helpers/db.js";
import { as, rawRequest } from "./helpers/api.js";
import { WEBHOOK_SECRET } from "./helpers/env.js";
import { env } from "../src/config/env.js";
import { todayISO } from "../src/utils/money.js";

let w;
beforeEach(async () => { await resetDb(); w = await seedWorld(); env.payments.mode = "simulated"; });
after(disconnect);

const chargeOf = async (client, id) => {
  const res = await client.get("/charges");
  assert.equal(res.status, 200);
  return res.body.data.find((c) => c.id === id);
};
const rec = (client, chargeId, amount) =>
  client.post("/payments/record", { chargeId, amount, method: "cash", paidOn: todayISO(), reference: "" });

describe("recording payments (staff)", () => {
  test("a partial payment lowers the balance and gets a receipt number", async () => {
    const mgr = await as(w.users.managerA);
    const res = await rec(mgr, w.chargeA.id, 4000);
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.match(res.body.data.receiptNo, /^RCPT-\d{4}-\d{4}$/);
    assert.equal(res.body.data.status, "captured");
    const c = await chargeOf(mgr, w.chargeA.id);
    assert.equal(c.paid, 4000);
    assert.equal(c.balance, 5500);
  });

  test("receipt numbers are unique and increasing", async () => {
    const mgr = await as(w.users.managerA);
    const a = (await rec(mgr, w.chargeA.id, 1000)).body.data.receiptNo;
    const b = (await rec(mgr, w.chargeA.id, 1000)).body.data.receiptNo;
    assert.notEqual(a, b);
    assert.ok(b > a);
  });

  test("paying more than the balance is rejected", async () => {
    assert.equal((await rec(await as(w.users.managerA), w.chargeA.id, 9501)).status, 422);
  });

  test("a zero or negative amount is rejected", async () => {
    const mgr = await as(w.users.managerA);
    assert.equal((await rec(mgr, w.chargeA.id, 0)).status, 422);
    assert.equal((await rec(mgr, w.chargeA.id, -5)).status, 422);
  });

  test("a payment dated in the future is rejected", async () => {
    const mgr = await as(w.users.managerA);
    const res = await mgr.post("/payments/record", { chargeId: w.chargeA.id, amount: 100, method: "cash", paidOn: "2999-01-01", reference: "" });
    assert.equal(res.status, 422);
  });

  test("a student sees only their own charges and payments, and cannot open someone else's receipt", async () => {
    const paidB = (await rec(await as(w.users.managerB), w.chargeB.id, 100)).body.data;
    const stu = await as(w.users.studentA);
    const charges = (await stu.get("/charges")).body.data;
    assert.ok(charges.length && charges.every((c) => c.studentId === w.residentA.id));
    assert.equal((await stu.get(`/payments/${paidB.id}/receipt`)).status, 403);
    const own = (await stu.get("/payments", { studentId: w.residentB.id })).body.data;
    assert.ok(own.every((p) => p.studentId === w.residentA.id), "a studentId filter widened a student's view");
  });
});

describe("concurrency", () => {
  test("[DEF-A9] two simultaneous payments cannot together exceed the amount due", async () => {
    const mgr = await as(w.users.managerA);
    for (let round = 0; round < 5; round++) {
      await prisma.payment.deleteMany({});
      const results = await Promise.all([rec(mgr, w.chargeA.id, 6000), rec(mgr, w.chargeA.id, 6000)]);
      const total = (await prisma.payment.aggregate({ where: { chargeId: w.chargeA.id }, _sum: { amount: true } }))._sum.amount ?? 0;
      assert.ok(total <= 9500, `round ${round}: ${total} collected against a 9500 charge (${results.map((r) => r.status)})`);
      assert.deepEqual(results.map((r) => r.status).sort(), [201, 422]);
    }
  });

  test("simultaneous payments on different charges get distinct receipts, even on first use of the counter", async () => {
    const extra = await Promise.all([1, 2, 3, 4].map((i) => makeCharge(w.residentA, `2025-0${i}`)));
    const mgr = await as(w.users.managerA);
    const results = await Promise.all([w.chargeA, ...extra].map((c) => rec(mgr, c.id, 100)));
    assert.ok(results.every((r) => r.status === 201), JSON.stringify(results.map((r) => [r.status, r.body.error?.message])));
    assert.equal(new Set(results.map((r) => r.body.data.receiptNo)).size, 5);
  });
});

describe("online payment: disabled (the default when PAYMENT_MODE is unset)", () => {
  test("pay-now says online payment is not set up, and creates nothing", async () => {
    env.payments.mode = "disabled";
    const res = await (await as(w.users.studentA)).post("/payments/pay-now", { chargeId: w.chargeA.id, method: "upi" });
    assert.equal(res.status, 503);
    assert.equal(res.body.error.code, "NOT_CONFIGURED");
    assert.equal(await prisma.payment.count(), 0);
  });
});

describe("online payment: simulated (local development only)", () => {
  test("records a payment labelled simulated; it settles the due in the demo and is never 'captured'", async () => {
    const stu = await as(w.users.studentA);
    const res = await stu.post("/payments/pay-now", { chargeId: w.chargeA.id, method: "upi" });
    assert.equal(res.status, 201);
    assert.equal(res.body.data.status, "simulated");
    assert.match(res.body.data.note, /no money moved/);
    assert.equal((await chargeOf(stu, w.chargeA.id)).balance, 0);
    assert.equal((await stu.post("/payments/pay-now", { chargeId: w.chargeA.id, method: "upi" })).status, 409);
  });
});

// ── Razorpay mode, with the gateway stubbed (no network, no real keys) ───────
function stubGateway() {
  const realFetch = globalThis.fetch;
  const orders = [];
  globalThis.fetch = async (url, init) => {
    if (String(url).startsWith("https://api.razorpay.com/")) {
      const body = JSON.parse(init.body);
      const order = { id: `order_test_${orders.length + 1}`, amount: body.amount, currency: "INR", receipt: body.receipt };
      orders.push(order);
      return new Response(JSON.stringify(order), { status: 200, headers: { "content-type": "application/json" } });
    }
    return realFetch(url, init);
  };
  return { orders, restore: () => { globalThis.fetch = realFetch; } };
}

const sign = (raw) => crypto.createHmac("sha256", WEBHOOK_SECRET).update(raw).digest("hex");
const webhookRaw = (raw, signature = sign(raw)) => rawRequest().post("/api/v1/payments/webhook")
  .set("Content-Type", "application/json").set("x-razorpay-signature", signature).send(raw);
const webhook = (orderId, { amountPaise = 950000, currency = "INR", signature, paymentId = "pay_test_1", event = "payment.captured" } = {}) => {
  const raw = JSON.stringify({
    event,
    payload: { payment: { entity: { id: paymentId, order_id: orderId, amount: amountPaise, currency, status: event === "payment.failed" ? "failed" : "captured" } } },
  });
  return webhookRaw(raw, signature ?? sign(raw));
};

describe("online payment: Razorpay (gateway stubbed)", () => {
  let gw;
  beforeEach(() => { env.payments.mode = "razorpay"; gw = stubGateway(); });
  afterEach(() => { gw.restore(); env.payments.mode = "simulated"; });

  const startPayment = async () => {
    const stu = await as(w.users.studentA);
    const res = await stu.post("/payments/pay-now", { chargeId: w.chargeA.id, method: "upi" });
    return { stu, res };
  };

  test("pay-now creates a gateway order for the server-computed amount and answers pending", async () => {
    const { res } = await startPayment();
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.equal(res.body.data.pending, true);
    assert.equal(res.body.data.order.id, gw.orders[0].id);
    assert.equal(gw.orders.length, 1);
    assert.equal(gw.orders[0].amount, 950000, "amount is computed server-side, in paise");
  });

  test("[DEF-A2] an unconfirmed order does not change the balance, status, payment list, receipts or summary", async () => {
    const { stu } = await startPayment();
    const c = await chargeOf(stu, w.chargeA.id);
    assert.equal(c.balance, 9500, "balance dropped before the gateway confirmed anything");
    assert.notEqual(c.status, "paid");
    assert.equal((await stu.get("/payments")).body.data.length, 0, "a pending order is listed as a payment");
    const sum = (await (await as(w.users.managerA)).get("/payments/summary", { period: "all" })).body.data;
    assert.equal(sum.collected, 0, "a pending order counts as collected");
    const pending = await prisma.payment.findFirst({ where: { chargeId: w.chargeA.id } });
    assert.equal(pending.status, "pending");
    assert.equal((await stu.get(`/payments/${pending.id}/receipt`)).status, 404, "a receipt exists for money not received");
  });

  test("[DEF-A2] starting pay-now again while an order is open reuses it", async () => {
    const { stu, res } = await startPayment();
    const again = await stu.post("/payments/pay-now", { chargeId: w.chargeA.id, method: "upi" });
    assert.ok(again.status < 300, `second pay-now answered ${again.status}: ${again.body.error?.message}`);
    assert.equal(again.body.data.order.id, res.body.data.order.id);
    assert.equal(gw.orders.length, 1, "a second gateway order was created for the same charge");
  });

  test("simultaneous pay-now clicks leave exactly one open order", async () => {
    const stu = await as(w.users.studentA);
    const results = await Promise.all([1, 2, 3].map(() => stu.post("/payments/pay-now", { chargeId: w.chargeA.id, method: "upi" })));
    assert.ok(results.every((r) => r.status === 201), JSON.stringify(results.map((r) => [r.status, r.body.error?.message])));
    assert.equal(await prisma.payment.count({ where: { chargeId: w.chargeA.id, status: "pending" } }), 1);
    assert.equal(new Set(results.map((r) => r.body.data.order.id)).size, 1, "clients were handed different orders");
  });

  test("when the balance changed, the stale order is closed and a new one opened", async () => {
    await startPayment();
    await rec(await as(w.users.managerA), w.chargeA.id, 1500);
    const { res } = await startPayment();
    assert.equal(res.body.data.order.amount, 800000);
    assert.equal(gw.orders.length, 2);
    const rows = await prisma.payment.findMany({ where: { gatewayOrderId: { not: null } }, orderBy: { createdAt: "asc" } });
    assert.deepEqual(rows.map((r) => r.status), ["failed", "pending"]);
  });

  test("[DEF-A3] the webhook is reachable and a correctly signed capture settles the due", async () => {
    const { stu } = await startPayment();
    const res = await webhook(gw.orders[0].id);
    assert.equal(res.status, 200, `webhook answered ${res.status}`);
    const c = await chargeOf(stu, w.chargeA.id);
    assert.equal(c.balance, 0);
    assert.equal(c.status, "paid");
    const p = await prisma.payment.findFirst({ where: { chargeId: w.chargeA.id } });
    assert.equal(p.status, "captured");
    assert.match(p.receiptNo, /^RCPT-/);
    assert.equal(p.gatewayPaymentId, "pay_test_1");
    assert.equal((await stu.get(`/payments/${p.id}/receipt`)).status, 200);
  });

  test("an order.paid event confirms too", async () => {
    await startPayment();
    assert.equal((await webhook(gw.orders[0].id, { event: "order.paid" })).status, 200);
    assert.equal((await prisma.payment.findFirst({ where: { chargeId: w.chargeA.id } })).status, "captured");
  });

  test("[DEF-A3] a replayed webhook does not record a second payment or burn a receipt number", async () => {
    await startPayment();
    assert.equal((await webhook(gw.orders[0].id)).status, 200);
    const counter = (await prisma.counter.findUnique({ where: { key: "receipt" } })).value;
    await webhook(gw.orders[0].id);
    await Promise.all([webhook(gw.orders[0].id), webhook(gw.orders[0].id)]);
    assert.equal(await prisma.payment.count({ where: { chargeId: w.chargeA.id, status: "captured" } }), 1);
    assert.equal((await prisma.counter.findUnique({ where: { key: "receipt" } })).value, counter);
  });

  test("simultaneous first deliveries confirm exactly once", async () => {
    await startPayment();
    const results = await Promise.all([1, 2, 3].map(() => webhook(gw.orders[0].id)));
    assert.ok(results.every((r) => r.status === 200));
    assert.equal(await prisma.payment.count({ where: { chargeId: w.chargeA.id, status: "captured" } }), 1);
    assert.equal((await prisma.counter.findUnique({ where: { key: "receipt" } })).value, 1);
  });

  test("[DEF-A3] a bad signature is rejected by signature (400), not by login (401), and changes nothing", async () => {
    await startPayment();
    const res = await webhook(gw.orders[0].id, { signature: "0".repeat(64) });
    assert.equal(res.status, 400);
    assert.equal((await prisma.payment.findFirst({ where: { chargeId: w.chargeA.id } })).status, "pending");
  });

  test("a correctly signed but unparsable payload is rejected", async () => {
    assert.equal((await webhookRaw("not json")).status, 400);
  });

  test("[DEF-A3] a signed capture for a different amount or currency is not credited, and staff are told", async () => {
    await startPayment();
    for (const bad of [{ amountPaise: 100 }, { currency: "USD" }]) {
      const res = await webhook(gw.orders[0].id, bad);
      assert.equal(res.status, 200, "acknowledged so the gateway stops retrying");
      const row = await prisma.payment.findFirst({ where: { chargeId: w.chargeA.id } });
      assert.equal(row.status, "pending", `credited despite ${JSON.stringify(bad)}`);
      assert.match(row.note, /Needs review/);
    }
    const mgrInbox = await prisma.notification.count({ where: { recipientUserId: w.users.managerA.id, title: "Online payment needs review" } });
    assert.ok(mgrInbox >= 1);
  });

  test("a failed attempt closes the order so the student can try again", async () => {
    await startPayment();
    assert.equal((await webhook(gw.orders[0].id, { event: "payment.failed" })).status, 200);
    assert.equal((await prisma.payment.findFirst({ where: { gatewayOrderId: gw.orders[0].id } })).status, "failed");
    const { res } = await startPayment();
    assert.equal(res.status, 201);
    assert.equal(gw.orders.length, 2);
  });

  test("an unknown order is acknowledged and ignored", async () => {
    const res = await webhook("order_unknown");
    assert.equal(res.status, 200);
    assert.equal(await prisma.payment.count(), 0);
  });

  test("money captured after staff already settled the due is credited and flagged as an overpayment", async () => {
    await startPayment();
    await rec(await as(w.users.managerA), w.chargeA.id, 9500);
    assert.equal((await webhook(gw.orders[0].id)).status, 200);
    const online = await prisma.payment.findFirst({ where: { gatewayOrderId: gw.orders[0].id } });
    assert.equal(online.status, "captured");
    assert.match(online.note, /OVERPAID/);
  });
});

describe("webhook outside Razorpay mode", () => {
  test("is not served at all", async () => {
    env.payments.mode = "simulated";
    assert.equal((await webhook("order_x")).status, 404);
  });
});
