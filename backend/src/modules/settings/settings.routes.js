import { Router } from "express";
import { z } from "zod";
import * as svc from "./settings.service.js";
import { ok } from "../../utils/respond.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { authenticate } from "../../middleware/authenticate.js";
import { validate } from "../../middleware/validate.js";
import { actorName } from "../../utils/sideEffects.js";

const updateSchema = z.object({
  orgName: z.string(), legalName: z.string(), contactEmail: z.string(), contactPhone: z.string(),
  address: z.string(), gstin: z.string(), website: z.string(),
  rentDueDay: z.coerce.number().int(), lateFeeFlat: z.coerce.number().int(), lateFeeGraceDays: z.coerce.number().int(),
  prorateFirstMonth: z.boolean(),
  notifications: z.object({
    paymentReceived: z.boolean(), newComplaint: z.boolean(), leaveRequests: z.boolean(), lowStock: z.boolean(), weeklySummary: z.boolean(),
  }).partial(),
  security: z.object({ twoFactor: z.boolean(), sessionTimeoutMins: z.coerce.number().int().min(5).max(1440) }).partial(),
}).partial();

const r = Router();
r.use(authenticate);
r.get("/", asyncHandler(async (req, res) => ok(res, await svc.get(req.auth))));
r.patch("/", validate(updateSchema), asyncHandler(async (req, res) => ok(res, await svc.update(req.auth, await actorName(req.auth), req.body))));
r.get("/plan", asyncHandler(async (req, res) => ok(res, await svc.planUsage(req.auth))));
r.post("/plan", validate(z.object({ planId: z.string().min(1) })), asyncHandler(async (req, res) => ok(res, await svc.changePlan(req.auth, await actorName(req.auth), req.body.planId))));
export default r;
