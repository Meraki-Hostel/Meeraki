import { randomUUID } from "node:crypto";
import { prisma } from "../../config/prisma.js";
import { env } from "../../config/env.js";
import { invalid, notFound, forbidden, unauthenticated, expired, conflict } from "../../utils/ApiError.js";
import { verifyPassword, hashPassword } from "../../utils/password.js";
import { signAccessToken, generateRefreshToken, hashToken, generateLinkToken } from "../../utils/tokens.js";
import { isEmail, isIndianPhone, normalizePhone } from "../../utils/validators.js";
import { passwordProblem } from "../../utils/passwordPolicy.js";
import { sendMail, requireMail, maskEmail } from "../../services/mail.js";
import { logActivity, notifyStaffUsers } from "../../utils/sideEffects.js";
import { LOGIN_STAFF_ROLES } from "../invitations/invitation.service.js";

// A real bcrypt hash of a random string, compared against when the account does not exist.
const DUMMY_HASH = await hashPassword(randomUUID());
const RESET_TTL_MS = 30 * 60 * 1000;
// Two tabs refreshing with the same token at the same moment is normal; only a
// token presented again after this window counts as stolen.
const REUSE_GRACE_MS = 15 * 1000;

// Shape a User row into the frontend's User type (drops passwordHash).
function toUser(u) {
  return {
    id: u.id, name: u.name, email: u.email, phone: u.phone, role: u.role, title: u.title,
    propertyId: u.propertyId ?? undefined, studentId: u.studentId ?? undefined,
    staffId: u.staffId ?? undefined, preferences: u.preferences,
  };
}

async function issueTokens(user, familyId = randomUUID()) {
  const accessToken = signAccessToken({ userId: user.id, role: user.role, tokenVersion: user.tokenVersion });
  const { raw, hash, expiresAt } = generateRefreshToken();
  await prisma.refreshToken.create({ data: { userId: user.id, familyId, tokenHash: hash, expiresAt } });
  return { accessToken, refreshToken: raw };
}

function sessionFor(user, startedAt = new Date().toISOString()) {
  return { userId: user.id, role: user.role, startedAt, method: "password" };
}

async function loginResult(user, familyId) {
  const tokens = await issueTokens(user, familyId);
  return { session: sessionFor(user), user: toUser(user), ...tokens };
}

async function findByIdentifier(id) {
  return isEmail(id)
    ? prisma.user.findFirst({ where: { email: { equals: id, mode: "insensitive" } } })
    // Narrow in SQL by the last digits, then compare normalised, so formatting differences still match.
    : (await prisma.user.findMany({ where: { phone: { endsWith: normalizePhone(id).slice(-4) } } }))
        .find((u) => normalizePhone(u.phone) === normalizePhone(id));
}

export async function loginWithPassword({ role, identifier, password }) {
  const id = identifier.trim();
  const errors = {};
  if (!id) errors.identifier = "Enter your email or phone number";
  else if (!isEmail(id) && !isIndianPhone(id)) errors.identifier = "Enter a valid email or 10-digit mobile number";
  if (!password) errors.password = "Enter your password";
  if (Object.keys(errors).length) throw invalid(errors);

  const user = await findByIdentifier(id);
  // Always run one bcrypt comparison so an unknown account takes as long as a wrong password.
  const passwordOk = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !passwordOk) throw unauthenticated("Email/phone or password is incorrect.");
  if (user.disabledAt) throw forbidden("This account has been deactivated. Contact your hostel admin.");

  if (user.role !== role) {
    const label = user.role[0].toUpperCase() + user.role.slice(1);
    throw forbidden(`This account is registered as ${label}. Switch to the ${label} tab to continue.`);
  }
  return loginResult(user);
}

export async function refresh(refreshToken) {
  const stored = await prisma.refreshToken.findUnique({ where: { tokenHash: hashToken(refreshToken) } });
  if (!stored || stored.expiresAt < new Date()) throw unauthenticated("Invalid or expired refresh token");

  if (stored.revokedAt) {
    // A rotated-away token came back: someone else holds a copy. End every session
    // that descends from it. Inside the grace window it is a parallel refresh instead.
    if (Date.now() - stored.revokedAt.getTime() > REUSE_GRACE_MS) {
      await prisma.refreshToken.updateMany({ where: { familyId: stored.familyId, revokedAt: null }, data: { revokedAt: new Date() } });
    }
    throw unauthenticated("Invalid or expired refresh token");
  }
  const user = await prisma.user.findUnique({ where: { id: stored.userId } });
  if (!user || user.disabledAt) throw unauthenticated();
  // Rotate atomically: only one of two concurrent refreshes wins.
  const { count } = await prisma.refreshToken.updateMany({ where: { id: stored.id, revokedAt: null }, data: { revokedAt: new Date() } });
  if (!count) throw unauthenticated("Invalid or expired refresh token");
  return loginResult(user, stored.familyId);
}

