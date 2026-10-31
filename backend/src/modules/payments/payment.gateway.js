import crypto from "node:crypto";
import { env } from "../../config/env.js";

// Real online payments via Razorpay. Only used when PAYMENT_MODE=razorpay.
// The flow is the standard, secure one:
//   1) server creates an Order (amount is authoritative, set server-side)
//   2) client completes payment in Razorpay Checkout
//   3) the payment is confirmed by the server, never by the client's word:
//      - the signed webhook (payment.captured / order.paid), and
//      - /payments/verify: the Checkout signature is checked AND the payment is
//        fetched from Razorpay's API, so it works without a reachable webhook
//        (local development) and confirms instantly in production.

const RAZORPAY_API = "https://api.razorpay.com/v1";
const basicAuth = () => `Basic ${Buffer.from(`${env.payments.razorpayKeyId}:${env.payments.razorpayKeySecret}`).toString("base64")}`;

async function call(method, path, body) {
  const res = await fetch(`${RAZORPAY_API}${path}`, {
    method,
    headers: { Authorization: basicAuth(), "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* not JSON */ }
  if (!res.ok) {
    const err = new Error(`Razorpay ${method} ${path} failed: ${res.status} ${json?.error?.description ?? text}`);
    err.gatewayDescription = json?.error?.description;
    throw err;
  }
  return json;
}

export function createOrder({ amountRupees, receipt, notes }) {
  return call("POST", "/orders", {
    amount: Math.round(amountRupees * 100), // paise
    currency: "INR",
    receipt: receipt.slice(0, 40),
    notes,
    payment_capture: 1,
  });
}

/** The payment as Razorpay records it: { id, order_id, status, amount, currency, ... }. */
export const fetchPayment = (paymentId) => call("GET", `/payments/${encodeURIComponent(paymentId)}`);

/** Refund (part of) a captured payment. Returns { id, status: 'pending'|'processed'|'failed', ... }. */
export const refundPayment = (paymentId, amountRupees, notes) =>
  call("POST", `/payments/${encodeURIComponent(paymentId)}/refund`, { amount: Math.round(amountRupees * 100), speed: "normal", notes });

const safeEqual = (a, b) => {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b || ""));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

// Verify the webhook signature Razorpay sends in `x-razorpay-signature`.
// `rawBody` MUST be the exact bytes received (see app.js raw parser).
export function verifyWebhookSignature(rawBody, signature) {
  const expected = crypto.createHmac("sha256", env.payments.razorpayWebhookSecret).update(rawBody).digest("hex");
  return safeEqual(expected, signature);
}

// Verify the signature Razorpay Checkout returns to the browser on success:
// HMAC-SHA256(order_id + "|" + payment_id) with the key secret.
export function verifyCheckoutSignature(orderId, paymentId, signature) {
  const expected = crypto.createHmac("sha256", env.payments.razorpayKeySecret).update(`${orderId}|${paymentId}`).digest("hex");
  return safeEqual(expected, signature);
}
