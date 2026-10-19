import { Prisma } from "@prisma/client";
import { ApiError } from "../utils/ApiError.js";
import { isProd } from "../config/env.js";

export function notFound(req, res) {
  res.status(404).json({
    data: null,
    error: { code: "NOT_FOUND", message: `Route ${req.method} ${req.path} not found` },
    meta: { requestId: req.id },
  });
}

export function errorHandler(err, req, res, _next) {
  let e = err;
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") e = new ApiError("CONFLICT", "A record with these details already exists");
    else if (err.code === "P2025") e = new ApiError("NOT_FOUND", "Resource was not found.");
  }
  if (!(e instanceof ApiError)) {
    console.error(`[${req.id}]`, err);
    e = new ApiError("INTERNAL", "Something went wrong.");
    e.statusCode = 500;
  }
  const error = { code: e.code, message: e.message, requestId: req.id };
  if (e.fieldErrors) error.fieldErrors = e.fieldErrors;
  if (!isProd && e.statusCode === 500) error.stack = err.stack;
  res.status(e.statusCode).json({ data: null, error, meta: { requestId: req.id } });
}
