import { prisma } from "../../config/prisma.js";
import { invalid, notFound, forbidden } from "../../utils/ApiError.js";
import { requireRole, assertPropertyAccess } from "../../utils/scope.js";
import { iso, todayISO } from "../../utils/money.js";
import { isEmail, isIndianPhone, normalizePhone } from "../../utils/validators.js";
import { logActivity } from "../../utils/sideEffects.js";
import { assertWithinPlan } from "../settings/settings.service.js";
import { issueInvitation, deliverInvitation, LOGIN_STAFF_ROLES } from "../invitations/invitation.service.js";

function serialize(s) {
  const { createdAt, updatedAt, orgId, ...rest } = s;
  return { ...rest, propertyId: s.propertyId ?? undefined, joinedOn: iso(s.joinedOn) };
}

async function withNames(rows) {
  const ids = [...new Set(rows.map((r) => r.propertyId).filter(Boolean))];
  const props = ids.length ? await prisma.property.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } }) : [];
  const name = new Map(props.map((p) => [p.id, p.name]));
  return rows.map((r) => ({ ...serialize(r), propertyName: r.propertyId ? name.get(r.propertyId) : undefined }));
}

export async function list(auth, filters = {}) {
  requireRole(auth, "owner", "manager");
  const where = { orgId: auth.orgId };
  if (auth.role === "manager") where.propertyId = auth.propertyId;
  else if (filters.propertyId) {
    await assertPropertyAccess(auth, filters.propertyId);
    where.propertyId = filters.propertyId;
  }
  if (filters.role) where.role = filters.role;
  if (filters.status) where.status = filters.status;
  const rows = await prisma.staffMember.findMany({ where, orderBy: { name: "asc" } });
  return withNames(rows);
}

function checkContact(input, e = {}) {
  if (input.phone !== undefined && !isIndianPhone(input.phone)) e.phone = "Enter a 10-digit Indian mobile number";
  if (input.email !== undefined && input.email !== "" && !isEmail(input.email)) e.email = "Enter a valid email";
  if (input.name !== undefined && input.name.trim().length < 2) e.name = "Name must be at least 2 characters";
  return e;
}

// Managers may only manage non-manager staff of their own property.
async function loadForWrite(auth, id) {
  const s = await prisma.staffMember.findUnique({ where: { id } });
  if (!s || s.orgId !== auth.orgId) throw notFound("Staff member");
  if (auth.role === "manager") {
    if (s.propertyId !== auth.propertyId) throw forbidden();
    if (s.role === "manager") throw forbidden("Only the owner can change a manager's record.");
  }
  return s;
}

export async function create(auth, actorName, input) {
  requireRole(auth, "owner", "manager");
  const propertyId = auth.role === "manager" ? auth.propertyId : input.propertyId || null;
  if (propertyId) await assertPropertyAccess(auth, propertyId);
  const e = checkContact(input);
  if (auth.role === "manager" && input.role === "manager") throw forbidden("Only the owner can add a manager.");
  if (input.sendInvite) {
    if (auth.role !== "owner") throw forbidden("Only the owner can give staff an app account.");
    if (!LOGIN_STAFF_ROLES.includes(input.role)) e.sendInvite = "Only managers, wardens and accountants can have an app account";
    if (!propertyId) e.propertyId = "Assign a property to give this person an app account";
    if (!isEmail(input.email || "")) e.email = "An email is needed to send the invitation";
  }
  if (Object.keys(e).length) throw invalid(e);
  if (input.sendInvite && (await prisma.user.findFirst({ where: { email: { equals: input.email, mode: "insensitive" } }, select: { id: true } }))) {
    throw invalid({ email: "Someone already signs in with this email" });
  }

  let invitation = null;
  const row = await prisma.$transaction(async (tx) => {
    await assertWithinPlan(tx, auth.orgId, { staff: 1 });
    const s = await tx.staffMember.create({
      data: {
        orgId: auth.orgId, propertyId, name: input.name.trim(), role: input.role, phone: normalizePhone(input.phone),
        email: (input.email ?? "").trim().toLowerCase(), shift: input.shift ?? "general",
        status: input.sendInvite ? "invited" : input.status ?? "active", joinedOn: new Date(`${todayISO()}T00:00:00.000Z`),
      },
    });
    if (input.sendInvite) {
      invitation = await issueInvitation(tx, { orgId: auth.orgId, propertyId, role: "staff", name: s.name, email: s.email, staffId: s.id, invitedBy: actorName });
    }
    await logActivity(tx, auth, actorName, "staff", `Staff added: ${s.name} (${s.role})`, propertyId, null);
    return s;
  });
  const [view] = await withNames([row]);
  const invite = invitation ? await deliverInvitation(invitation) : null;
  return { ...view, invite: invite ? { inviteLink: invite.inviteLink, emailSent: invite.emailSent } : undefined };
}

