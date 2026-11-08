import { Router } from "express";
import { z } from "zod";
import * as svc from "./invitation.service.js";
import { ok } from "../../utils/respond.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { authenticate } from "../../middleware/authenticate.js";
import { validate } from "../../middleware/validate.js";
import { actorName } from "../../utils/sideEffects.js";

const createSchema = z.union([
  z.object({ studentId: z.string().min(1) }),
  z.object({ staffId: z.string().min(1) }),
  z.object({ role: z.literal("owner"), name: z.string().trim().min(2, "Enter the person's name"), email: z.string().email("Enter a valid email") }),
]);
const listSchema = z.object({ status: z.enum(["pending", "accepted", "expired"]).optional() });

const r = Router();
r.use(authenticate);
r.get("/", validate(listSchema, "query"), asyncHandler(async (req, res) => ok(res, await svc.list(req.auth, req.query))));
r.post("/", validate(createSchema), asyncHandler(async (req, res) => ok(res, await svc.create(req.auth, await actorName(req.auth), req.body), 201)));
r.post("/:id/resend", asyncHandler(async (req, res) => ok(res, await svc.resend(req.auth, await actorName(req.auth), req.params.id))));
r.post("/:id/revoke", asyncHandler(async (req, res) => ok(res, await svc.revoke(req.auth, req.params.id))));
export default r;
