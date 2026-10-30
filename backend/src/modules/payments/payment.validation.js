import { z } from "zod";

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

export const remindersSchema = z.object({
  chargeIds: z.array(z.string()).default([]),
});

export const chargeFiltersSchema = z.object({
  studentId: z.string().optional(),
  propertyId: z.string().optional(),
  period: z.string().optional(),
  status: z.enum(["paid", "partial", "pending", "overdue"]).optional(),
});

export const paymentFiltersSchema = z.object({
  studentId: z.string().optional(),
  propertyId: z.string().optional(),
  method: z.enum(["upi", "cash", "bank_transfer", "card"]).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});
