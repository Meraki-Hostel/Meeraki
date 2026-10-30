import * as svc from "./leave.service.js";
import { ok } from "../../utils/respond.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { actorName } from "../../utils/effects.js";

export const list = asyncHandler(async (req, res) => ok(res, await svc.list(req.auth, req.query)));
export const create = asyncHandler(async (req, res) => ok(res, await svc.create(req.auth, await actorName(req.auth), req.body), 201));
export const decide = asyncHandler(async (req, res) => ok(res, await svc.decide(req.auth, await actorName(req.auth), req.params.id, req.body.decision, req.body.reason)));
export const cancel = asyncHandler(async (req, res) => ok(res, await svc.cancel(req.auth, await actorName(req.auth), req.params.id)));
