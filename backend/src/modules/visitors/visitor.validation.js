import { z } from "zod";
import { iso } from "../../utils/money.js";

// A real calendar date in YYYY-MM-DD (rejects 2026-02-31). The refine also runs
// when the regex fails, so it must not throw on garbage like "today".
const isRealDate = (s) => {
  const d = new Date(`${s}T00:00:00.000Z`);
  return !Number.isNaN(d.getTime()) && iso(d) === s;
};
const isoDate = (message) => z.string().regex(/^\d{4}-\d{2}-\d{2}$/, message).refine(isRealDate, message);

// 24-hour HH:MM. Visiting hours are checked in the service.
const clock = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Choose a time");

// Field rules only. Rules that need "today" or other records live in the service.
const visitor = {
  visitorName: z.string().trim().min(3, "Enter the visitor’s full name").max(80, "Keep the name under 80 characters"),
  visitorPhone: z.string(),
  relation: z.string().trim().min(1, "Relation is required").max(40, "Keep the relation under 40 characters"),
  visitTime: clock,
  purpose: z.string().trim().max(200, "Keep the purpose under 200 characters").default(""),
};

export const createSchema = z.object({ ...visitor, visitDate: isoDate("Choose a visit date") });

// Walk-ins are always today; any visitDate the client sends is ignored.
export const walkInSchema = z.object({ ...visitor, studentId: z.string().min(1, "Choose a resident") });

export const decideSchema = z.object({
  decision: z.enum(["approved", "rejected"]),
  reason: z.string().trim().max(500, "Keep the reason under 500 characters").optional(),
});

export const listSchema = z.object({
  status: z.enum(["pending", "approved", "rejected", "checked_in", "checked_out", "cancelled"]).optional(),
  date: isoDate("Use YYYY-MM-DD").optional(),
  propertyId: z.string().optional(),
});
