// Error codes are EXACTLY the frontend's ServiceError codes, so the HTTP
// adapter maps them with zero translation.
const STATUS = {
  VALIDATION: 422,
  NOT_FOUND: 404,
  FORBIDDEN: 403,
  CONFLICT: 409,
  UNAUTHENTICATED: 401,
  EXPIRED: 410,
  // The feature is not built yet / the integration it needs is not set up. The
  // frontend shows an "unavailable" state; nothing may pretend it succeeded.
  NOT_IMPLEMENTED: 501,
  NOT_CONFIGURED: 503,
};

export class ApiError extends Error {
  constructor(code, message, fieldErrors = null) {
    super(message);
    this.code = code;
    this.statusCode = STATUS[code] || 500;
    this.fieldErrors = fieldErrors;
  }
}

export const invalid = (fieldErrors, message = "Check the highlighted fields.") =>
  new ApiError("VALIDATION", message, fieldErrors);
export const notFound = (what = "Resource") => new ApiError("NOT_FOUND", `${what} was not found.`);
export const forbidden = (message = "You do not have access to this record.") =>
  new ApiError("FORBIDDEN", message);
export const conflict = (message = "Conflict") => new ApiError("CONFLICT", message);
export const unauthenticated = (message = "Your session has ended. Sign in again.") =>
  new ApiError("UNAUTHENTICATED", message);
export const notImplemented = (message = "This feature is not available yet.") =>
  new ApiError("NOT_IMPLEMENTED", message);
export const notConfigured = (message = "This feature needs to be set up by the administrator.") =>
  new ApiError("NOT_CONFIGURED", message);
export const expired = (message = "This link has expired.") => new ApiError("EXPIRED", message);
