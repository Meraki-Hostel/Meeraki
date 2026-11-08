import "./helpers/env.js";
import crypto from "node:crypto";
import { describe, test, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { prisma, resetDb, seedWorld, makeStudent, disconnect } from "./helpers/db.js";
import { as, rawRequest } from "./helpers/api.js";
import { generateRent, applyLateFees } from "../src/modules/payments/charge.service.js";
import { confirmWebhookPayment, settleWebhookRefund } from "../src/modules/payments/payment.service.js";
import { verifyCheckoutSignature } from "../src/modules/payments/payment.gateway.js";

let w;
beforeEach(async () => { await resetDb(); w = await seedWorld(); });
after(async () => { await resetDb(); await disconnect(); });

const rentOf = (studentId, period) => prisma.rentCharge.findFirst({ where: { studentId, period, kind: "rent" } });
const setSettings = (settings) => prisma.organization.update({ where: { id: w.org.id }, data: { settings } });
async function balance(client, chargeId, studentId) {
  const rows = (await client.get("/charges", { studentId })).body.data;
  return rows.find((c) => c.id === chargeId);
}
const pay = (client, chargeId, amount) => client.post("/payments/record", { chargeId, amount, method: "cash", paidOn: "2026-01-05", reference: "" });

describe("monthly rent", () => {
  test("generating a month bills each billable resident once; re-running creates nothing", async () => {
    const owner = await as(w.users.owner);
    const first = await owner.post("/charges/generate", { period: "2026-03" });
    assert.equal(first.status, 200, JSON.stringify(first.body));
    assert.equal(first.body.data.created, 2, "active residents A and B (the waitlisted one is not billed)");
    assert.equal((await owner.post("/charges/generate", { period: "2026-03" })).body.data.created, 0);
    const c = await rentOf(w.residentA.id, "2026-03");
    assert.equal(c.amount, 9500);
    assert.equal(c.dueDate.toISOString().slice(0, 10), "2026-03-05", "default due day is the 5th");
    assert.equal(await rentOf(w.waitlistA.id, "2026-03"), null);
  });

  test("a manager raises rent for their own hostel only", async () => {
    const res = await (await as(w.users.managerA)).post("/charges/generate", { period: "2026-04", propertyId: w.B.id });
    assert.equal(res.body.data.created, 1);
    assert.equal(await rentOf(w.residentB.id, "2026-04"), null, "manager A billed hostel B");
    assert.equal((await (await as(w.users.studentA)).post("/charges/generate", { period: "2026-04" })).status, 403);
  });

  test("the first month is pro-rated from the joining day and due no earlier than joining", async () => {
    const mid = await makeStudent(w.A, "Mid Month", { status: "active" });
    await prisma.studentProfile.update({ where: { id: mid.id }, data: { joinedOn: new Date("2026-03-20"), monthlyRent: 3100 } });
    const late = await makeStudent(w.A, "Next Month", { status: "active" });
    await prisma.studentProfile.update({ where: { id: late.id }, data: { joinedOn: new Date("2026-04-02") } });
    await generateRent({ period: "2026-03", orgId: w.org.id });
    const c = await rentOf(mid.id, "2026-03");
    assert.equal(c.amount, Math.round((3100 * 12) / 31));
    assert.equal(c.dueDate.toISOString().slice(0, 10), "2026-03-20");
    assert.match(c.description, /pro-rated: 12 of 31 days/);
    assert.equal(await rentOf(late.id, "2026-03"), null, "a resident joining next month was billed");
    await generateRent({ period: "2026-04", orgId: w.org.id });
    assert.equal((await rentOf(mid.id, "2026-04")).amount, 3100, "only the first month is pro-rated");
  });

  test("the owner's due day and pro-rating switch are applied", async () => {
    const mid = await makeStudent(w.A, "Mid Month", { status: "active" });
    await prisma.studentProfile.update({ where: { id: mid.id }, data: { joinedOn: new Date("2026-05-02"), monthlyRent: 3100 } });
    const res = await (await as(w.users.owner)).patch("/settings", { rentDueDay: 10, prorateFirstMonth: false });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    await generateRent({ period: "2026-05", orgId: w.org.id });
    assert.equal((await rentOf(w.residentA.id, "2026-05")).dueDate.toISOString().slice(0, 10), "2026-05-10");
    assert.equal((await rentOf(mid.id, "2026-05")).amount, 3100);
  });
});

describe("late fees", () => {
  test("off while the fee is ₹0", async () => {
    assert.equal(await applyLateFees({ orgId: w.org.id, today: "2026-02-20" }), 0);
  });

  test("a flat fee after the grace period, once per month, never on paid rent", async () => {
    await setSettings({ lateFeeFlat: 200, lateFeeGraceDays: 3 });
    await pay(await as(w.users.managerB), w.chargeB.id, 9500);
    // Due on Jan 5 with 3 days' grace: still inside it on Jan 8.
    assert.equal(await applyLateFees({ orgId: w.org.id, today: "2026-01-08" }), 0);
    assert.equal(await applyLateFees({ orgId: w.org.id, today: "2026-01-09" }), 1, "only resident A's unpaid rent");
    assert.equal(await applyLateFees({ orgId: w.org.id, today: "2026-01-20" }), 0, "a second late fee for the same month");
    const fee = await prisma.rentCharge.findFirst({ where: { kind: "late_fee" } });
    assert.equal(fee.studentId, w.residentA.id);
    assert.equal(fee.amount, 200);
    assert.equal(fee.period, "2026-01");
  });
});

describe("deposits, one-off charges and adjustments", () => {
  test("one deposit per resident; scope and validation enforced", async () => {
    const mgr = await as(w.users.managerA);
    const res = await mgr.post("/charges", { studentId: w.residentA.id, kind: "deposit", amount: 20000 });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.equal(res.body.data.kind, "deposit");
    assert.equal((await mgr.post("/charges", { studentId: w.residentA.id, kind: "deposit", amount: 5000 })).status, 409);
    assert.equal((await mgr.post("/charges", { studentId: w.residentA.id, kind: "other", amount: 500 })).status, 422, "a one-off charge needs a description");
    assert.equal((await mgr.post("/charges", { studentId: w.residentA.id, kind: "other", amount: 500, description: "Lost key" })).status, 201);
    assert.equal((await (await as(w.users.managerB)).post("/charges", { studentId: w.residentA.id, kind: "other", amount: 1, description: "x" })).status, 403);
    assert.equal((await (await as(w.users.studentA)).post("/charges", { studentId: w.residentA.id, kind: "other", amount: 1, description: "x" })).status, 403);
  });

  test("an adjustment needs a reason and cannot go below what was paid", async () => {
    const mgr = await as(w.users.managerA);
    await pay(mgr, w.chargeA.id, 5000);
    assert.equal((await mgr.patch(`/charges/${w.chargeA.id}`, { amount: 6000 })).status, 422);
    assert.equal((await mgr.patch(`/charges/${w.chargeA.id}`, { amount: 4000, reason: "x" })).status, 422);
    const ok = await mgr.patch(`/charges/${w.chargeA.id}`, { amount: 6000, reason: "Partial waiver agreed" });
    assert.equal(ok.status, 200);
    assert.equal((await balance(mgr, w.chargeA.id, w.residentA.id)).balance, 1000);
    assert.equal(await prisma.activityLog.count({ where: { message: { contains: "Partial waiver agreed" } } }), 1);
  });
});

describe("refunds", () => {
  test("owner-only manual refund: the due is owed again; over-refunding is refused", async () => {
    const mgr = await as(w.users.managerA);
    const p = (await pay(mgr, w.chargeA.id, 9500)).body.data;
    assert.equal((await mgr.post(`/payments/${p.id}/refund`, { amount: 1000, reason: "x" })).status, 403);
    const owner = await as(w.users.owner);
    const r = await owner.post(`/payments/${p.id}/refund`, { amount: 2000, reason: "Overcharged" });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    assert.equal(r.body.data.method, "manual");
    assert.equal(r.body.data.status, "processed");
    assert.match(r.body.data.refundNo, /^REF-\d{4}-0001$/);
    assert.equal((await balance(owner, w.chargeA.id, w.residentA.id)).balance, 2000);
    assert.equal((await owner.post(`/payments/${p.id}/refund`, { amount: 8000, reason: "too much" })).status, 422);
    assert.equal((await owner.post(`/payments/${p.id}/refund`, { amount: 0, reason: "zero" })).status, 422);
    const listed = (await owner.get("/payments", { studentId: w.residentA.id })).body.data.find((x) => x.id === p.id);
    assert.equal(listed.refundedAmount, 2000);
    assert.equal((await owner.get("/refunds")).body.data.length, 1);
  });

  test("a refund that also reduces the charge (deposit returned) keeps the due settled", async () => {
    const mgr = await as(w.users.managerA);
    const dep = (await mgr.post("/charges", { studentId: w.residentA.id, kind: "deposit", amount: 20000 })).body.data;
    const p = (await pay(mgr, dep.id, 20000)).body.data;
    const owner = await as(w.users.owner);
    assert.equal((await owner.post(`/payments/${p.id}/refund`, { amount: 15000, reason: "Deposit returned at move-out", adjustCharge: true })).status, 201);
    const c = await balance(owner, dep.id, w.residentA.id);
    assert.equal(c.amount, 5000);
    assert.equal(c.balance, 0);
    assert.equal(c.status, "paid");
  });
});

describe("receipts", () => {
  test("PDF receipt for allowed viewers only", async () => {
    const mgr = await as(w.users.managerA);
    const p = (await pay(mgr, w.chargeA.id, 9500)).body.data;
    const res = await (await as(w.users.studentA)).get(`/payments/${p.id}/receipt.pdf`).buffer(true);
    assert.equal(res.status, 200);
    assert.match(res.headers["content-type"], /application\/pdf/);
    assert.equal(Buffer.from(res.body).subarray(0, 4).toString(), "%PDF");
    assert.equal((await (await as(w.users.studentB)).get(`/payments/${p.id}/receipt.pdf`)).status, 403);
    assert.equal((await (await as(w.users.managerB)).get(`/payments/${p.id}/receipt.pdf`)).status, 403);
  });
});

describe("Razorpay confirmation (service level)", () => {
  test("Checkout signatures are verified with the key secret", () => {
    const sig = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET).update("order_1|pay_1").digest("hex");
    assert.equal(verifyCheckoutSignature("order_1", "pay_1", sig), true);
    assert.equal(verifyCheckoutSignature("order_1", "pay_2", sig), false);
    assert.equal(verifyCheckoutSignature("order_1", "pay_1", "nope"), false);
  });

  async function pendingPayment(orderId, amount = 9500) {
    return prisma.payment.create({
      data: {
        chargeId: w.chargeA.id, studentId: w.residentA.id, propertyId: w.A.id, status: "pending", amount, method: "upi",
        paidOn: new Date("2026-01-05"), reference: `PENDING_${orderId}`, receiptNo: `PENDING-${orderId}`, recordedBy: "Resident A", gatewayOrderId: orderId,
      },
    });
  }

  test("a capture confirms once, even when delivered twice at the same time", async () => {
    await pendingPayment("order_dup");
    const facts = { orderId: "order_dup", gatewayPaymentId: "pay_dup", amountPaise: 950000, currency: "INR" };
    const results = await Promise.all([confirmWebhookPayment(facts), confirmWebhookPayment(facts)]);
    assert.equal(results.filter((r) => r.confirmed).length, 1, JSON.stringify(results));
    assert.deepEqual(await confirmWebhookPayment(facts), { alreadyConfirmed: true });
    const p = await prisma.payment.findUnique({ where: { gatewayOrderId: "order_dup" } });
    assert.equal(p.status, "captured");
    assert.match(p.receiptNo, /^RCPT-/);
    assert.equal(p.gatewayPaymentId, "pay_dup");
  });

  test("a mismatched amount is never credited", async () => {
    await pendingPayment("order_bad");
    assert.deepEqual(await confirmWebhookPayment({ orderId: "order_bad", gatewayPaymentId: "pay_bad", amountPaise: 100, currency: "INR" }), { mismatch: true });
    assert.equal((await prisma.payment.findUnique({ where: { gatewayOrderId: "order_bad" } })).status, "pending");
    assert.deepEqual(await confirmWebhookPayment({ orderId: "order_unknown", gatewayPaymentId: "p", amountPaise: 1, currency: "INR" }), { ignored: "unknown order" });
  });

  test("refund webhooks settle once; a failed refund restores a reduced charge", async () => {
    const p = await prisma.payment.create({
      data: { chargeId: w.chargeA.id, studentId: w.residentA.id, propertyId: w.A.id, status: "captured", amount: 9500, method: "upi", paidOn: new Date("2026-01-05"), reference: "pay_x", receiptNo: "RCPT-T-1", recordedBy: "x", gatewayPaymentId: "pay_x" },
    });
    const base = { paymentId: p.id, chargeId: w.chargeA.id, studentId: w.residentA.id, propertyId: w.A.id, reason: "r", method: "gateway", createdBy: "Owner" };
    await prisma.refund.create({ data: { ...base, refundNo: "REF-T-1", amount: 1000, gatewayRefundId: "rfnd_ok" } });
    assert.deepEqual(await settleWebhookRefund({ gatewayRefundId: "rfnd_ok", status: "processed" }), { settled: "processed" });
    assert.deepEqual(await settleWebhookRefund({ gatewayRefundId: "rfnd_ok", status: "processed" }), { alreadySettled: true });

    await prisma.rentCharge.update({ where: { id: w.chargeA.id }, data: { amount: 8500 } });
    await prisma.refund.create({ data: { ...base, refundNo: "REF-T-2", amount: 1000, adjustCharge: true, gatewayRefundId: "rfnd_fail" } });
    assert.deepEqual(await settleWebhookRefund({ gatewayRefundId: "rfnd_fail", status: "failed" }), { settled: "failed" });
    assert.equal((await prisma.rentCharge.findUnique({ where: { id: w.chargeA.id } })).amount, 9500);
    // Razorpay's real outcome can still correct a status wrongly recorded as failed.
    assert.deepEqual(await settleWebhookRefund({ gatewayRefundId: "rfnd_fail", status: "processed" }), { settled: "processed" });
    assert.equal((await prisma.rentCharge.findUnique({ where: { id: w.chargeA.id } })).amount, 8500);
    assert.deepEqual(await settleWebhookRefund({ gatewayRefundId: "rfnd_fail", status: "failed" }), { ignored: "refund already processed" });
  });
});
