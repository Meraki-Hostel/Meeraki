import crypto from "node:crypto";
import { env } from "../../config/env.js";

// Real online payments via Razorpay. Only used when PAYMENT_MODE=razorpay.
// The flow is the standard, secure one:
//   1) server creates an Order (amount is authoritative, set server-side)
//   2) client completes payment in Razorpay Checkout
//   3) Razorpay calls our webhook; we VERIFY the signature, then post the Payment
// We never trust a client-reported "success" or amount.

const RAZORPAY_API = "https://api.razorpay.com/v1";

export async function createOrder({ amountRupees, receipt, notes }) {
  const auth = Buffer.from(`${env.payments.razorpayKeyId}:${env.payments.razorpayKeySecret}`).toString("base64");
  const res = await fetch(`${RAZORPAY_API}/orders`, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      amount: Math.round(amountRupees * 100), // paise
      currency: "INR",
      receipt,
      notes,
      payment_capture: 1,
    }),
  });
  if (!res.ok) throw new Error(`Razorpay order failed: ${res.status} ${await res.text()}`);
  return res.json(); // { id: "order_...", amount, currency, ... }
}

// Verify the webhook signature Razorpay sends in `x-razorpay-signature`.
// `rawBody` MUST be the exact bytes received (see payment.routes.js raw parser).
export function verifyWebhookSignature(rawBody, signature) {
  const expected = crypto
    .createHmac("sha256", env.payments.razorpayWebhookSecret)
    .update(rawBody)
    .digest("hex");
  // timing-safe compare
  const a = Buffer.from(expected);
  const b = Buffer.from(signature || "");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
