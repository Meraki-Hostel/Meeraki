import { prisma } from "../../config/prisma.js";
import { env } from "../../config/env.js";
import { invalid, notFound, forbidden, unauthenticated, expired, conflict } from "../../utils/ApiError.js";
import { verifyPassword, hashPassword } from "../../utils/password.js";
import { signAccessToken, generateRefreshToken, hashToken } from "../../utils/tokens.js";
import { isEmail, isIndianPhone, normalizePhone } from "../../utils/validators.js";

// Shape a User row into the frontend's User type (drops passwordHash).
function toUser(u) {
  return {
    id: u.id, name: u.name, email: u.email, phone: u.phone, role: u.role, title: u.title,
    propertyId: u.propertyId ?? undefined, studentId: u.studentId ?? undefined,
    staffId: u.staffId ?? undefined, preferences: u.preferences,
  };
}

async function issueTokens(user, method) {
  const accessToken = signAccessToken({
    userId: user.id, role: user.role, propertyId: user.propertyId, studentId: user.studentId, method,
  });
  const { raw, hash, expiresAt } = generateRefreshToken();
  await prisma.refreshToken.create({ data: { userId: user.id, tokenHash: hash, expiresAt } });
  return { accessToken, refreshToken: raw };
}

function sessionFor(user, method, startedAt = new Date().toISOString()) {
  return { userId: user.id, role: user.role, startedAt, method };
}

async function loginResult(user, method) {
  const tokens = await issueTokens(user, method);
  return { session: sessionFor(user, method), user: toUser(user), ...tokens };
}

export async function listPersonas() {
  const [users, propertyCount, properties] = await Promise.all([
    prisma.user.findMany({ orderBy: { role: "asc" } }),
    prisma.property.count(),
    prisma.property.findMany({ select: { id: true, name: true } }),
  ]);
  const pname = (id) => properties.find((p) => p.id === id)?.name ?? "—";
  return users.map((u) => ({
    user: toUser(u),
    subtitle:
      u.role === "owner" ? `${u.title} · ${propertyCount} properties`
      : u.role === "manager" ? `Manager · ${pname(u.propertyId)}`
      : `Student · ${pname(u.propertyId)}`,
  }));
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
    : (await prisma.user.findMany()).find((u) => normalizePhone(u.phone) === normalizePhone(id));

  // Demo password (matches the frontend) OR the user's real hash.
  const passwordOk =
    !!user && (password === env.demoPassword || (await verifyPassword(password, user.passwordHash)));
  if (!user || !passwordOk) throw unauthenticated("Email/phone or password is incorrect.");

  if (user.role !== role) {
    const label = user.role[0].toUpperCase() + user.role.slice(1);
    throw forbidden(`This account is registered as ${label}. Switch to the ${label} tab to continue.`);
  }
  return loginResult(user, "password");
}

export async function loginAsPersona(userId) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw notFound("Demo account");
  return loginResult(user, "demo");
}

export async function refresh(refreshToken) {
  const tokenHash = hashToken(refreshToken);
  const stored = await prisma.refreshToken.findUnique({ where: { tokenHash } });
  if (!stored || stored.revokedAt || stored.expiresAt < new Date()) throw unauthenticated("Invalid or expired refresh token");
  const user = await prisma.user.findUnique({ where: { id: stored.userId } });
  if (!user) throw unauthenticated();
  await prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } });
  return loginResult(user, "password");
}

export async function logout(refreshToken) {
  if (!refreshToken) return;
  await prisma.refreshToken.updateMany({ where: { tokenHash: hashToken(refreshToken), revokedAt: null }, data: { revokedAt: new Date() } });
}

export async function getSession(auth) {
  const user = await prisma.user.findUnique({ where: { id: auth.userId } });
  if (!user) throw unauthenticated();
  return { session: sessionFor(user, "password"), user: toUser(user) };
}

export async function requestPasswordReset(identifier) {
  const id = identifier.trim();
  if (!id || (!isEmail(id) && !isIndianPhone(id))) throw invalid({ identifier: "Enter a valid email or 10-digit mobile number" });
  // Same response whether or not the account exists (no enumeration).
  // TODO: issue a real reset token + email/SMS when a provider is configured.
  const masked = isEmail(id)
    ? id.replace(/^(.).*(@.*)$/, "$1•••$2")
    : `+91 •••••• ${normalizePhone(id).slice(-4)}`;
  return { maskedDestination: masked };
}

export async function resetPassword(token, password) {
  if (!token || token === "expired") throw expired("This reset link has expired. Request a new one.");
  if (password.length < 8) throw invalid({ password: "Password must be at least 8 characters" });
  // TODO: look up the reset token, find its user, set passwordHash. Stubbed for demo parity.
}

export async function getInvitation(token) {
  const inv = await prisma.invitation.findUnique({ where: { token } });
  if (!inv) throw notFound("Invitation");
  if (inv.status === "expired") throw expired("This invitation has expired. Ask your hostel admin to send a new one.");
  if (inv.status === "accepted") throw conflict("This invitation has already been accepted. Sign in instead.");
  return inv;
}

export async function acceptInvitation(token, password) {
  if (password.length < 8) throw invalid({ password: "Password must be at least 8 characters" });
  const inv = await prisma.invitation.findUnique({ where: { token } });
  if (!inv || inv.status !== "pending") throw expired("This invitation is no longer valid.");
  await prisma.invitation.update({ where: { token }, data: { status: "accepted" } });
  // TODO: create/activate the user account for inv.email with the chosen password.
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
