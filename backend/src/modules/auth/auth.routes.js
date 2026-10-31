import { Router } from "express";
import * as c from "./auth.controller.js";
import { validate } from "../../middleware/validate.js";
import { authenticate } from "../../middleware/authenticate.js";
import { authLimiter } from "../../middleware/rateLimit.js";
import {
  loginSchema, refreshSchema, forgotSchema, resetSchema, acceptInviteSchema, updateProfileSchema, changePasswordSchema,
} from "./auth.validation.js";

const r = Router();
r.post("/login", authLimiter, validate(loginSchema), c.login);
r.post("/refresh", authLimiter, validate(refreshSchema), c.refresh);
r.post("/logout", c.logout);
r.post("/logout-all", authenticate, c.logoutAll);
r.get("/session", authenticate, c.session);
r.post("/forgot-password", authLimiter, validate(forgotSchema), c.forgot);
r.post("/reset-password", authLimiter, validate(resetSchema), c.reset);
r.post("/change-password", authLimiter, authenticate, validate(changePasswordSchema), c.changePassword);
r.get("/invitations/:token", authLimiter, c.getInvitation);
r.post("/invitations/accept", authLimiter, validate(acceptInviteSchema), c.acceptInvitation);
r.patch("/profile", authenticate, validate(updateProfileSchema), c.updateProfile);
export default r;
