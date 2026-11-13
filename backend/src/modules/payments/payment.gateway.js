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

const RAZORPAY_API = "https://api.razorpay.com"; // paths carry their own /v1 or /v2
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

/**
 * `transfer` splits the captured payment to a Route linked account (the hostel's
 * payout account). The whole amount goes to the owner; no platform commission yet.
 */
export function createOrder({ amountRupees, receipt, notes, transfer }) {
  const amount = Math.round(amountRupees * 100); // paise
  return call("POST", "/v1/orders", {
    amount,
    currency: "INR",
    receipt: receipt.slice(0, 40),
    notes,
    payment_capture: 1,
    ...(transfer && {
      transfers: [{
        account: transfer.accountId,
        amount,
        currency: "INR",
        notes: transfer.notes,
        on_hold: false,
      }],
    }),
  });
}

/** The payment as Razorpay records it: { id, order_id, status, amount, currency, ... }. */
export const fetchPayment = (paymentId) => call("GET", `/v1/payments/${encodeURIComponent(paymentId)}`);

/** Refund (part of) a captured payment. Returns { id, status: 'pending'|'processed'|'failed', ... }. */
export const refundPayment = (paymentId, amountRupees, notes, { reverseTransfer = false } = {}) =>
  call("POST", `/v1/payments/${encodeURIComponent(paymentId)}/refund`, {
    amount: Math.round(amountRupees * 100), speed: "normal", notes,
    // A split payment: take the owner's share back too (the platform account funds the refund).
    ...(reverseTransfer && { reverse_all: true }),
  });

// ── Route linked accounts (owner payout accounts) ────────────────────────────
// Onboarding is four calls: account → stakeholder (individuals/proprietors) →
// request the Route product → attach the settlement bank account. Each returns the
// id the next step needs, so the caller saves progress after every step.

export const createLinkedAccount = ({ referenceId, email, phone, legalName, contactName, businessType, address, pan, gst }) =>
  call("POST", "/v2/accounts", {
    type: "route",
    reference_id: referenceId,
    email,
    phone: Number(String(phone).replace(/\D/g, "").slice(-10)),
    legal_business_name: legalName,
    contact_name: contactName,
    business_type: businessType,
    profile: {
      category: env.payments.routeCategory,
      subcategory: env.payments.routeSubcategory,
      addresses: {
        registered: {
          street1: address.street, street2: address.street2 || address.street, city: address.city,
          state: address.state, postal_code: address.pincode, country: "IN",
        },
      },
    },
    ...((pan || gst) && { legal_info: { ...(pan && { pan }), ...(gst && { gst }) } }),
  });

export const createStakeholder = (accountId, { name, email, pan, address }) =>
  call("POST", `/v2/accounts/${encodeURIComponent(accountId)}/stakeholders`, {
    name,
    email,
    kyc: { pan },
    addresses: { residential: { street: address.street, city: address.city, state: address.state, postal_code: address.pincode, country: "IN" } },
  });

export const requestRouteProduct = (accountId) =>
  call("POST", `/v2/accounts/${encodeURIComponent(accountId)}/products`, { product_name: "route", tnc_accepted: true });

export const updateRouteSettlement = (accountId, productId, { accountNumber, ifsc, beneficiaryName }) =>
  call("PATCH", `/v2/accounts/${encodeURIComponent(accountId)}/products/${encodeURIComponent(productId)}`, {
    settlements: { account_number: accountNumber, ifsc_code: ifsc, beneficiary_name: beneficiaryName },
    tnc_accepted: true,
  });

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
