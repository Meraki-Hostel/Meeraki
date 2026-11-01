import * as svc from "./payment.service.js";
import * as charges from "./charge.service.js";
import { ok } from "../../utils/respond.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { actorName } from "../../utils/sideEffects.js";
import { renderReceiptPdf } from "./receipt.pdf.js";
import { verifyWebhookSignature } from "./payment.gateway.js";
import { env } from "../../config/env.js";

export const listCharges = asyncHandler(async (req, res) => ok(res, await svc.listCharges(req.auth, req.query)));
export const listPayments = asyncHandler(async (req, res) => ok(res, await svc.listPayments(req.auth, req.query)));
export const summary = asyncHandler(async (req, res) => ok(res, await svc.summary(req.auth, req.query)));
export const getReceipt = asyncHandler(async (req, res) => ok(res, await svc.getReceipt(req.auth, req.params.paymentId)));
export const getReceiptPdf = asyncHandler(async (req, res) => {
  const r = await svc.getReceipt(req.auth, req.params.paymentId);
  const pdf = await renderReceiptPdf(r);
  res.set({ "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${r.receiptNo}.pdf"`, "Cache-Control": "private, no-store" });
  res.send(pdf);
});
export const recordPayment = asyncHandler(async (req, res) => ok(res, await svc.recordPayment(req.auth, await actorName(req.auth), req.body), 201));
export const sendReminders = asyncHandler(async (req, res) => ok(res, await svc.sendReminders(req.auth, await actorName(req.auth), req.body.chargeIds)));
export const payNow = asyncHandler(async (req, res) => ok(res, await svc.payNow(req.auth, await actorName(req.auth), req.body.chargeId, req.body.method), 201));
export const verify = asyncHandler(async (req, res) => ok(res, await svc.verifyCheckout(req.auth, req.body)));
export const refund = asyncHandler(async (req, res) => ok(res, await svc.refund(req.auth, await actorName(req.auth), req.params.paymentId, req.body), 201));
export const listRefunds = asyncHandler(async (req, res) => ok(res, await svc.listRefunds(req.auth, req.query)));

export const generateCharges = asyncHandler(async (req, res) => ok(res, await charges.generateNow(req.auth, await actorName(req.auth), req.body)));
export const createCharge = asyncHandler(async (req, res) => ok(res, await charges.createCharge(req.auth, await actorName(req.auth), req.body), 201));
export const adjustCharge = asyncHandler(async (req, res) => ok(res, await charges.adjustCharge(req.auth, await actorName(req.auth), req.params.id, req.body)));

// Razorpay webhook. Mounted in app.js BEFORE the JSON parser and every
// authenticated router, so it receives the exact raw bytes that were signed.
export const webhook = asyncHandler(async (req, res) => {
  if (env.payments.mode !== "razorpay") return res.status(404).json({ ok: false });
  const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.from("");
  if (!verifyWebhookSignature(raw, req.headers["x-razorpay-signature"])) return res.status(400).json({ ok: false, error: "bad signature" });

  let event;
  try { event = JSON.parse(raw.toString("utf8")); } catch { return res.status(400).json({ ok: false, error: "bad payload" }); }
  const entity = event?.payload?.payment?.entity || {};
  const facts = { orderId: entity.order_id, gatewayPaymentId: entity.id, amountPaise: entity.amount, currency: entity.currency };
  const refundEntity = event?.payload?.refund?.entity || {};

  let result = { ignored: event?.event };
  if (event?.event === "payment.captured" || event?.event === "order.paid") result = await svc.confirmWebhookPayment(facts);
  else if (event?.event === "payment.failed") result = await svc.failWebhookPayment(facts);
  else if (event?.event === "refund.processed") result = await svc.settleWebhookRefund({ gatewayRefundId: refundEntity.id, status: "processed" });
  else if (event?.event === "refund.failed") result = await svc.settleWebhookRefund({ gatewayRefundId: refundEntity.id, status: "failed" });
  res.json({ ok: true, result });
});
