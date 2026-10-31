import * as svc from "./visitor.service.js";
import { ok } from "../../utils/respond.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { actorName } from "../../utils/effects.js";

export const list = asyncHandler(async (req, res) => ok(res, await svc.list(req.auth, req.query)));
export const create = asyncHandler(async (req, res) => ok(res, await svc.create(req.auth, await actorName(req.auth), req.body), 201));
export const createWalkIn = asyncHandler(async (req, res) => ok(res, await svc.createWalkIn(req.auth, await actorName(req.auth), req.body), 201));
export const decide = asyncHandler(async (req, res) => ok(res, await svc.decide(req.auth, await actorName(req.auth), req.params.id, req.body.decision, req.body.reason)));
export const checkIn = asyncHandler(async (req, res) => ok(res, await svc.checkIn(req.auth, await actorName(req.auth), req.params.id)));
export const checkOut = asyncHandler(async (req, res) => ok(res, await svc.checkOut(req.auth, await actorName(req.auth), req.params.id)));
export const cancel = asyncHandler(async (req, res) => ok(res, await svc.cancel(req.auth, await actorName(req.auth), req.params.id)));
