import { verifyAccessToken } from "../utils/tokens.js";
import { prisma } from "../config/prisma.js";
import { unauthenticated } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

// Verifies the Bearer token sent by web OR app and sets req.auth (the acting
// identity + scope). Role/property/student come from the signed token, never
// from the client's headers or body.
export const authenticate = asyncHandler(async (req, _res, next) => {
  const [scheme, token] = (req.headers.authorization || "").split(" ");
  if (scheme !== "Bearer" || !token) throw unauthenticated("Missing or malformed Authorization header");

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch {
    throw unauthenticated("Invalid or expired access token");
  }

  const user = await prisma.user.findUnique({ where: { id: payload.sub }, select: { id: true } });
  if (!user) throw unauthenticated();

  req.auth = {
    userId: payload.sub,
    role: payload.role,
    propertyId: payload.propertyId || undefined,
    studentId: payload.studentId || undefined,
  };
  next();
});
