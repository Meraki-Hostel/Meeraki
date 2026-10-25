import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import { env } from "../config/env.js";

// The access token identifies the user (sub) and the role they signed in with.
// Property / student scope is deliberately NOT in the token: `authenticate`
// reads it from the database on every request, so a reassigned or demoted user
// loses access immediately instead of when the token expires.
export function signAccessToken({ userId, role }) {
  return jwt.sign({ sub: userId, role }, env.jwt.accessSecret, {
    expiresIn: env.jwt.accessTtl,
  });
}
export const verifyAccessToken = (t) => jwt.verify(t, env.jwt.accessSecret);

export function generateRefreshToken() {
  const raw = crypto.randomBytes(48).toString("hex");
  const hash = hashToken(raw);
  const expiresAt = new Date(Date.now() + env.jwt.refreshTtlDays * 864e5);
  return { raw, hash, expiresAt };
}
export const hashToken = (raw) => crypto.createHash("sha256").update(raw).digest("hex");
