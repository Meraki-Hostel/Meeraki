import { Router } from "express";
import * as c from "./auth.controller.js";
import { validate } from "../../middleware/validate.js";
import { authenticate } from "../../middleware/authenticate.js";
import { authLimiter } from "../../middleware/rateLimit.js";
import {
  loginSchema, loginAsSchema, refreshSchema, forgotSchema, resetSchema, acceptInviteSchema, updateProfileSchema,
} from "./auth.validation.js";

const r = Router();
r.get("/personas", c.personas);
r.post("/login", authLimiter, validate(loginSchema), c.login);
r.post("/login-as", authLimiter, validate(loginAsSchema), c.loginAs);
r.post("/refresh", authLimiter, validate(refreshSchema), c.refresh);
r.post("/logout", c.logout);
r.get("/session", authenticate, c.session);
r.post("/forgot-password", authLimiter, validate(forgotSchema), c.forgot);
r.post("/reset-password", authLimiter, validate(resetSchema), c.reset);
r.get("/invitations/:token", c.getInvitation);
r.post("/invitations/accept", validate(acceptInviteSchema), c.acceptInvitation);
r.patch("/profile", authenticate, validate(updateProfileSchema), c.updateProfile);
export default r;
