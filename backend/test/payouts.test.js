import "./helpers/env.js";
import crypto from "node:crypto";
import { describe, test, beforeEach, afterEach, after } from "node:test";
import assert from "node:assert/strict";
import { prisma, resetDb, seedWorld, seedOtherOrg, disconnect, makePayoutAccount } from "./helpers/db.js";
import { as, rawRequest } from "./helpers/api.js";
import { WEBHOOK_SECRET } from "./helpers/env.js";
import { env } from "../src/config/env.js";

let w;
beforeEach(async () => { await resetDb(); w = await seedWorld(); env.payments.mode = "razorpay"; });
afterEach(() => { env.payments.mode = "simulated"; });
after(disconnect);

// ── Razorpay stub: Route onboarding, orders with transfers, refunds ──────────
function stubRazorpay({ activation = "under_review", requirements = [], omitTransfer = false, fail } = {}) {
  const realFetch = globalThis.fetch;
  const calls = [];
  let accounts = 0;
  globalThis.fetch = async (url, init = {}) => {
    const u = String(url);
    if (!u.startsWith("https://api.razorpay.com")) return realFetch(url, init);
    const path = u.replace("https://api.razorpay.com", "");
    const body = init.body ? JSON.parse(init.body) : null;
    const call = { method: init.method, path, body };
    calls.push(call);
    const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });
    const failure = fail?.(call);
    if (failure === "network") throw new TypeError("fetch failed");
    if (failure) return json({ error: { description: failure } }, 400);

    if (path === "/v2/accounts") return json({ id: `acc_gw_${++accounts}`, status: "created" });
    if (path.endsWith("/stakeholders")) return json({ id: "sth_gw_1" });
    if (init.method === "POST" && path.endsWith("/products")) return json({ id: "acc_prd_gw_1", activation_status: "requested" });
    if (init.method === "PATCH" && path.includes("/products/")) return json({ id: "acc_prd_gw_1", activation_status: activation, requirements });
    if (path === "/v1/orders") {
      const order = { id: `order_${calls.length}`, amount: body.amount, currency: "INR" };
      if (body.transfers && !omitTransfer) {
        order.transfers = body.transfers.map((t, i) => ({ id: `trf_${calls.length}_${i}`, recipient: t.account, amount: t.amount, status: "created" }));
      }
      return json(order);
    }
    if (path.endsWith("/refund")) return json({ id: "rfnd_gw_1", status: "pending" });
    return json({ error: { description: `unexpected ${init.method} ${path}` } }, 404);
  };
  return { calls, restore: () => { globalThis.fetch = realFetch; } };
}
let gw;
afterEach(() => gw?.restore());

const details = (over = {}) => ({
  label: "Main account", businessType: "individual", legalName: "Asha Verma", contactName: "Asha Verma",
  email: "asha@example.test", phone: "98765 43210", pan: "abcpe1234f", gstin: "",
  address: { street: "12 MG Road, Block C", city: "Gurugram", state: "Haryana", pincode: "122003" },
  bank: { holderName: "Asha Verma", accountNumber: "123456789012", ifsc: "hdfc0001234" },
  acceptTerms: true, ...over,
});

const sign = (raw) => crypto.createHmac("sha256", WEBHOOK_SECRET).update(raw).digest("hex");
const hook = (event, extra = {}) => {
  const raw = JSON.stringify({ event, ...extra });
  return rawRequest().post("/api/v1/payments/webhook").set("Content-Type", "application/json").set("x-razorpay-signature", sign(raw)).send(raw);
};
const productEvent = (event, accountId, status, requirements = []) =>
  hook(event, { account_id: accountId, payload: { merchant_product: { entity: { id: "acc_prd_gw_1", merchant_id: accountId, activation_status: status }, data: { requirements } } } });

const ownerClient = () => as(w.users.owner);

