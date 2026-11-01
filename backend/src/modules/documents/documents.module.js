import { Router } from "express";
import { z } from "zod";
import * as svc from "./documents.service.js";
import { ok } from "../../utils/respond.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { authenticate } from "../../middleware/authenticate.js";
import { validate } from "../../middleware/validate.js";
import { actorName } from "../../utils/sideEffects.js";

const r = Router();
r.use(authenticate);
r.get("/", validate(z.object({ studentId: z.string().optional() }), "query"), asyncHandler(async (req, res) => ok(res, await svc.forStudent(req.auth, req.query.studentId))));
r.get("/mine", asyncHandler(async (req, res) => ok(res, await svc.mine(req.auth))));
r.post("/:docId/upload", validate(z.object({ uploadId: z.string().min(1, "Upload the file first") })),
  asyncHandler(async (req, res) => ok(res, await svc.upload(req.auth, await actorName(req.auth), req.params.docId, req.body.uploadId))));
r.post("/:docId/remove", asyncHandler(async (req, res) => ok(res, await svc.remove(req.auth, await actorName(req.auth), req.params.docId))));
r.post("/:docId/review", validate(z.object({ decision: z.enum(["verified", "rejected"]), note: z.string().max(300).optional() })),
  asyncHandler(async (req, res) => ok(res, await svc.review(req.auth, await actorName(req.auth), req.params.docId, req.body.decision, req.body.note))));
r.get("/:docId/file", asyncHandler(async (req, res) => ok(res, await svc.fileUrl(req.auth, req.params.docId))));

export const path = "/documents";
export const routes = r;
