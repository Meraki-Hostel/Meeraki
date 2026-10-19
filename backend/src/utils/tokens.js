import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import { env } from "../config/env.js";

// Access token carries the acting identity + scope (mirrors the frontend Ctx).
export function signAccessToken({ userId, role, propertyId, studentId }) {
  return jwt.sign({ sub: userId, role, propertyId, studentId }, env.jwt.accessSecret, {
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
