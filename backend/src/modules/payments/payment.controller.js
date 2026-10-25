import * as svc from "./payment.service.js";
import { ok } from "../../utils/respond.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { prisma } from "../../config/prisma.js";

// recordedBy / actor name needs the display name; fetch once per write.
async function actorName(auth) {
  const u = await prisma.user.findUnique({ where: { id: auth.userId }, select: { name: true } });
  return u?.name ?? "Staff";
}

export const listCharges = asyncHandler(async (req, res) => ok(res, await svc.listCharges(req.auth, req.query)));
export const listPayments = asyncHandler(async (req, res) => ok(res, await svc.listPayments(req.auth, req.query)));
export const summary = asyncHandler(async (req, res) => ok(res, await svc.summary(req.auth, req.query)));
export const getReceipt = asyncHandler(async (req, res) => ok(res, await svc.getReceipt(req.auth, req.params.paymentId)));
export const recordPayment = asyncHandler(async (req, res) => ok(res, await svc.recordPayment(req.auth, await actorName(req.auth), req.body), 201));
export const sendReminders = asyncHandler(async (req, res) => ok(res, await svc.sendReminders(req.auth, await actorName(req.auth), req.body.chargeIds)));
export const payNow = asyncHandler(async (req, res) => ok(res, await svc.payNow(req.auth, await actorName(req.auth), req.body.chargeId, req.body.method), 201));

// Razorpay webhook. Mounted in app.js BEFORE the JSON parser and every
// authenticated router, so it receives the exact raw bytes that were signed.
import { verifyWebhookSignature } from "./payment.gateway.js";
import { env } from "../../config/env.js";
export const webhook = asyncHandler(async (req, res) => {
  if (env.payments.mode !== "razorpay") return res.status(404).json({ ok: false });
  const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.from("");
  if (!verifyWebhookSignature(raw, req.headers["x-razorpay-signature"])) return res.status(400).json({ ok: false, error: "bad signature" });

  let event;
  try { event = JSON.parse(raw.toString("utf8")); } catch { return res.status(400).json({ ok: false, error: "bad payload" }); }
  const entity = event?.payload?.payment?.entity || {};
  const facts = { orderId: entity.order_id, gatewayPaymentId: entity.id, amountPaise: entity.amount, currency: entity.currency };

  let result = { ignored: event?.event };
  if (event?.event === "payment.captured" || event?.event === "order.paid") result = await svc.confirmWebhookPayment(facts);
  else if (event?.event === "payment.failed") result = await svc.failWebhookPayment(facts);
  res.json({ ok: true, result });
});