describe("registering a payout account (owner)", () => {
  test("registers with Razorpay in four steps and stores no account number or PAN", async () => {
    gw = stubRazorpay();
    const res = await (await ownerClient()).post("/payout-accounts", details());
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.deepEqual(gw.calls.map((c) => `${c.method} ${c.path.replace(/acc_gw_\d+/, "ACC").replace(/acc_prd_gw_1/, "PRD")}`), [
      "POST /v2/accounts", "POST /v2/accounts/ACC/stakeholders", "POST /v2/accounts/ACC/products", "PATCH /v2/accounts/ACC/products/PRD",
    ]);
    // An individual is identified by their own PAN, sent with the stakeholder.
    assert.equal(gw.calls[0].body.type, "route");
    assert.equal(gw.calls[0].body.legal_info, undefined);
    assert.equal(gw.calls[1].body.kyc.pan, "ABCPE1234F");
    assert.deepEqual(gw.calls[3].body.settlements, { account_number: "123456789012", ifsc_code: "HDFC0001234", beneficiary_name: "Asha Verma" });
    assert.equal(gw.calls[3].body.tnc_accepted, true);

    assert.equal(res.body.data.kycStatus, "under_review");
    assert.equal(res.body.data.bankLast4, "9012");
    const stored = JSON.stringify(await prisma.payoutAccount.findMany());
    assert.ok(!stored.includes("123456789012") && !stored.includes("ABCPE1234F"), "account number or PAN was stored");
    assert.ok(!JSON.stringify(res.body).includes("123456789012"));
    assert.equal(res.body.data.gatewayAccountId, undefined, "gateway ids stay server-side");
  });

  test("a company sends its business PAN and GSTIN instead of a stakeholder", async () => {
    gw = stubRazorpay();
    const res = await (await ownerClient()).post("/payout-accounts", details({
      businessType: "private_limited", legalName: "Verma Hostels Pvt Ltd", pan: "AABCV1234F", gstin: "06AABCV1234F1Z5",
    }));
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.deepEqual(gw.calls[0].body.legal_info, { pan: "AABCV1234F", gst: "06AABCV1234F1Z5" });
    assert.ok(!gw.calls.some((c) => c.path.endsWith("/stakeholders")));
  });

  test("the gateway's activation status becomes the account status", async () => {
    gw = stubRazorpay({ activation: "needs_clarification", requirements: [{ field_reference: "settlements.beneficiary_name", reason_code: "needs_clarification" }] });
    const res = await (await ownerClient()).post("/payout-accounts", details());
    assert.equal(res.body.data.kycStatus, "needs_clarification");
    assert.match(res.body.data.kycNote, /beneficiary name/);
  });

  test("a failure halfway leaves a draft, and re-submitting resumes without a second linked account", async () => {
    gw = stubRazorpay({ fail: (c) => (c.path.endsWith("/products") ? "Business category not allowed" : undefined) });
    const owner = await ownerClient();
    const first = await owner.post("/payout-accounts", details());
    assert.equal(first.status, 409);
    assert.match(first.body.error.message, /Business category not allowed/);
    const draft = await prisma.payoutAccount.findFirst();
    assert.equal(draft.kycStatus, "draft");
    assert.ok(draft.gatewayAccountId && draft.gatewayStakeholderId && !draft.gatewayProductId);
    gw.restore();

    gw = stubRazorpay();
    const retry = await owner.post(`/payout-accounts/${draft.id}/resubmit`, details());
    assert.equal(retry.status, 200, JSON.stringify(retry.body));
    assert.ok(!gw.calls.some((c) => c.path === "/v2/accounts"), "created a duplicate linked account");
    assert.ok(!gw.calls.some((c) => c.path.endsWith("/stakeholders")), "created a duplicate stakeholder");
    assert.equal(retry.body.data.kycStatus, "under_review");
    assert.equal(await prisma.payoutAccount.count(), 1);
  });

  test("a dropped connection is reported as unknown and keeps the draft", async () => {
    gw = stubRazorpay({ fail: (c) => (c.path.endsWith("/stakeholders") ? "network" : undefined) });
    const res = await (await ownerClient()).post("/payout-accounts", details());
    assert.equal(res.status, 409);
    assert.match(res.body.error.message, /Could not reach Razorpay/);
    assert.equal((await prisma.payoutAccount.findFirst()).kycStatus, "draft");
  });

  test("a verified account cannot be re-submitted", async () => {
    const acc = await makePayoutAccount(w.org);
    gw = stubRazorpay();
    const res = await (await ownerClient()).post(`/payout-accounts/${acc.id}/resubmit`, details());
    assert.equal(res.status, 409);
    assert.equal(gw.calls.length, 0);
  });

  test("simulated mode activates immediately and never calls Razorpay; disabled mode says it is not set up", async () => {
    gw = stubRazorpay();
    env.payments.mode = "simulated";
    const sim = await (await ownerClient()).post("/payout-accounts", details());
    assert.equal(sim.status, 201);
    assert.equal(sim.body.data.kycStatus, "active");
    assert.match(sim.body.data.kycNote, /Simulated/);
    env.payments.mode = "disabled";
    const off = await (await ownerClient()).post("/payout-accounts", details({ label: "Second" }));
    assert.equal(off.status, 503);
    assert.equal(off.body.error.code, "NOT_CONFIGURED");
    assert.equal(gw.calls.length, 0);
  });

  test("bad input is rejected field by field, before anything reaches Razorpay", async () => {
    gw = stubRazorpay();
    const owner = await ownerClient();
    const bad = async (over, field) => {
      const res = await owner.post("/payout-accounts", details(over));
      assert.equal(res.status, 422, `${field}: ${JSON.stringify(res.body)}`);
      assert.ok(res.body.error.fieldErrors[field], `no error for ${field}: ${JSON.stringify(res.body.error.fieldErrors)}`);
    };
    await bad({ pan: "123" }, "pan");
    await bad({ pan: "ABCDE1234F" }, "pan"); // 4th letter must be P for an individual
    await bad({ bank: { holderName: "A B", accountNumber: "12ab", ifsc: "HDFC0001234" } }, "bank.accountNumber");
    await bad({ bank: { holderName: "A B", accountNumber: "123456789", ifsc: "BAD" } }, "bank.ifsc");
    await bad({ phone: "12345" }, "phone");
    await bad({ address: { street: "short", city: "Gurugram", state: "Haryana", pincode: "122003" } }, "address.street");
    await bad({ businessType: "llp", pan: "AABCV1234F", gstin: "" }, "gstin");
    await bad({ acceptTerms: false }, "acceptTerms");
    assert.equal(gw.calls.length, 0);
    assert.equal(await prisma.payoutAccount.count({ where: { kycStatus: { not: "draft" } } }), 0);
  });
});

