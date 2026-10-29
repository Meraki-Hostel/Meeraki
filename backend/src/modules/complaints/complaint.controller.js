import * as svc from "./complaint.service.js";
import { ok } from "../../utils/respond.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { actorName } from "../../utils/effects.js";

export const list = asyncHandler(async (req, res) => ok(res, await svc.list(req.auth, req.query)));
export const get = asyncHandler(async (req, res) => ok(res, await svc.get(req.auth, req.params.id)));
export const create = asyncHandler(async (req, res) => ok(res, await svc.create(req.auth, await actorName(req.auth), req.body), 201));
export const update = asyncHandler(async (req, res) => ok(res, await svc.update(req.auth, await actorName(req.auth), req.params.id, req.body)));
export const addComment = asyncHandler(async (req, res) => ok(res, await svc.addComment(req.auth, await actorName(req.auth), req.params.id, req.body), 201));
