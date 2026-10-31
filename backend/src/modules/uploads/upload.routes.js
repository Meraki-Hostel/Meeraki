import express, { Router } from "express";
import { z } from "zod";
import * as svc from "./upload.service.js";
import { ok } from "../../utils/respond.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { authenticate } from "../../middleware/authenticate.js";
import { validate } from "../../middleware/validate.js";
import { env } from "../../config/env.js";
import { verifyLocalToken, localStorageDriver, contentDisposition } from "../../services/storage.js";

const createSchema = z.object({
  purpose: z.enum(["document", "complaint"]),
  fileName: z.string().min(1).max(200),
  contentType: z.string().min(1).max(100),
  sizeBytes: z.coerce.number().int(),
});

const r = Router();

// ── Local storage stand-in for presigned URLs (STORAGE_MODE=local only) ──────
// The signed token in the URL is the authorization, exactly like an R2 presigned
// URL: no login header, short expiry, bound to one key, type and size.
r.put("/local/:token", express.raw({ type: "*/*", limit: `${env.storage.maxMb + 1}mb` }), asyncHandler(async (req, res) => {
  const claims = env.storage.mode === "local" ? verifyLocalToken(req.params.token) : null;
  if (!claims || claims.op !== "put") return res.status(403).json({ data: null, error: { code: "FORBIDDEN", message: "Upload link is invalid or expired." } });
  const body = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
  if (req.headers["content-type"] !== claims.contentType || body.length !== claims.sizeBytes) {
    return res.status(403).json({ data: null, error: { code: "FORBIDDEN", message: "File does not match the upload link." } });
  }
  await localStorageDriver.write(claims.key, claims.contentType, body);
  res.status(200).end();
}));
r.get("/local/:token", asyncHandler(async (req, res) => {
  const claims = env.storage.mode === "local" ? verifyLocalToken(req.params.token) : null;
  if (!claims || claims.op !== "get") return res.status(403).json({ data: null, error: { code: "FORBIDDEN", message: "Download link is invalid or expired." } });
  const { buffer, contentType } = await localStorageDriver.read(claims.key);
  res.set({ "Content-Type": contentType, "Content-Disposition": contentDisposition(claims.fileName), "Cache-Control": "private, no-store", "Cross-Origin-Resource-Policy": "cross-origin" });
  res.send(buffer);
}));

// ── Authenticated ────────────────────────────────────────────────────────────
r.post("/", authenticate, validate(createSchema), asyncHandler(async (req, res) => ok(res, await svc.createUpload(req.auth, req.body), 201)));
r.get("/:id/url", authenticate, asyncHandler(async (req, res) => ok(res, await svc.downloadUrl(req.auth, req.params.id))));
export default r;
