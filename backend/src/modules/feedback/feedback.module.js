import { Router } from "express";
import { z } from "zod";
import * as svc from "./feedback.service.js";
import { ok } from "../../utils/respond.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { authenticate } from "../../middleware/authenticate.js";
import { validate } from "../../middleware/validate.js";

const CATEGORY = ["food", "cleanliness", "staff", "facilities", "security", "internet", "other"];
const submitSchema = z.object({
  category: z.enum(CATEGORY),
  rating: z.coerce.number(),
  comment: z.string().max(2000).default(""),
  anonymous: z.boolean().default(false),
});

const routes = Router();
routes.use(authenticate);
routes.get("/mine", asyncHandler(async (req, res) => ok(res, await svc.mine(req.auth))));
routes.get("/summary", validate(z.object({ propertyId: z.string().optional() }), "query"), asyncHandler(async (req, res) => ok(res, await svc.summary(req.auth, req.query))));
routes.get("/", validate(z.object({ category: z.enum(CATEGORY).optional(), propertyId: z.string().optional() }), "query"), asyncHandler(async (req, res) => ok(res, await svc.list(req.auth, req.query))));
routes.post("/", validate(submitSchema), asyncHandler(async (req, res) => ok(res, await svc.submit(req.auth, req.body), 201)));

export const path = "/feedback";
export { routes };
