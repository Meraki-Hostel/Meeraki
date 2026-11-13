import { Router } from "express";
import { z } from "zod";
import * as svc from "./payout.service.js";
import { ok } from "../../utils/respond.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { authenticate } from "../../middleware/authenticate.js";
import { validate } from "../../middleware/validate.js";
import { actorName } from "../../utils/sideEffects.js";

const BUSINESS_TYPES = ["individual", "proprietorship", "partnership", "llp", "private_limited", "public_limited", "trust", "society", "ngo"];
const text = (min, max, what) => z.string({ required_error: `${what} is required` }).trim().min(min, `${what} is required`).max(max, `${what} is too long`);
const upper = (re, msg) => z.string().trim().toUpperCase().regex(re, msg);

const PAN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const GSTIN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const IFSC = /^[A-Z]{4}0[A-Z0-9]{6}$/;

// What the owner types. The account number and PAN go straight to the payment
// provider; only the last four digits of the account number are kept.
const detailsSchema = z.object({
  label: text(1, 60, "A name for this account"),
  businessType: z.enum(BUSINESS_TYPES),
  legalName: text(4, 200, "Legal name"),
  contactName: text(2, 100, "Contact name"),
  email: z.string().trim().email("Enter a valid email"),
  phone: z.string().trim().transform((v) => v.replace(/\D/g, "").slice(-10)).refine((v) => /^[6-9]\d{9}$/.test(v), "Enter a 10-digit mobile number"),
  pan: upper(PAN, "Enter a valid PAN, like ABCDE1234F"),
  gstin: z.string().trim().toUpperCase().refine((v) => v === "" || GSTIN.test(v), "Enter a valid GSTIN").default(""),
  address: z.object({
    street: text(10, 255, "Street address"),
    city: text(2, 32, "City"),
    state: text(2, 32, "State"),
    pincode: z.string().trim().regex(/^\d{6}$/, "Enter a 6-digit pincode"),
  }),
  bank: z.object({
    holderName: text(2, 100, "Account holder name"),
    accountNumber: z.string().trim().regex(/^\d{5,20}$/, "Enter the account number (digits only)"),
    ifsc: upper(IFSC, "Enter a valid IFSC, like HDFC0001234"),
  }),
  acceptTerms: z.literal(true, { errorMap: () => ({ message: "Accept the payment provider's terms to continue" }) }),
}).superRefine((v, ctx) => {
  // Individuals are identified by their own PAN (4th letter P); companies, firms and
  // trusts need their business PAN and a GSTIN.
  if (v.businessType === "individual" && v.pan[3] !== "P") {
    ctx.addIssue({ code: "custom", path: ["pan"], message: "For an individual, enter your personal PAN" });
  }
  if (!["individual", "proprietorship"].includes(v.businessType) && !v.gstin) {
    ctx.addIssue({ code: "custom", path: ["gstin"], message: "GSTIN is required for this business type" });
  }
});

const labelSchema = z.object({ label: text(1, 60, "A name for this account") });
const assignSchema = z.object({ payoutAccountId: z.string().min(1).nullable() });

export const routes = Router();
routes.use(authenticate);
routes.get("/", asyncHandler(async (req, res) => ok(res, await svc.list(req.auth))));
routes.post("/", validate(detailsSchema), asyncHandler(async (req, res) => ok(res, await svc.create(req.auth, await actorName(req.auth), req.body), 201)));
routes.post("/:id/resubmit", validate(detailsSchema), asyncHandler(async (req, res) => ok(res, await svc.resubmit(req.auth, await actorName(req.auth), req.params.id, req.body))));
routes.patch("/:id", validate(labelSchema), asyncHandler(async (req, res) => ok(res, await svc.rename(req.auth, req.params.id, req.body.label))));
routes.delete("/:id", asyncHandler(async (req, res) => ok(res, await svc.remove(req.auth, await actorName(req.auth), req.params.id))));
routes.put("/properties/:propertyId", validate(assignSchema), asyncHandler(async (req, res) => ok(res, await svc.assign(req.auth, await actorName(req.auth), req.params.propertyId, req.body.payoutAccountId))));
export const path = "/payout-accounts";
