import { Router } from "express";
import { z } from "zod";
import * as svc from "./inventory.service.js";
import { ok } from "../../utils/respond.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { authenticate } from "../../middleware/authenticate.js";
import { validate } from "../../middleware/validate.js";
import { actorName } from "../../utils/sideEffects.js";

const CATEGORY = ["linen", "furniture", "kitchen", "cleaning", "electrical", "stationery", "safety"];
const whole = (msg) => z.coerce.number().int("Use a whole number").min(0, msg);

const createSchema = z.object({
  propertyId: z.string().optional(),
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(120),
  sku: z.string().trim().min(1, "SKU is required").max(40),
  category: z.enum(CATEGORY),
  unit: z.string().trim().min(1, "Unit is required").max(20),
  quantity: whole("Quantity cannot be negative"),
  reorderLevel: whole("Reorder level cannot be negative"),
  unitCost: whole("Unit cost cannot be negative"),
});
const adjustSchema = z.object({
  itemId: z.string().min(1),
  type: z.enum(["in", "out"]),
  quantity: z.coerce.number(),
  note: z.string().max(300).default(""),
});
const listSchema = z.object({
  propertyId: z.string().optional(),
  category: z.enum(CATEGORY).optional(),
  lowStockOnly: z.preprocess((v) => v === true || v === "true", z.boolean()).optional(),
});
const txnSchema = z.object({ itemId: z.string().optional(), propertyId: z.string().optional() });

const routes = Router();
routes.use(authenticate);
routes.get("/transactions", validate(txnSchema, "query"), asyncHandler(async (req, res) => ok(res, await svc.transactions(req.auth, req.query))));
routes.post("/adjust", validate(adjustSchema), asyncHandler(async (req, res) => ok(res, await svc.adjust(req.auth, await actorName(req.auth), req.body))));
routes.get("/", validate(listSchema, "query"), asyncHandler(async (req, res) => ok(res, await svc.list(req.auth, req.query))));
routes.post("/", validate(createSchema), asyncHandler(async (req, res) => ok(res, await svc.create(req.auth, await actorName(req.auth), req.body), 201)));

export const path = "/inventory";
export { routes };
