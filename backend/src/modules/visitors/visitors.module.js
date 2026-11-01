import { Router } from "express";
import { z } from "zod";
import * as svc from "./visitor.service.js";
import { ok } from "../../utils/respond.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { authenticate } from "../../middleware/authenticate.js";
import { validate } from "../../middleware/validate.js";
import { actorName } from "../../utils/sideEffects.js";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use the format YYYY-MM-DD");
const visit = {
  visitorName: z.string().max(120), visitorPhone: z.string(), relation: z.string().max(60),
  visitDate: isoDate, visitTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use the format HH:MM"), purpose: z.string().max(500).default(""),
};
const createSchema = z.object(visit);
const walkInSchema = z.object({ ...visit, studentId: z.string().min(1) });
const decideSchema = z.object({ decision: z.enum(["approved", "rejected"]), reason: z.string().max(500).optional() });
const listSchema = z.object({
  status: z.enum(["pending", "approved", "rejected", "checked_in", "checked_out", "cancelled"]).optional(),
  date: isoDate.optional(), propertyId: z.string().optional(),
});

export const routes = Router();
routes.use(authenticate);
const act = (fn) => asyncHandler(async (req, res) => ok(res, await fn(req.auth, await actorName(req.auth), req.params.id, req.body)));
routes.get("/", validate(listSchema, "query"), asyncHandler(async (req, res) => ok(res, await svc.list(req.auth, req.query))));
routes.post("/", validate(createSchema), asyncHandler(async (req, res) => ok(res, await svc.create(req.auth, await actorName(req.auth), req.body), 201)));
routes.post("/walk-in", validate(walkInSchema), asyncHandler(async (req, res) => ok(res, await svc.createWalkIn(req.auth, await actorName(req.auth), req.body), 201)));
routes.post("/:id/decide", validate(decideSchema), act(svc.decide));
routes.post("/:id/check-in", act(svc.checkIn));
routes.post("/:id/check-out", act(svc.checkOut));
routes.post("/:id/cancel", act(svc.cancel));
export const path = "/visitors";
