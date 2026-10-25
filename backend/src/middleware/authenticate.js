import { verifyAccessToken } from "../utils/tokens.js";
import { prisma } from "../config/prisma.js";
import { unauthenticated } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

// Verifies the Bearer token sent by web OR app and sets req.auth (the acting
// identity + scope). The token only proves WHO the user is; their current role,
// property and student link are read from the database on every request, so a
// token can never carry stale or forged scope.
export const authenticate = asyncHandler(async (req, _res, next) => {
  const [scheme, token] = (req.headers.authorization || "").split(" ");
  if (scheme !== "Bearer" || !token) throw unauthenticated("Missing or malformed Authorization header");

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch {
    throw unauthenticated("Invalid or expired access token");
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { id: true, role: true, orgId: true, propertyId: true, studentId: true },
  });
  if (!user) throw unauthenticated();
  // Role changed since this token was issued: make them sign in again.
  if (user.role !== payload.role) throw unauthenticated("Your access has changed. Sign in again.");

  req.auth = {
    userId: user.id,
    role: user.role,
    orgId: user.orgId,
    propertyId: user.propertyId || undefined,
    studentId: user.studentId || undefined,
  };
  next();
});
