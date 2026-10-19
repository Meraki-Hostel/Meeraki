import { forbidden } from "./ApiError.js";

// Mirrors the frontend base.ts scope helpers so server-side rules match the
// client's expectations exactly.
// auth = { userId, role, propertyId, studentId }

// Owner: requested or all. Manager/student: forced to their own property.
export function scopeProperty(auth, requested) {
  if (auth.role === "owner") return requested || undefined;
  if (requested && requested !== auth.propertyId) throw forbidden();
  return auth.propertyId;
}

export function assertPropertyAccess(auth, propertyId) {
  if (auth.role !== "owner" && auth.propertyId !== propertyId) throw forbidden();
}

export function requireRole(auth, ...roles) {
  if (!roles.includes(auth.role)) throw forbidden("This action is not available for your role.");
}
