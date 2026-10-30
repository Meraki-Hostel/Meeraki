import { z } from "zod";
export const createSchema = z.object({
  name: z.string().min(2), code: z.string().min(1),
  type: z.enum(["boys", "girls", "coed"]),
  status: z.enum(["active", "onboarding", "inactive"]).optional(),
  locality: z.string(), city: z.string(), address: z.string(),
  pincode: z.string().regex(/^\d{6}$/, "Invalid pincode"), phone: z.string(),
  baseRent: z.coerce.number().int().min(0),
  amenities: z.array(z.string()).default([]),
  managerStaffId: z.string().optional(),
});
export const updateSchema = createSchema.partial();
export const listSchema = z.object({
  search: z.string().optional(),
  status: z.enum(["active", "onboarding", "inactive"]).optional(),
  type: z.enum(["boys", "girls", "coed"]).optional(),
});
export const statusSchema = z.object({ status: z.enum(["active", "onboarding", "inactive"]) });
