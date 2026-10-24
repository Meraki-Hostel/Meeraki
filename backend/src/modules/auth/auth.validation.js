import { z } from "zod";

export const loginSchema = z.object({
  role: z.enum(["owner", "manager", "student"]),
  identifier: z.string().min(1, "Enter your email or phone number"),
  password: z.string().min(1, "Enter your password"),
  remember: z.boolean().optional().default(false),
});
export const refreshSchema = z.object({ refreshToken: z.string().min(1) });
export const forgotSchema = z.object({ identifier: z.string().min(1) });
export const resetSchema = z.object({ token: z.string().min(1), password: z.string() });
export const acceptInviteSchema = z.object({ token: z.string().min(1), password: z.string() });
export const updateProfileSchema = z.object({
  name: z.string().optional(),
  phone: z.string().optional(),
  preferences: z
    .object({ emailDigest: z.boolean(), smsAlerts: z.boolean(), compactTables: z.boolean() })
    .partial()
    .optional(),
});
