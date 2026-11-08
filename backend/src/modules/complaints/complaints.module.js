import { Router } from "express";
import { z } from "zod";
import * as svc from "./complaint.service.js";
import { ok } from "../../utils/respond.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { authenticate } from "../../middleware/authenticate.js";
import { validate } from "../../middleware/validate.js";
import { actorName } from "../../utils/sideEffects.js";

const STATUS = ["open", "in_progress", "resolved", "closed"];
const PRIORITY = ["low", "medium", "high", "urgent"];
const CATEGORY = ["electrical", "plumbing", "cleaning", "internet", "food", "furniture", "security", "other"];

const createSchema = z.object({
  category: z.enum(CATEGORY), title: z.string().max(120), description: z.string().max(4000),
  priority: z.enum(PRIORITY).default("medium"), attachments: z.array(z.string()).max(3, "Attach at most 3 files").default([]),
});
const updateSchema = z.object({
  status: z.enum(STATUS).optional(), priority: z.enum(PRIORITY).optional(),
  assigneeStaffId: z.string().nullable().optional(), note: z.string().max(1000).optional(),
});
const listSchema = z.object({
  status: z.enum(STATUS).optional(), priority: z.enum(PRIORITY).optional(), propertyId: z.string().optional(), category: z.enum(CATEGORY).optional(),
});
const commentSchema = z.object({ body: z.string().max(2000), internal: z.boolean().default(false) });

export const routes = Router();
routes.use(authenticate);
routes.get("/", validate(listSchema, "query"), asyncHandler(async (req, res) => ok(res, await svc.list(req.auth, req.query))));
routes.get("/:id", asyncHandler(async (req, res) => ok(res, await svc.get(req.auth, req.params.id))));
routes.post("/", validate(createSchema), asyncHandler(async (req, res) => ok(res, await svc.create(req.auth, await actorName(req.auth), req.body), 201)));
routes.patch("/:id", validate(updateSchema), asyncHandler(async (req, res) => ok(res, await svc.update(req.auth, await actorName(req.auth), req.params.id, req.body))));
routes.post("/:id/comments", validate(commentSchema), asyncHandler(async (req, res) => ok(res, await svc.addComment(req.auth, await actorName(req.auth), req.params.id, req.body))));
export const path = "/complaints";
