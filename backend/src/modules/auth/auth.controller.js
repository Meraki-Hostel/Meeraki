import * as svc from "./auth.service.js";
import { ok } from "../../utils/respond.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

export const personas = asyncHandler(async (_req, res) => ok(res, await svc.listPersonas()));
export const login = asyncHandler(async (req, res) => ok(res, await svc.loginWithPassword(req.body)));
export const loginAs = asyncHandler(async (req, res) => ok(res, await svc.loginAsPersona(req.body.userId)));
export const refresh = asyncHandler(async (req, res) => ok(res, await svc.refresh(req.body.refreshToken)));
export const logout = asyncHandler(async (req, res) => { await svc.logout(req.body?.refreshToken); ok(res, { ok: true }); });
export const session = asyncHandler(async (req, res) => ok(res, await svc.getSession(req.auth)));
export const forgot = asyncHandler(async (req, res) => ok(res, await svc.requestPasswordReset(req.body.identifier)));
export const reset = asyncHandler(async (req, res) => { await svc.resetPassword(req.body.token, req.body.password); ok(res, { ok: true }); });
export const getInvitation = asyncHandler(async (req, res) => ok(res, await svc.getInvitation(req.params.token)));
export const acceptInvitation = asyncHandler(async (req, res) => { await svc.acceptInvitation(req.body.token, req.body.password); ok(res, { ok: true }); });
export const updateProfile = asyncHandler(async (req, res) => ok(res, await svc.updateProfile(req.auth, req.body)));