describe("who can manage payout accounts", () => {
  test("managers and students cannot list, add or assign; the owner's list is org-scoped", async () => {
    const acc = await makePayoutAccount(w.org);
    const other = await seedOtherOrg();
    const otherAcc = await makePayoutAccount(other.org);
    for (const user of [w.users.managerA, w.users.studentA]) {
      const c = await as(user);
      assert.equal((await c.get("/payout-accounts")).status, 403);
      assert.equal((await c.post("/payout-accounts", details())).status, 403);
      assert.equal((await c.put(`/payout-accounts/properties/${w.A.id}`, { payoutAccountId: acc.id })).status, 403);
    }
    assert.equal((await rawRequest().get("/api/v1/payout-accounts")).status, 401);
    const list = (await (await ownerClient()).get("/payout-accounts")).body.data;
    assert.deepEqual(list.map((a) => a.id), [acc.id]);
    assert.ok(!list.some((a) => a.id === otherAcc.id));
  });

  test("another organization's account or property is 'not found', never usable", async () => {
    const other = await seedOtherOrg();
    const otherAcc = await makePayoutAccount(other.org);
    const mine = await makePayoutAccount(w.org);
    const owner = await ownerClient();
    assert.equal((await owner.put(`/payout-accounts/properties/${w.A.id}`, { payoutAccountId: otherAcc.id })).status, 404);
    assert.equal((await owner.put(`/payout-accounts/properties/${other.X.id}`, { payoutAccountId: mine.id })).status, 404);
    assert.equal((await owner.patch(`/payout-accounts/${otherAcc.id}`, { label: "x" })).status, 404);
    assert.equal((await owner.delete(`/payout-accounts/${otherAcc.id}`)).status, 404);
    assert.equal((await owner.post(`/payout-accounts/${otherAcc.id}/resubmit`, details())).status, 404);
    assert.equal((await prisma.property.findUnique({ where: { id: w.A.id } })).payoutAccountId, null);
  });

  test("the database itself refuses a hostel pointing at another organization's account", async () => {
    const other = await seedOtherOrg();
    const otherAcc = await makePayoutAccount(other.org);
    await assert.rejects(prisma.property.update({ where: { id: w.A.id }, data: { payoutAccountId: otherAcc.id } }), /Foreign key constraint/);
  });

  test("the property API does not expose the payout account to managers or students", async () => {
    const acc = await makePayoutAccount(w.org);
    await prisma.property.update({ where: { id: w.A.id }, data: { payoutAccountId: acc.id } });
    for (const user of [w.users.owner, w.users.managerA, w.users.studentA]) {
      const res = await (await as(user)).get(`/properties/${w.A.id}`);
      assert.equal(res.status, 200);
      assert.equal(res.body.data.payoutAccountId, undefined);
    }
  });
});

