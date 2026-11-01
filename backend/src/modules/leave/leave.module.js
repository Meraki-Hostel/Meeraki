import { Router } from "express";
import { z } from "zod";
import * as svc from "./leave.service.js";
import { ok } from "../../utils/respond.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { authenticate } from "../../middleware/authenticate.js";
import { validate } from "../../middleware/validate.js";
import { actorName } from "../../utils/sideEffects.js";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use the format YYYY-MM-DD");
const createSchema = z.object({
  from: isoDate, to: isoDate, destination: z.string().max(200), contactPhone: z.string(), reason: z.string().max(1000),
});
const decideSchema = z.object({ decision: z.enum(["approved", "rejected"]), reason: z.string().max(500).optional() });
const listSchema = z.object({ status: z.enum(["pending", "approved", "rejected", "cancelled"]).optional(), propertyId: z.string().optional() });

export const routes = Router();
routes.use(authenticate);
routes.get("/", validate(listSchema, "query"), asyncHandler(async (req, res) => ok(res, await svc.list(req.auth, req.query))));
routes.post("/", validate(createSchema), asyncHandler(async (req, res) => ok(res, await svc.create(req.auth, await actorName(req.auth), req.body), 201)));
routes.post("/:id/decide", validate(decideSchema), asyncHandler(async (req, res) => ok(res, await svc.decide(req.auth, await actorName(req.auth), req.params.id, req.body))));
routes.post("/:id/cancel", asyncHandler(async (req, res) => ok(res, await svc.cancel(req.auth, await actorName(req.auth), req.params.id))));
export const path = "/leave";
