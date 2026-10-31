import { z } from "zod";
import { iso } from "../../utils/money.js";

// A real calendar date in YYYY-MM-DD (rejects 2026-02-31). The refine also runs
// when the regex fails, so it must not throw on garbage like "tomorrow".
const isRealDate = (s) => {
  const d = new Date(`${s}T00:00:00.000Z`);
  return !Number.isNaN(d.getTime()) && iso(d) === s;
};
const isoDate = (message) => z.string().regex(/^\d{4}-\d{2}-\d{2}$/, message).refine(isRealDate, message);

// Field rules only. Rules that need "today" or other requests live in the service.
export const createSchema = z.object({
  from: isoDate("Choose a departure date"),
  to: isoDate("Choose a return date"),
  destination: z.string().trim().min(2, "Destination is required").max(120, "Keep the destination under 120 characters"),
  contactPhone: z.string(),
  reason: z.string().trim().min(5, "Add a short reason (min 5 characters)").max(500, "Keep the reason under 500 characters"),
});

export const decideSchema = z.object({
  decision: z.enum(["approved", "rejected"]),
  reason: z.string().trim().max(500, "Keep the reason under 500 characters").optional(),
});

export const listSchema = z.object({
  status: z.enum(["pending", "approved", "rejected", "cancelled"]).optional(),
  propertyId: z.string().optional(),
});