describe("one account for all hostels, or a different one for each", () => {
  const payNow = async (user, chargeId) => (await as(user)).post("/payments/pay-now", { chargeId, method: "upi" });
  const transferTargets = () => gw.calls.filter((c) => c.path === "/v1/orders").map((c) => c.body.transfers[0].account);

  test("each hostel's rent is split to the account that hostel is assigned", async () => {
    const accA = await makePayoutAccount(w.org, { gatewayAccountId: "acc_for_A" });
    const accB = await makePayoutAccount(w.org, { gatewayAccountId: "acc_for_B" });
    const owner = await ownerClient();
    assert.equal((await owner.put(`/payout-accounts/properties/${w.A.id}`, { payoutAccountId: accA.id })).status, 200);
    assert.equal((await owner.put(`/payout-accounts/properties/${w.B.id}`, { payoutAccountId: accB.id })).status, 200);
    gw = stubRazorpay();

    const a = await payNow(w.users.studentA, w.chargeA.id);
    const b = await payNow(w.users.studentB, w.chargeB.id);
    assert.equal(a.status, 201, JSON.stringify(a.body));
    assert.equal(b.status, 201, JSON.stringify(b.body));
    assert.deepEqual(transferTargets(), ["acc_for_A", "acc_for_B"]);

    const order = gw.calls.find((c) => c.path === "/v1/orders").body;
    assert.equal(order.transfers[0].amount, order.amount, "the whole payment goes to the owner");
    assert.equal(order.transfers[0].currency, "INR");
    const row = await prisma.payment.findFirst({ where: { chargeId: w.chargeA.id } });
    assert.equal(row.payoutAccountId, accA.id);
    assert.match(row.gatewayTransferId, /^trf_/);
    assert.equal(row.transferStatus, "created");
  });

  test("two hostels can share one account", async () => {
    const acc = await makePayoutAccount(w.org, { gatewayAccountId: "acc_shared" });
    const owner = await ownerClient();
    await owner.put(`/payout-accounts/properties/${w.A.id}`, { payoutAccountId: acc.id });
    await owner.put(`/payout-accounts/properties/${w.B.id}`, { payoutAccountId: acc.id });
    gw = stubRazorpay();
    await payNow(w.users.studentA, w.chargeA.id);
    await payNow(w.users.studentB, w.chargeB.id);
    assert.deepEqual(transferTargets(), ["acc_shared", "acc_shared"]);
    assert.deepEqual((await owner.get("/payout-accounts")).body.data[0].propertyIds.sort(), [w.A.id, w.B.id].sort());
  });

  test("switching a hostel to another account retires the open order for the old one", async () => {
    const accA = await makePayoutAccount(w.org, { gatewayAccountId: "acc_old" });
    const accB = await makePayoutAccount(w.org, { gatewayAccountId: "acc_new" });
    const owner = await ownerClient();
    await owner.put(`/payout-accounts/properties/${w.A.id}`, { payoutAccountId: accA.id });
    gw = stubRazorpay();
    await payNow(w.users.studentA, w.chargeA.id);
    await owner.put(`/payout-accounts/properties/${w.A.id}`, { payoutAccountId: accB.id });
    const again = await payNow(w.users.studentA, w.chargeA.id);
    assert.equal(again.status, 201, JSON.stringify(again.body));
    assert.deepEqual(transferTargets(), ["acc_old", "acc_new"]);
    const rows = await prisma.payment.findMany({ where: { chargeId: w.chargeA.id }, orderBy: { createdAt: "asc" } });
    assert.deepEqual(rows.map((r) => r.status), ["failed", "pending"]);
  });

  test("pay-now never falls back to the platform account: no account, or one not yet verified, means NOT_CONFIGURED and no order", async () => {
    gw = stubRazorpay();
    const none = await payNow(w.users.studentA, w.chargeA.id);
    assert.equal(none.status, 503);
    assert.equal(none.body.error.code, "NOT_CONFIGURED");

    for (const kycStatus of ["draft", "submitted", "under_review", "needs_clarification", "rejected", "suspended"]) {
      const acc = await makePayoutAccount(w.org, { kycStatus });
      await prisma.property.update({ where: { id: w.A.id }, data: { payoutAccountId: acc.id } });
      const res = await payNow(w.users.studentA, w.chargeA.id);
      assert.equal(res.status, 503, `${kycStatus} account accepted a payment`);
    }
    assert.equal(gw.calls.filter((c) => c.path === "/v1/orders").length, 0, "an order was created without a verified account");
    assert.equal(await prisma.payment.count(), 0);
  });

  test("if the gateway order comes back without the split, nothing is handed to the student", async () => {
    const acc = await makePayoutAccount(w.org);
    await prisma.property.update({ where: { id: w.A.id }, data: { payoutAccountId: acc.id } });
    gw = stubRazorpay({ omitTransfer: true });
    const res = await payNow(w.users.studentA, w.chargeA.id);
    assert.equal(res.status, 409, JSON.stringify(res.body));
    assert.equal(await prisma.payment.count(), 0);
  });

  test("an account in use by a hostel, or one that has been paid into, cannot be deleted", async () => {
    const used = await makePayoutAccount(w.org);
    const spare = await makePayoutAccount(w.org);
    const owner = await ownerClient();
    await owner.put(`/payout-accounts/properties/${w.A.id}`, { payoutAccountId: used.id });
    assert.equal((await owner.delete(`/payout-accounts/${used.id}`)).status, 409);
    await owner.put(`/payout-accounts/properties/${w.A.id}`, { payoutAccountId: null });
    assert.equal((await owner.delete(`/payout-accounts/${spare.id}`)).status, 200);
    assert.equal(await prisma.payoutAccount.count({ where: { id: spare.id } }), 0);

    gw = stubRazorpay();
    await owner.put(`/payout-accounts/properties/${w.A.id}`, { payoutAccountId: used.id });
    await payNow(w.users.studentA, w.chargeA.id);
    await owner.put(`/payout-accounts/properties/${w.A.id}`, { payoutAccountId: null });
    assert.equal((await owner.delete(`/payout-accounts/${used.id}`)).status, 409, "deleted an account that rent was paid into");
  });
});

