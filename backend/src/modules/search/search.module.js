import { Router } from "express";
import { search } from "./search.service.js";
import { ok } from "../../utils/respond.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { authenticate } from "../../middleware/authenticate.js";

const r = Router();
r.get("/", authenticate, asyncHandler(async (req, res) => ok(res, await search(req.auth, typeof req.query.q === "string" ? req.query.q : ""))));

export const path = "/search";
export const routes = r;
