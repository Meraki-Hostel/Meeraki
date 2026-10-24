import { prisma } from "../config/prisma.js";
import { forbidden, notFound } from "./ApiError.js";

// auth = { userId, role, orgId, propertyId, studentId }, always read from the
// database by `authenticate`.
//
// Owner:   every property of their organization, nothing outside it.
// Manager: their one property.  Student: their own records (property for reads).
//
// Another organization's property is reported as "not found", never "forbidden",
// so tenants cannot discover each other's records.

export async function assertPropertyAccess(auth, propertyId) {
  if (!propertyId) throw notFound("Property");
  if (auth.role === "owner") {
    const p = await prisma.property.findUnique({ where: { id: propertyId }, select: { orgId: true } });
    if (!p || p.orgId !== auth.orgId) throw notFound("Property");
    return;
  }
  if (auth.propertyId !== propertyId) throw forbidden();
}

/**
 * Prisma `where` fragment restricting a model that has `propertyId` + a `property`
 * relation (Room, Bed, StudentProfile, RentCharge, Payment) to what `auth` may see,
 * optionally narrowed to one requested property.
 */
export async function propertyScope(auth, requested) {
  if (auth.role === "owner") {
    if (requested) {
      await assertPropertyAccess(auth, requested);
      return { propertyId: requested };
    }
    return { property: { orgId: auth.orgId } };
  }
  if (requested && requested !== auth.propertyId) throw forbidden();
  return { propertyId: auth.propertyId };
}

export function requireRole(auth, ...roles) {
  if (!roles.includes(auth.role)) throw forbidden("This action is not available for your role.");
}
