import { Router } from "express";
import { z } from "zod";
import * as svc from "./announcements.service.js";
import { ok } from "../../utils/respond.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { authenticate } from "../../middleware/authenticate.js";
import { validate } from "../../middleware/validate.js";
import { actorName } from "../../utils/sideEffects.js";

const input = z.object({
  title: z.string().trim().min(3, "Title must be at least 3 characters").max(140),
  body: z.string().trim().min(3, "Write the notice").max(5000),
  category: z.enum(["general", "maintenance", "mess", "event", "urgent"]),
  audience: z.object({ type: z.enum(["all", "floors", "rooms"]), values: z.array(z.coerce.string()).max(200).default([]) }),
});
const createSchema = input.extend({ publish: z.boolean().default(false), propertyId: z.string().optional() });
const listSchema = z.object({ status: z.enum(["draft", "published", "archived"]).optional(), propertyId: z.string().optional() });

const routes = Router();
routes.use(authenticate);
routes.get("/", validate(listSchema, "query"), asyncHandler(async (req, res) => ok(res, await svc.list(req.auth, req.query))));
routes.post("/read-all", asyncHandler(async (req, res) => { await svc.markAllRead(req.auth); ok(res, { ok: true }); }));
routes.post("/", validate(createSchema), asyncHandler(async (req, res) => ok(res, await svc.create(req.auth, await actorName(req.auth), req.body), 201)));
routes.patch("/:id", validate(input), asyncHandler(async (req, res) => ok(res, await svc.update(req.auth, req.params.id, req.body))));
routes.post("/:id/publish", asyncHandler(async (req, res) => ok(res, await svc.publish(req.auth, await actorName(req.auth), req.params.id))));
routes.post("/:id/archive", asyncHandler(async (req, res) => ok(res, await svc.archive(req.auth, await actorName(req.auth), req.params.id))));
routes.post("/:id/read", validate(z.object({ read: z.boolean().default(true) })), asyncHandler(async (req, res) => { await svc.markRead(req.auth, req.params.id, req.body.read); ok(res, { ok: true }); }));

export const path = "/announcements";
export { routes };