export async function update(auth, actorName, id, input) {
  requireRole(auth, "owner", "manager");
  const s = await loadForWrite(auth, id);
  const e = checkContact(input);
  if (Object.keys(e).length) throw invalid(e);
  if (auth.role === "manager" && input.role === "manager") throw forbidden("Only the owner can make someone a manager.");
  const data = {};
  for (const k of ["name", "role", "shift"]) if (input[k] !== undefined) data[k] = typeof input[k] === "string" ? input[k].trim() : input[k];
  if (input.phone !== undefined) data.phone = normalizePhone(input.phone);
  if (input.email !== undefined) data.email = input.email.trim().toLowerCase();
  if (input.propertyId !== undefined && auth.role === "owner") {
    if (input.propertyId) await assertPropertyAccess(auth, input.propertyId);
    else if (await prisma.user.findFirst({ where: { staffId: id }, select: { id: true } })) {
      // A signed-in staff member is scoped to one property; they cannot have none.
      throw invalid({ propertyId: "This person signs in to the app, so they must stay assigned to a property" });
    }
    data.propertyId = input.propertyId || null;
  }
  const row = await prisma.$transaction(async (tx) => {
    const u = await tx.staffMember.update({ where: { id }, data });
    // A signed-in staff member follows their record to the new property.
    if (data.propertyId !== undefined && data.propertyId !== s.propertyId) {
      await tx.user.updateMany({ where: { staffId: id }, data: { propertyId: data.propertyId } });
    }
    await logActivity(tx, auth, actorName, "staff", `Staff record updated: ${u.name}`, u.propertyId, null);
    return u;
  });
  return (await withNames([row]))[0];
}

/** Deactivating ends the person's sign-in at once; reactivating restores it. */
export async function setStatus(auth, actorName, id, status) {
  requireRole(auth, "owner", "manager");
  const s = await loadForWrite(auth, id);
  const row = await prisma.$transaction(async (tx) => {
    // Reactivating counts against the plan's staff limit like adding someone.
    if (s.status === "inactive" && status !== "inactive") await assertWithinPlan(tx, auth.orgId, { staff: 1 });
    const u = await tx.staffMember.update({ where: { id }, data: { status } });
    if (status === "inactive") {
      const users = await tx.user.findMany({ where: { staffId: id }, select: { id: true } });
      await tx.user.updateMany({ where: { staffId: id }, data: { disabledAt: new Date(), tokenVersion: { increment: 1 } } });
      await tx.refreshToken.updateMany({ where: { userId: { in: users.map((x) => x.id) }, revokedAt: null }, data: { revokedAt: new Date() } });
      await tx.invitation.updateMany({ where: { staffId: id, status: "pending" }, data: { status: "expired" } });
    } else if (s.status === "inactive") {
      await tx.user.updateMany({ where: { staffId: id }, data: { disabledAt: null } });
    }
    await logActivity(tx, auth, actorName, "staff", `${u.name} marked ${status.replace("_", " ")}`, u.propertyId, null);
    return u;
  });
  return (await withNames([row]))[0];
}
