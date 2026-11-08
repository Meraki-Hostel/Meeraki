import { prisma } from "../../config/prisma.js";
import { env } from "../../config/env.js";
import { invalid, notFound, conflict, forbidden } from "../../utils/ApiError.js";
import { requireRole, assertPropertyAccess } from "../../utils/scope.js";
import { generateLinkToken } from "../../utils/tokens.js";
import { isEmail } from "../../utils/validators.js";
import { logActivity } from "../../utils/sideEffects.js";
import { sendMail, mailEnabled } from "../../services/mail.js";

const TTL_MS = 7 * 24 * 60 * 60 * 1000;
// Staff who sign in get property-wide manager access, so only these roles can.
export const LOGIN_STAFF_ROLES = ["manager", "warden", "accountant"];

const linkFor = (raw) => `${env.appUrl}/invite/accept?token=${encodeURIComponent(raw)}`;

function view(inv) {
  return {
    id: inv.id, name: inv.name, email: inv.email, role: inv.role, propertyId: inv.propertyId ?? undefined,
    studentId: inv.studentId ?? undefined, staffId: inv.staffId ?? undefined, invitedBy: inv.invitedBy,
    status: inv.status === "pending" && inv.expiresAt < new Date() ? "expired" : inv.status,
    expiresAt: inv.expiresAt.toISOString(), createdAt: inv.createdAt.toISOString(),
  };
}

/**
 * Creates a pending invitation inside the caller's transaction. Older pending
 * invitations for the same person stop working. Deliver it after commit.
 */
export async function issueInvitation(tx, { orgId, propertyId, role, name, email, studentId, staffId, invitedBy }) {
  await tx.invitation.updateMany({
    where: { orgId, status: "pending", OR: [studentId ? { studentId } : null, staffId ? { staffId } : null, { email: { equals: email, mode: "insensitive" } }].filter(Boolean) },
    data: { status: "expired" },
  });
  const { raw, hash } = generateLinkToken();
  const row = await tx.invitation.create({
    data: { tokenHash: hash, orgId, propertyId: propertyId ?? null, role, name, email: email.trim().toLowerCase(), studentId, staffId, invitedBy, expiresAt: new Date(Date.now() + TTL_MS) },
  });
  return { row, raw };
}

/**
 * Emails the link when email is set up. The link is always returned to the admin
 * who sent it, so it can also be shared another way (e.g. WhatsApp) when email
 * is not configured or fails.
 */
export async function deliverInvitation({ row, raw }) {
  const inviteLink = linkFor(raw);
  let emailSent = false;
  if (mailEnabled()) {
    try {
      const org = await prisma.organization.findUnique({ where: { id: row.orgId }, select: { name: true } });
      await sendMail({
        to: row.email,
        subject: `${row.invitedBy} invited you to ${org?.name ?? "Meraki"}`,
        text: `Hi ${row.name},\n\n${row.invitedBy} has invited you to Meraki. Open this link to choose your password and activate your account (valid for 7 days):\n\n${inviteLink}\n\nIf you weren't expecting this, you can ignore this email.`,
      });
      // Console mode only prints the email in the server log: nobody received it,
      // so the app should hand the link to the admin instead.
      emailSent = env.mail.mode !== "console";
    } catch (err) {
      console.error("Invitation email failed:", err.message);
    }
  }
  return { invitation: view(row), inviteLink, emailSent };
}

// ── Endpoints ────────────────────────────────────────────────────────────────
export async function list(auth, filters = {}) {
  requireRole(auth, "owner", "manager");
  const where = { orgId: auth.orgId };
  if (auth.role === "manager") Object.assign(where, { propertyId: auth.propertyId, role: "student" });
  if (filters.status) where.status = filters.status;
  const rows = await prisma.invitation.findMany({ where, orderBy: { createdAt: "desc" }, take: 200 });
  return rows.map(view);
}