describe("gateway webhooks for payout accounts and transfers", () => {
  const ownerNotes = () => prisma.notification.findMany({ where: { recipientUserId: w.users.owner.id } });

  test("product.route.activated verifies the account and tells the owner", async () => {
    const acc = await makePayoutAccount(w.org, { kycStatus: "under_review", gatewayAccountId: "acc_hook_1" });
    const res = await productEvent("product.route.activated", "acc_hook_1", "activated");
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal((await prisma.payoutAccount.findUnique({ where: { id: acc.id } })).kycStatus, "active");
    assert.ok((await ownerNotes()).some((n) => /verified/.test(n.title)));
    // A replay changes nothing and does not notify twice.
    const replay = await productEvent("product.route.activated", "acc_hook_1", "activated");
    assert.equal(replay.body.result.alreadyApplied, true);
    assert.equal((await ownerNotes()).filter((n) => /verified/.test(n.title)).length, 1);
  });

  test("product.route.needs_clarification records what to fix", async () => {
    const acc = await makePayoutAccount(w.org, { kycStatus: "under_review", gatewayAccountId: "acc_hook_2" });
    await productEvent("product.route.needs_clarification", "acc_hook_2", "needs_clarification", [{ field_reference: "bank_account", reason_code: "field_missing" }]);
    const row = await prisma.payoutAccount.findUnique({ where: { id: acc.id } });
    assert.equal(row.kycStatus, "needs_clarification");
    assert.match(row.kycNote, /bank account/);
  });

  test("events for unknown accounts or with a bad signature change nothing", async () => {
    const acc = await makePayoutAccount(w.org, { kycStatus: "under_review", gatewayAccountId: "acc_hook_3" });
    assert.equal((await productEvent("product.route.activated", "acc_someone_else", "activated")).body.result.ignored, "unknown account");
    const raw = JSON.stringify({ event: "product.route.activated", account_id: "acc_hook_3", payload: { merchant_product: { entity: { activation_status: "activated" } } } });
    const forged = await rawRequest().post("/api/v1/payments/webhook").set("Content-Type", "application/json").set("x-razorpay-signature", "0".repeat(64)).send(raw);
    assert.equal(forged.status, 400);
    assert.equal((await prisma.payoutAccount.findUnique({ where: { id: acc.id } })).kycStatus, "under_review");
  });

  // A captured online payment whose owner's share is "created".
  const capturedPayment = async () => {
    const acc = await makePayoutAccount(w.org, { gatewayAccountId: "acc_pay" });
    await prisma.property.update({ where: { id: w.A.id }, data: { payoutAccountId: acc.id } });
    gw = stubRazorpay();
    await (await as(w.users.studentA)).post("/payments/pay-now", { chargeId: w.chargeA.id, method: "upi" });
    const order = gw.calls.find((c) => c.path === "/v1/orders");
    const orderId = `order_${gw.calls.indexOf(order) + 1}`;
    const captured = JSON.stringify({ event: "payment.captured", payload: { payment: { entity: { id: "pay_1", order_id: orderId, amount: 950000, currency: "INR" } } } });
    await rawRequest().post("/api/v1/payments/webhook").set("Content-Type", "application/json").set("x-razorpay-signature", sign(captured)).send(captured);
    return prisma.payment.findFirst({ where: { chargeId: w.chargeA.id } });
  };
  const transferEvent = (event, id) => hook(event, { payload: { transfer: { entity: { id } } } });

  test("transfer.processed marks the owner's share paid out, once", async () => {
    const p = await capturedPayment();
    assert.equal(p.status, "captured");
    const res = await transferEvent("transfer.processed", p.gatewayTransferId);
    assert.equal(res.body.result.updated, "processed");
    assert.equal((await prisma.payment.findUnique({ where: { id: p.id } })).transferStatus, "processed");
    assert.equal((await transferEvent("transfer.processed", p.gatewayTransferId)).body.result.alreadyApplied, true);
  });

  test("transfer.failed marks it failed and tells the owner", async () => {
    const p = await capturedPayment();
    await transferEvent("transfer.failed", p.gatewayTransferId);
    assert.equal((await prisma.payment.findUnique({ where: { id: p.id } })).transferStatus, "failed");
    assert.ok((await ownerNotes()).some((n) => /payout failed/i.test(n.title)));
  });

  test("an unknown transfer is ignored", async () => {
    assert.equal((await transferEvent("transfer.processed", "trf_nope")).body.result.ignored, "unknown transfer");
  });

  test("refunding a split payment also reverses the owner's share; a full refund marks it reversed", async () => {
    const p = await capturedPayment();
    await transferEvent("transfer.processed", p.gatewayTransferId);
    const res = await (await ownerClient()).post(`/payments/${p.id}/refund`, { amount: 9500, reason: "Move-out" });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    const refundCall = gw.calls.find((c) => c.path.endsWith("/refund"));
    assert.equal(refundCall.body.reverse_all, true);
    assert.equal((await prisma.payment.findUnique({ where: { id: p.id } })).transferStatus, "reversed");
  });

  test("a partial refund reverses the share but leaves the payment's transfer status alone", async () => {
    const p = await capturedPayment();
    await transferEvent("transfer.processed", p.gatewayTransferId);
    await (await ownerClient()).post(`/payments/${p.id}/refund`, { amount: 1000, reason: "Goodwill" });
    assert.equal(gw.calls.find((c) => c.path.endsWith("/refund")).body.reverse_all, true);
    assert.equal((await prisma.payment.findUnique({ where: { id: p.id } })).transferStatus, "processed");
  });

  test("a payment recorded by hand (no gateway) is refunded without any reversal", async () => {
    const mgr = await as(w.users.managerA);
    const rec = await mgr.post("/payments/record", { chargeId: w.chargeA.id, amount: 9500, method: "cash", paidOn: new Date().toISOString().slice(0, 10), reference: "" });
    assert.equal(rec.status, 201);
    gw = stubRazorpay();
    const res = await (await ownerClient()).post(`/payments/${rec.body.data.id}/refund`, { amount: 500, reason: "Overcharged" });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.equal(gw.calls.length, 0);
  });
});
