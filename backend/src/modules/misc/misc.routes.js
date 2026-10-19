import { Router } from "express";
import * as svc from "./misc.service.js";
import { ok } from "../../utils/respond.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { authenticate } from "../../middleware/authenticate.js";

const r = Router();
r.use(authenticate);
r.get("/notifications", asyncHandler(async (req, res) => ok(res, await svc.listNotifications(req.auth, req.query))));
r.patch("/notifications/read-all", asyncHandler(async (req, res) => { await svc.markAllNotificationsRead(req.auth); ok(res, { ok: true }); }));
r.patch("/notifications/:id", asyncHandler(async (req, res) => { await svc.markNotificationRead(req.auth, req.params.id, req.body.read !== false); ok(res, { ok: true }); }));
r.get("/activity", asyncHandler(async (req, res) => ok(res, await svc.listActivity(req.auth, req.query))));
export default r;
