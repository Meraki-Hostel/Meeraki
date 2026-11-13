import { z } from "zod";
export const createSchema = z.object({
  propertyId: z.string().optional(),
  number: z.string().min(1), floor: z.coerce.number().int(),
  type: z.enum(["single", "double", "triple", "quad"]),
  rent: z.coerce.number().int().min(0),
  ac: z.boolean().default(false), attachedBath: z.boolean().default(false),
  status: z.enum(["active", "maintenance"]).optional(),
});
export const updateSchema = createSchema.partial();
export const createBulkSchema = z.object({
  propertyId: z.string().optional(),
  rooms: z.array(createSchema.omit({ propertyId: true })).min(1).max(50),
});
export const listSchema = z.object({ propertyId: z.string().optional() });
export const bedStatusSchema = z.object({
  status: z.enum(["available", "unavailable"]), reason: z.string().optional(),
});
export const assignSchema = z.object({ studentId: z.string().min(1), bedId: z.string().min(1) });
export const vacateSchema = z.object({ studentId: z.string().min(1) });