export async function logout(refreshToken) {
  if (!refreshToken) return;
  await prisma.refreshToken.updateMany({ where: { tokenHash: hashToken(refreshToken), revokedAt: null }, data: { revokedAt: new Date() } });
}

/** Signs the user out on every device: refresh tokens revoked, access tokens invalidated. */
export async function logoutAll(auth) {
  await prisma.$transaction([
    prisma.user.update({ where: { id: auth.userId }, data: { tokenVersion: { increment: 1 } } }),
    prisma.refreshToken.updateMany({ where: { userId: auth.userId, revokedAt: null }, data: { revokedAt: new Date() } }),
  ]);
}

export async function getSession(auth) {
  const user = await prisma.user.findUnique({ where: { id: auth.userId } });
  if (!user) throw unauthenticated();
  return { session: sessionFor(user), user: toUser(user) };
}

// ── Password reset ───────────────────────────────────────────────────────────
// The answer is the same whether or not an account exists, so the form cannot be
// used to discover who has an account.
export async function requestPasswordReset(identifier) {
  const id = identifier.trim();
  if (!id || (!isEmail(id) && !isIndianPhone(id))) throw invalid({ identifier: "Enter a valid email or 10-digit mobile number" });
  requireMail("Password reset");

  const user = await findByIdentifier(id);
  const maskedDestination = user ? maskEmail(user.email) : isEmail(id) ? maskEmail(id) : "the email on that account";
  if (!user || user.disabledAt) return { maskedDestination };

  const { raw, hash } = generateLinkToken();
  await prisma.$transaction([
    // Only the newest link works.
    prisma.passwordResetToken.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: new Date() } }),
    prisma.passwordResetToken.create({ data: { userId: user.id, tokenHash: hash, expiresAt: new Date(Date.now() + RESET_TTL_MS) } }),
  ]);
  const link = `${env.appUrl}/reset-password?token=${encodeURIComponent(raw)}`;
  await sendMail({
    to: user.email,
    subject: "Reset your StayPookie password",
    text: `Hi ${user.name},\n\nUse this link to choose a new password. It works once and expires in 30 minutes:\n\n${link}\n\nIf you didn't ask for this, ignore this email; your password stays the same.`,
  });
  return { maskedDestination };
}

async function setPassword(tx, user, password) {
  await tx.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(password), tokenVersion: { increment: 1 } } });
  // Every existing session ends; the user signs in again with the new password.
  await tx.refreshToken.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } });
  await tx.passwordResetToken.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: new Date() } });
}

export async function resetPassword(token, password) {
  const row = await prisma.passwordResetToken.findUnique({ where: { tokenHash: hashToken(String(token)) }, include: { user: true } });
  if (!row || row.usedAt || row.expiresAt < new Date() || row.user.disabledAt) {
    throw expired("This reset link has expired or was already used. Request a new one.");
  }
  const problem = passwordProblem(password, row.user);
  if (problem) throw invalid({ password: problem });
  await prisma.$transaction(async (tx) => {
    // Claim the token atomically so two submissions cannot both succeed.
    const { count } = await tx.passwordResetToken.updateMany({ where: { id: row.id, usedAt: null }, data: { usedAt: new Date() } });
    if (!count) throw expired("This reset link has expired or was already used. Request a new one.");
    await setPassword(tx, row.user, password);
  });
}

export async function changePassword(auth, { currentPassword, newPassword }) {
  const user = await prisma.user.findUnique({ where: { id: auth.userId } });
  if (!(await verifyPassword(currentPassword, user.passwordHash))) throw invalid({ currentPassword: "Current password is incorrect" });
  if (currentPassword === newPassword) throw invalid({ newPassword: "Choose a password different from the current one" });
  const problem = passwordProblem(newPassword, user);
  if (problem) throw invalid({ newPassword: problem });
  await prisma.$transaction(async (tx) => setPassword(tx, user, newPassword));
  // The caller's own session ended with the others; hand back a fresh one.
  return loginResult(await prisma.user.findUnique({ where: { id: auth.userId } }));
}

