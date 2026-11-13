import { Router } from "express";
import { ok } from "../../utils/respond.js";
import { env } from "../../config/env.js";
import { pushEnabled } from "../../services/push.js";

// Public, unauthenticated: the mobile app reads this before sign-in to decide
// whether it must update, and which optional integrations to offer.
const r = Router();
r.get("/config", (_req, res) => ok(res, {
  minVersion: env.mobile.minVersion,
  latestVersion: env.mobile.latestVersion,
  pushEnabled: pushEnabled(),
  onlinePayments: env.payments.mode !== "disabled",
}));

export const path = "/app";
export const routes = r;
