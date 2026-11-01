import rateLimit from "express-rate-limit";
import { verifyAccessToken } from "../utils/tokens.js";

// Answer in the API's error envelope, so the app shows a clear message instead
// of treating the refusal as "server unreachable".
const tooMany = (message) => (req, res) =>
  res.status(429).json({ data: null, error: { code: "CONFLICT", message, requestId: req.id }, meta: { requestId: req.id } });

// Signed-in traffic is limited per user, not per IP address: every resident and
// staff member on a hostel's Wi-Fi shares one public IP, and one busy evening
// must not lock them all out. Anonymous traffic is limited per IP.
function userOrIp(req) {
  const [scheme, token] = (req.headers.authorization || "").split(" ");
  if (scheme === "Bearer" && token) {
    try { return `user:${verifyAccessToken(token).sub}`; } catch { /* invalid token: fall back to IP */ }
  }
  return `ip:${req.ip}`;
}

const FIFTEEN_MIN = 15 * 60 * 1000;

// Password reset, invitation links, change password: per IP (guessing protection).
export const authLimiter = rateLimit({
  windowMs: FIFTEEN_MIN, max: 60, standardHeaders: true, legacyHeaders: false,
  handler: tooMany("Too many attempts. Try again in a few minutes."),
});

// Sign-in: 10 tries per account from one address stops password guessing without
// blocking everyone else on a shared hostel connection; a broad per-IP cap limits
// spraying many accounts.
const loginPerAccount = rateLimit({
  windowMs: FIFTEEN_MIN, max: 10, standardHeaders: true, legacyHeaders: false,
  keyGenerator: (req) => `${req.ip}|${String(req.body?.identifier ?? "").trim().toLowerCase()}`,
  handler: tooMany("Too many sign-in attempts for this account. Try again in 15 minutes."),
});
const loginPerIp = rateLimit({
  windowMs: FIFTEEN_MIN, max: 300, standardHeaders: false, legacyHeaders: false,
  handler: tooMany("Too many sign-in attempts from this network. Try again in a few minutes."),
});
export const loginLimiter = [loginPerIp, loginPerAccount];

// Refresh tokens are 384-bit secrets (nothing to guess), and every signed-in
// person refreshes every 15 minutes, so a whole hostel shares this budget.
export const refreshLimiter = rateLimit({
  windowMs: FIFTEEN_MIN, max: 3000, standardHeaders: true, legacyHeaders: false,
  handler: tooMany("Too many requests. Wait a moment and try again."),
});

export const globalLimiter = rateLimit({
  windowMs: 60 * 1000, standardHeaders: true, legacyHeaders: false,
  keyGenerator: userOrIp,
  // One page of the app makes 10–15 requests; this allows brisk use with headroom.
  max: (req) => (userOrIp(req).startsWith("user:") ? 1200 : 300),
  handler: tooMany("Too many requests. Wait a moment and try again."),
});
