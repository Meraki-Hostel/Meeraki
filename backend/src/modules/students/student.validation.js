import { z } from "zod";
export const createSchema = z.object({
  name: z.string().min(2), email: z.string().email(), phone: z.string(),
  gender: z.enum(["male", "female", "other"]), dob: z.string(), studentCode: z.string().trim().min(1).optional(), // omitted → generated server-side
  college: z.string(), course: z.string(), year: z.coerce.number().int(),
  address: z.string().default(""), bloodGroup: z.string().default(""),
  guardianName: z.string().default(""), guardianRelation: z.string().default(""), guardianPhone: z.string().default(""),
  emergencyName: z.string().default(""), emergencyPhone: z.string().default(""),
  joinedOn: z.string(), monthlyRent: z.coerce.number().int().min(0),
  bedId: z.string().optional(), propertyId: z.string().optional(),
  // Admission extras: an invitation to create a sign-in, and a refundable deposit.
  sendInvite: z.boolean().optional(),
  deposit: z.coerce.number().int("Deposit must be in whole rupees").min(0).optional(),
});
export const updateSchema = createSchema.omit({ sendInvite: true, deposit: true }).partial();
export const listSchema = z.object({
  search: z.string().optional(),
  status: z.enum(["active", "notice", "pending", "moved_out"]).optional(),
  propertyId: z.string().optional(),
});
export const statusSchema = z.object({
  status: z.enum(["active", "notice", "pending", "moved_out"]),
  // Owner only: confirm a move-out although dues are unpaid.
  force: z.boolean().optional(),
});
export const selfSchema = z.object({
  email: z.string().email().optional(), phone: z.string().optional(), address: z.string().optional(),
  emergencyName: z.string().optional(), emergencyPhone: z.string().optional(), bloodGroup: z.string().optional(),
});
