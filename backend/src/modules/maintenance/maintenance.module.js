import { Router } from "express";
import { z } from "zod";
import * as svc from "./maintenance.service.js";
import { ok } from "../../utils/respond.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { authenticate } from "../../middleware/authenticate.js";
import { validate } from "../../middleware/validate.js";
import { actorName } from "../../utils/sideEffects.js";

const STATUS = ["open", "assigned", "in_progress", "on_hold", "completed"];
const PRIORITY = ["low", "medium", "high", "urgent"];
const CATEGORY = ["electrical", "plumbing", "carpentry", "painting", "appliance", "civil", "pest_control"];
const cost = z.coerce.number().int("Use whole rupees").min(0, "Cost cannot be negative");

const createSchema = z.object({
  title: z.string().trim().min(3, "Title must be at least 3 characters").max(120),
  description: z.string().trim().max(2000).default(""),
  category: z.enum(CATEGORY),
  location: z.string().trim().min(1, "Where is the problem?").max(120),
  priority: z.enum(PRIORITY),
  assigneeStaffId: z.string().optional(),
  vendor: z.string().max(120).optional(),
  estimatedCost: cost.default(0),
  propertyId: z.string().optional(),
});
const updateSchema = z.object({
  status: z.enum(STATUS).optional(),
  priority: z.enum(PRIORITY).optional(),
  assigneeStaffId: z.string().nullable().optional(),
  vendor: z.string().max(120).optional(),
  estimatedCost: cost.optional(),
  actualCost: cost.optional(),
});
const listSchema = z.object({ status: z.enum(STATUS).optional(), priority: z.enum(PRIORITY).optional(), propertyId: z.string().optional() });

const routes = Router();
routes.use(authenticate);
routes.get("/", validate(listSchema, "query"), asyncHandler(async (req, res) => ok(res, await svc.list(req.auth, req.query))));
routes.post("/", validate(createSchema), asyncHandler(async (req, res) => ok(res, await svc.create(req.auth, await actorName(req.auth), req.body), 201)));
routes.patch("/:id", validate(updateSchema), asyncHandler(async (req, res) => ok(res, await svc.update(req.auth, await actorName(req.auth), req.params.id, req.body))));

export const path = "/maintenance";
export { routes };