async function targetFor(auth, input) {
  if (input.studentId) {
    const s = await prisma.studentProfile.findUnique({ where: { id: input.studentId } });
    if (!s) throw notFound("Student");
    await assertPropertyAccess(auth, s.propertyId);
    if (s.status === "moved_out") throw conflict("This resident has moved out.");
    if (!isEmail(s.email || "")) throw invalid({ email: "Add a valid email to the resident's profile first" });
    if (await prisma.user.findFirst({ where: { studentId: s.id }, select: { id: true } })) throw conflict("This resident already has an account.");
    return { role: "student", name: s.name, email: s.email, propertyId: s.propertyId, studentId: s.id };
  }
  if (input.staffId) {
    requireRole(auth, "owner");
    const st = await prisma.staffMember.findUnique({ where: { id: input.staffId } });
    if (!st || st.orgId !== auth.orgId) throw notFound("Staff member");
    if (!LOGIN_STAFF_ROLES.includes(st.role)) throw invalid({ staffId: "Only managers, wardens and accountants can have an app account" });
    if (!st.propertyId) throw invalid({ staffId: "Assign this staff member to a property first" });
    if (st.status === "inactive") throw conflict("This staff member is inactive.");
    if (!isEmail(st.email || "")) throw invalid({ email: "Add a valid email to the staff record first" });
    if (await prisma.user.findFirst({ where: { staffId: st.id }, select: { id: true } })) throw conflict("This staff member already has an account.");
    return { role: "staff", name: st.name, email: st.email, propertyId: st.propertyId, staffId: st.id };
  }
  if (input.role === "owner") {
    requireRole(auth, "owner");
    return { role: "owner", name: input.name.trim(), email: input.email, propertyId: null };
  }
  throw invalid({ studentId: "Choose who to invite" });
}

export async function create(auth, actorName, input) {
  requireRole(auth, "owner", "manager");
  const target = await targetFor(auth, input);
  if (await prisma.user.findFirst({ where: { email: { equals: target.email, mode: "insensitive" } }, select: { id: true } })) {
    throw conflict("Someone already signs in with this email. Use a different address.");
  }
  const issued = await prisma.$transaction(async (tx) => {
    const r = await issueInvitation(tx, { orgId: auth.orgId, ...target, invitedBy: actorName });
    if (target.staffId) await tx.staffMember.update({ where: { id: target.staffId }, data: { status: "invited" } });
    await logActivity(tx, auth, actorName, target.role === "student" ? "student" : "staff", `Invited ${target.name} to sign in`, target.propertyId, null);
    return r;
  });
  return deliverInvitation(issued);
}

async function ownInvitation(auth, id) {
  const inv = await prisma.invitation.findUnique({ where: { id } });
  if (!inv || inv.orgId !== auth.orgId) throw notFound("Invitation");
  if (auth.role === "manager" && (inv.propertyId !== auth.propertyId || inv.role !== "student")) throw forbidden();
  return inv;
}

export async function resend(auth, actorName, id) {
  requireRole(auth, "owner", "manager");
  const inv = await ownInvitation(auth, id);
  if (inv.status === "accepted") throw conflict("This invitation was already accepted.");
  // Re-validate the person (they may have moved out or got an account meanwhile).
  const target = await targetFor(auth, inv.studentId ? { studentId: inv.studentId } : inv.staffId ? { staffId: inv.staffId } : { role: "owner", name: inv.name, email: inv.email });
  const issued = await prisma.$transaction((tx) => issueInvitation(tx, { orgId: auth.orgId, ...target, invitedBy: actorName }));
  return deliverInvitation(issued);
}

export async function revoke(auth, id) {
  requireRole(auth, "owner", "manager");
  const inv = await ownInvitation(auth, id);
  const { count } = await prisma.invitation.updateMany({ where: { id: inv.id, status: "pending" }, data: { status: "expired" } });
  if (!count) throw conflict("Only a pending invitation can be revoked.");
  if (inv.staffId) await prisma.staffMember.updateMany({ where: { id: inv.staffId, status: "invited" }, data: { status: "active" } });
  return view(await prisma.invitation.findUnique({ where: { id } }));
}
