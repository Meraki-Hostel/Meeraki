import { Router } from "express";
import { z } from "zod";
import * as svc from "./analytics.service.js";
import { ok } from "../../utils/respond.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { authenticate } from "../../middleware/authenticate.js";
import { validate } from "../../middleware/validate.js";

const period = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Use the format YYYY-MM");
const r = Router();
r.use(authenticate);
r.get("/owner-overview", validate(z.object({ period: period.optional() }), "query"), asyncHandler(async (req, res) => ok(res, await svc.ownerOverview(req.auth, req.query.period))));
r.get("/trends", validate(z.object({ propertyId: z.string().optional(), months: z.coerce.number().int().default(6) }), "query"), asyncHandler(async (req, res) => ok(res, await svc.trends(req.auth, req.query))));
r.get("/property-comparison", asyncHandler(async (req, res) => ok(res, await svc.propertyComparison(req.auth))));
r.get("/manager-overview", asyncHandler(async (req, res) => ok(res, await svc.managerOverview(req.auth))));
export default r;
