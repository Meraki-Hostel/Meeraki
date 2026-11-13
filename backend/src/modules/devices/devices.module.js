import { Router } from "express";
import { z } from "zod";
import * as svc from "./devices.service.js";
import { ok } from "../../utils/respond.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { authenticate } from "../../middleware/authenticate.js";
import { validate } from "../../middleware/validate.js";

// Phones registered for push notifications (mobile app). Every role may register
// its own phone; nobody can see or remove another user's devices.
const registerSchema = z.object({
  pushToken: z.string().trim().min(1, "Push token is required").max(255),
  platform: z.enum(["ios", "android"]),
  appVersion: z.string().trim().max(32).optional(),
});

const r = Router();
r.use(authenticate);
r.get("/", asyncHandler(async (req, res) => ok(res, await svc.list(req.auth))));
r.post("/", validate(registerSchema), asyncHandler(async (req, res) => ok(res, await svc.register(req.auth, req.body), 201)));
// The token is URL-encoded by the client: ExponentPushToken%5B...%5D
r.delete("/:pushToken", asyncHandler(async (req, res) => ok(res, await svc.unregister(req.auth, req.params.pushToken))));

export const path = "/devices";
export const routes = r;
