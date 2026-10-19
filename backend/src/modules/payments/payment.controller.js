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

// Razorpay webhook: raw body + signature verification, then confirm.
import { verifyWebhookSignature } from "./payment.gateway.js";
export const webhook = asyncHandler(async (req, res) => {
  const signature = req.headers["x-razorpay-signature"];
  if (!verifyWebhookSignature(req.rawBody, signature)) return res.status(400).json({ ok: false });
  const event = JSON.parse(req.rawBody.toString("utf8"));
  if (event.event === "payment.captured" || event.event === "order.paid") {
    const entity = event.payload?.payment?.entity || {};
    await svc.confirmWebhookPayment({ orderId: entity.order_id, gatewayPaymentId: entity.id });
  }
  res.json({ ok: true });
});
