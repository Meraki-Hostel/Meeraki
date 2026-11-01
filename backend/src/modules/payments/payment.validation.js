import { z } from "zod";
import { isCalendarDate } from "../../utils/validators.js";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use the format YYYY-MM-DD").refine(isCalendarDate, "That date doesn't exist");

export const recordPaymentSchema = z.object({
  chargeId: z.string().min(1),
  amount: z.coerce.number(),
  method: z.enum(["upi", "cash", "bank_transfer", "card"]),
  paidOn: z.string().min(1),
  reference: z.string().default(""),
  note: z.string().optional(),
});

export const payNowSchema = z.object({
  chargeId: z.string().min(1),
  method: z.enum(["upi", "card", "netbanking"]),
});

export const verifySchema = z.object({
  orderId: z.string().min(1),
  paymentId: z.string().min(1),
  signature: z.string().min(1),
});

export const remindersSchema = z.object({
  chargeIds: z.array(z.string()).default([]),
});

export const chargeFiltersSchema = z.object({
  studentId: z.string().optional(),
  propertyId: z.string().optional(),
  period: z.string().optional(),
  status: z.enum(["paid", "partial", "pending", "overdue"]).optional(),
  kind: z.enum(["rent", "deposit", "late_fee", "other"]).optional(),
});

export const paymentFiltersSchema = z.object({
  studentId: z.string().optional(),
  propertyId: z.string().optional(),
  method: z.enum(["upi", "cash", "bank_transfer", "card"]).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

export const generateSchema = z.object({
  period: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Use the format YYYY-MM").optional(),
  propertyId: z.string().optional(),
});

export const createChargeSchema = z.object({
  studentId: z.string().min(1),
  kind: z.enum(["deposit", "other"]),
  amount: z.coerce.number().int("Amount must be in whole rupees"),
  description: z.string().max(200).optional(),
  dueDate: isoDate.optional(),
});

export const adjustChargeSchema = z.object({
  amount: z.coerce.number().int("Amount must be in whole rupees").min(0).optional(),
  dueDate: isoDate.optional(),
  description: z.string().max(200).optional(),
  reason: z.string().min(1, "Give a reason for the change").max(300),
});

export const refundSchema = z.object({
  amount: z.coerce.number().int("Amount must be in whole rupees"),
  reason: z.string().min(1, "Give a reason for the refund").max(300),
  adjustCharge: z.boolean().optional().default(false),
});

export const refundFiltersSchema = z.object({
  propertyId: z.string().optional(),
  paymentId: z.string().optional(),
});
