import { Router } from "express";
import { z } from "zod";
import * as svc from "./emergency.service.js";
import { ok } from "../../utils/respond.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { authenticate } from "../../middleware/authenticate.js";
import { validate } from "../../middleware/validate.js";
import { actorName } from "../../utils/sideEffects.js";

const raiseSchema = z.object({
  type: z.enum(["medical", "fire", "security", "other"]),
  message: z.string().trim().min(1, "Describe what is happening").max(500),
  location: z.string().max(120).optional(),
});
const listSchema = z.object({ status: z.enum(["open", "acknowledged", "resolved"]).optional(), propertyId: z.string().optional() });

const r = Router();
r.use(authenticate);
r.get("/", validate(listSchema, "query"), asyncHandler(async (req, res) => ok(res, await svc.list(req.auth, req.query))));
r.post("/", validate(raiseSchema), asyncHandler(async (req, res) => ok(res, await svc.raise(req.auth, await actorName(req.auth), req.body), 201)));
r.post("/:id/acknowledge", asyncHandler(async (req, res) => ok(res, await svc.acknowledge(req.auth, await actorName(req.auth), req.params.id))));
r.post("/:id/resolve", validate(z.object({ note: z.string().max(500).optional() })),
  asyncHandler(async (req, res) => ok(res, await svc.resolve(req.auth, await actorName(req.auth), req.params.id, req.body.note))));

export const path = "/emergency";
export const routes = r;
