import { randomUUID } from "node:crypto";
import { prisma } from "../../config/prisma.js";
import { invalid, notFound, forbidden, unauthenticated, expired, conflict, notImplemented, notConfigured } from "../../utils/ApiError.js";
import { verifyPassword, hashPassword } from "../../utils/password.js";
import { signAccessToken, generateRefreshToken, hashToken } from "../../utils/tokens.js";
import { isEmail, isIndianPhone, normalizePhone } from "../../utils/validators.js";

// A real bcrypt hash of a random string, compared against when the account does not exist.
const DUMMY_HASH = await hashPassword(randomUUID());

// Shape a User row into the frontend's User type (drops passwordHash).
function toUser(u) {
  return {
    id: u.id, name: u.name, email: u.email, phone: u.phone, role: u.role, title: u.title,
    propertyId: u.propertyId ?? undefined, studentId: u.studentId ?? undefined,
    staffId: u.staffId ?? undefined, preferences: u.preferences,
  };
}

async function issueTokens(user) {
  const accessToken = signAccessToken({ userId: user.id, role: user.role });
  const { raw, hash, expiresAt } = generateRefreshToken();
  await prisma.refreshToken.create({ data: { userId: user.id, tokenHash: hash, expiresAt } });
  return { accessToken, refreshToken: raw };
}

function sessionFor(user, startedAt = new Date().toISOString()) {
  return { userId: user.id, role: user.role, startedAt, method: "password" };
}

async function loginResult(user) {
  const tokens = await issueTokens(user);
  return { session: sessionFor(user), user: toUser(user), ...tokens };
}

export async function loginWithPassword({ role, identifier, password }) {
  const id = identifier.trim();
  const errors = {};
  if (!id) errors.identifier = "Enter your email or phone number";
  else if (!isEmail(id) && !isIndianPhone(id)) errors.identifier = "Enter a valid email or 10-digit mobile number";
  if (!password) errors.password = "Enter your password";
  if (Object.keys(errors).length) throw invalid(errors);

  const user = isEmail(id)
    ? await prisma.user.findFirst({ where: { email: { equals: id, mode: "insensitive" } } })
    // Narrow in SQL by the last digits, then compare normalised, so formatting differences still match.
    : (await prisma.user.findMany({ where: { phone: { endsWith: normalizePhone(id).slice(-4) } } }))
        .find((u) => normalizePhone(u.phone) === normalizePhone(id));

  // Always run one bcrypt comparison so an unknown account takes as long as a wrong password.
  const passwordOk = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !passwordOk) throw unauthenticated("Email/phone or password is incorrect.");

  if (user.role !== role) {
    const label = user.role[0].toUpperCase() + user.role.slice(1);
    throw forbidden(`This account is registered as ${label}. Switch to the ${label} tab to continue.`);
  }
  return loginResult(user);
}

export async function refresh(refreshToken) {
  const tokenHash = hashToken(refreshToken);
  const stored = await prisma.refreshToken.findUnique({ where: { tokenHash } });
  if (!stored || stored.revokedAt || stored.expiresAt < new Date()) throw unauthenticated("Invalid or expired refresh token");
  const user = await prisma.user.findUnique({ where: { id: stored.userId } });
  if (!user) throw unauthenticated();
  await prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } });
  return loginResult(user);
}

export async function logout(refreshToken) {
  if (!refreshToken) return;
  await prisma.refreshToken.updateMany({ where: { tokenHash: hashToken(refreshToken), revokedAt: null }, data: { revokedAt: new Date() } });
}

export async function getSession(auth) {
  const user = await prisma.user.findUnique({ where: { id: auth.userId } });
  if (!user) throw unauthenticated();
  return { session: sessionFor(user), user: toUser(user) };
}

export async function requestPasswordReset(identifier) {
  const id = identifier.trim();
  if (!id || (!isEmail(id) && !isIndianPhone(id))) throw invalid({ identifier: "Enter a valid email or 10-digit mobile number" });
  // No email/SMS provider is integrated, so no reset link can be sent. Say so
  // instead of pretending a message went out.
  throw notConfigured("Password reset by email or SMS is not set up yet. Ask your hostel admin to reset your password.");
}

export async function resetPassword() {
  // Reset tokens are never issued (see requestPasswordReset), so none can be valid.
  throw notImplemented("Password reset is not available yet.");
}

export async function getInvitation(token) {
  const inv = await prisma.invitation.findUnique({ where: { token } });
  if (!inv) throw notFound("Invitation");
  if (inv.status === "expired") throw expired("This invitation has expired. Ask your hostel admin to send a new one.");
  if (inv.status === "accepted") throw conflict("This invitation has already been accepted. Sign in instead.");
  return inv;
}

export async function acceptInvitation() {
  // Accepting must create the account; that is not built. Fail without touching the invitation.
  throw notImplemented("Accepting invitations is not available yet. Ask your hostel admin to create your account.");
}

export async function updateProfile(auth, patch) {
  const errors = {};
  if (patch.name !== undefined && patch.name.trim().length < 2) errors.name = "Name must be at least 2 characters";
  if (patch.phone !== undefined && !isIndianPhone(patch.phone)) errors.phone = "Enter a 10-digit Indian mobile number";
  if (Object.keys(errors).length) throw invalid(errors);

  const current = await prisma.user.findUnique({ where: { id: auth.userId } });
  const data = {};
  if (patch.name !== undefined) data.name = patch.name.trim();
  if (patch.phone !== undefined) data.phone = normalizePhone(patch.phone);
  if (patch.preferences) data.preferences = { ...current.preferences, ...patch.preferences };
  const updated = await prisma.user.update({ where: { id: auth.userId }, data });
  return toUser(updated);
}
