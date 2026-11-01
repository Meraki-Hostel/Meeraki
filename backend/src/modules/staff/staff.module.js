import { Router } from "express";
import { z } from "zod";
import * as svc from "./staff.service.js";
import { ok } from "../../utils/respond.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { authenticate } from "../../middleware/authenticate.js";
import { validate } from "../../middleware/validate.js";
import { actorName } from "../../utils/sideEffects.js";

const ROLES = ["manager", "warden", "accountant", "housekeeping", "security", "cook", "maintenance"];
const STATUSES = ["active", "invited", "on_leave", "inactive"];
const base = {
  name: z.string(), role: z.enum(ROLES), propertyId: z.string().nullish(), phone: z.string(),
  email: z.string().default(""), shift: z.enum(["general", "morning", "evening", "night"]).default("general"),
};
const createSchema = z.object({ ...base, status: z.enum(["active", "on_leave"]).optional(), sendInvite: z.boolean().default(false) });
const updateSchema = z.object({
  name: z.string(), role: z.enum(ROLES), propertyId: z.string().nullable(), phone: z.string(), email: z.string(),
  shift: z.enum(["general", "morning", "evening", "night"]),
}).partial();
const listSchema = z.object({ propertyId: z.string().optional(), role: z.enum(ROLES).optional(), status: z.enum(STATUSES).optional() });

export const routes = Router();
routes.use(authenticate);
routes.get("/", validate(listSchema, "query"), asyncHandler(async (req, res) => ok(res, await svc.list(req.auth, req.query))));
routes.post("/", validate(createSchema), asyncHandler(async (req, res) => ok(res, await svc.create(req.auth, await actorName(req.auth), req.body), 201)));
routes.patch("/:id", validate(updateSchema), asyncHandler(async (req, res) => ok(res, await svc.update(req.auth, await actorName(req.auth), req.params.id, req.body))));
routes.patch("/:id/status", validate(z.object({ status: z.enum(STATUSES) })), asyncHandler(async (req, res) => ok(res, await svc.setStatus(req.auth, await actorName(req.auth), req.params.id, req.body.status))));
export const path = "/staff";
