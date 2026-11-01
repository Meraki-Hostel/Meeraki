import * as svc from "./property.service.js";
import { ok } from "../../utils/respond.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { actorName } from "../../utils/sideEffects.js";
export const list = asyncHandler(async (req, res) => ok(res, await svc.list(req.auth, req.query)));
export const get = asyncHandler(async (req, res) => ok(res, await svc.get(req.auth, req.params.id)));
export const create = asyncHandler(async (req, res) => ok(res, await svc.create(req.auth, req.body, await actorName(req.auth)), 201));
export const update = asyncHandler(async (req, res) => ok(res, await svc.update(req.auth, req.params.id, req.body)));
export const setStatus = asyncHandler(async (req, res) => ok(res, await svc.setStatus(req.auth, req.params.id, req.body.status)));
