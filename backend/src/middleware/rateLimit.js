import rateLimit from "express-rate-limit";
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false,
  message: { data: null, error: { code: "CONFLICT", message: "Too many attempts. Try again later." } },
});
export const globalLimiter = rateLimit({ windowMs: 60 * 1000, max: 300, standardHeaders: true, legacyHeaders: false });
