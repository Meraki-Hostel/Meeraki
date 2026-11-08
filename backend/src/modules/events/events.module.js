import { Router } from "express";
import { z } from "zod";
import * as svc from "./events.service.js";
import { ok } from "../../utils/respond.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { authenticate } from "../../middleware/authenticate.js";
import { validate } from "../../middleware/validate.js";
import { actorName } from "../../utils/sideEffects.js";

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM (24-hour)");
const input = z.object({
  propertyId: z.string().optional(),
  title: z.string().trim().min(3, "Title must be at least 3 characters").max(140),
  description: z.string().max(3000).default(""),
  category: z.enum(["cultural", "sports", "workshop", "festival", "meeting", "health"]),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use the format YYYY-MM-DD"),
  startTime: time,
  endTime: time,
  location: z.string().trim().min(1, "Where is it?").max(140),
  capacity: z.coerce.number().int().min(0, "Capacity cannot be negative"),
  expectedAttendance: z.coerce.number().int().min(0, "Attendance cannot be negative").default(0),
});
const listSchema = z.object({ propertyId: z.string().optional(), status: z.enum(["scheduled", "completed", "cancelled"]).optional() });

const routes = Router();
routes.use(authenticate);
routes.get("/", validate(listSchema, "query"), asyncHandler(async (req, res) => ok(res, await svc.list(req.auth, req.query))));
routes.post("/", validate(input), asyncHandler(async (req, res) => ok(res, await svc.create(req.auth, await actorName(req.auth), req.body), 201)));
routes.patch("/:id/status", validate(z.object({ status: z.enum(["scheduled", "completed", "cancelled"]) })), asyncHandler(async (req, res) => ok(res, await svc.setStatus(req.auth, await actorName(req.auth), req.params.id, req.body.status))));
routes.patch("/:id", validate(input.partial()), asyncHandler(async (req, res) => ok(res, await svc.update(req.auth, req.params.id, req.body))));

export const path = "/events";
export { routes };