// ── Invitations (the invitee's side; staff create them in modules/invitations) ─
function toInvitation(inv, token) {
  return {
    token, name: inv.name, email: inv.email, role: inv.role, propertyId: inv.propertyId ?? undefined,
    invitedBy: inv.invitedBy, status: inv.status, expiresAt: inv.expiresAt.toISOString(),
  };
}

async function usableInvitation(token) {
  const inv = await prisma.invitation.findUnique({ where: { tokenHash: hashToken(String(token)) } });
  if (!inv) throw notFound("Invitation");
  if (inv.status === "accepted") throw conflict("This invitation has already been accepted. Sign in instead.");
  if (inv.status === "expired" || inv.expiresAt < new Date()) {
    if (inv.status === "pending") await prisma.invitation.updateMany({ where: { id: inv.id, status: "pending" }, data: { status: "expired" } });
    throw expired("This invitation has expired. Ask your hostel admin to send a new one.");
  }
  return inv;
}

export async function getInvitation(token) {
  return toInvitation(await usableInvitation(token), token);
}

// Accepting creates the sign-in account the invitation describes, in one transaction.
export async function acceptInvitation(token, password) {
  const inv = await usableInvitation(token);
  const problem = passwordProblem(password, inv);
  if (problem) throw invalid({ password: problem });
  const passwordHash = await hashPassword(password);

  await prisma.$transaction(async (tx) => {
    const { count } = await tx.invitation.updateMany({
      where: { id: inv.id, status: "pending", expiresAt: { gt: new Date() } },
      data: { status: "accepted", acceptedAt: new Date() },
    });
    if (!count) throw conflict("This invitation has already been used. Sign in instead.");
    const taken = await tx.user.findFirst({ where: { email: { equals: inv.email, mode: "insensitive" } }, select: { id: true } });
    if (taken) throw conflict("An account with this email already exists. Sign in instead, or ask your admin to invite a different address.");

    const base = { orgId: inv.orgId, name: inv.name, email: inv.email.toLowerCase(), passwordHash };
    let user;
    if (inv.role === "student") {
      const s = await tx.studentProfile.findUnique({ where: { id: inv.studentId } });
      if (!s || s.status === "moved_out") throw conflict("This resident record is no longer active. Ask your hostel admin.");
      if (await tx.user.findFirst({ where: { studentId: s.id }, select: { id: true } })) throw conflict("This resident already has an account. Sign in instead.");
      user = await tx.user.create({ data: { ...base, phone: normalizePhone(s.phone), role: "student", title: "Resident", propertyId: s.propertyId, studentId: s.id } });
    } else if (inv.role === "staff") {
      const st = await tx.staffMember.findUnique({ where: { id: inv.staffId } });
      if (!st || st.status === "inactive") throw conflict("This staff record is no longer active. Ask your hostel admin.");
      if (!LOGIN_STAFF_ROLES.includes(st.role)) throw conflict("This staff member's role no longer allows an app account. Ask your hostel admin.");
      if (await tx.user.findFirst({ where: { staffId: st.id }, select: { id: true } })) throw conflict("This staff member already has an account. Sign in instead.");
      user = await tx.user.create({
        data: { ...base, phone: normalizePhone(st.phone), role: "manager", title: st.role === "manager" ? "Property Manager" : st.role[0].toUpperCase() + st.role.slice(1), propertyId: st.propertyId, staffId: st.id },
      });
      await tx.staffMember.update({ where: { id: st.id }, data: { status: "active" } });
    } else if (inv.role === "owner") {
      user = await tx.user.create({ data: { ...base, phone: "", role: "owner", title: "Owner" } });
    } else {
      throw conflict("This invitation cannot be accepted. Ask your hostel admin for a new one.");
    }
    const auth = { userId: user.id, role: user.role, orgId: user.orgId };
    await logActivity(tx, auth, user.name, inv.role === "student" ? "student" : "staff", `${user.name} accepted their invitation and activated their account`, user.propertyId ?? null, null);
    if (user.propertyId) await notifyStaffUsers(tx, user.propertyId, "Account activated", `${user.name} activated their StayPookie account.`, "system", null);
  });
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
