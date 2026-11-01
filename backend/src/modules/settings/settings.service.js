import { prisma } from "../../config/prisma.js";
import { invalid, conflict } from "../../utils/ApiError.js";
import { requireRole } from "../../utils/scope.js";
import { isEmail, isIndianPhone, normalizePhone } from "../../utils/validators.js";
import { logActivity } from "../../utils/sideEffects.js";
import { PLANS, planById } from "./plans.js";

// Billing defaults follow the agreed rules: rent raised on the 1st and due on the
// 5th, first month pro-rated, late fee OFF until the owner sets a flat amount.
export const DEFAULT_SETTINGS = {
  legalName: "", contactEmail: "", contactPhone: "", address: "", gstin: "", website: "",
  timezone: "Asia/Kolkata", currency: "INR",
  rentDueDay: 5,
  lateFeeFlat: 0,
  lateFeeGraceDays: 3,
  prorateFirstMonth: true,
  notifications: { paymentReceived: true, newComplaint: true, leaveRequests: false, lowStock: true, weeklySummary: false },
  security: { twoFactor: false, sessionTimeoutMins: 60 },
};

function merge(org) {
  const s = org.settings && typeof org.settings === "object" ? org.settings : {};
  return {
    ...DEFAULT_SETTINGS, ...s,
    orgName: org.name,
    timezone: "Asia/Kolkata", currency: "INR",
    notifications: { ...DEFAULT_SETTINGS.notifications, ...(s.notifications ?? {}) },
    security: { ...DEFAULT_SETTINGS.security, ...(s.security ?? {}) },
  };
}

/** Effective settings of an organization (used by billing jobs too). */
export async function settingsFor(orgId, db = prisma) {
  const org = await db.organization.findUnique({ where: { id: orgId } });
  return merge(org);
}

export async function get(auth) {
  requireRole(auth, "owner", "manager");
  return settingsFor(auth.orgId);
}

const GSTIN = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

export async function update(auth, actorName, patch) {
  requireRole(auth, "owner");
  const current = await settingsFor(auth.orgId);
  const next = {
    ...current, ...patch,
    notifications: { ...current.notifications, ...(patch.notifications ?? {}) },
    security: { ...current.security, ...(patch.security ?? {}) },
  };
  const e = {};
  if (!next.orgName || next.orgName.trim().length < 2) e.orgName = "Display name is required";
  if (next.contactEmail && !isEmail(next.contactEmail)) e.contactEmail = "Enter a valid email";
  if (next.contactPhone && !isIndianPhone(next.contactPhone)) e.contactPhone = "Enter a 10-digit mobile number";
  if (next.gstin && !GSTIN.test(next.gstin.toUpperCase())) e.gstin = "Enter a valid 15-character GSTIN";
  if (!Number.isInteger(next.rentDueDay) || next.rentDueDay < 1 || next.rentDueDay > 28) e.rentDueDay = "Choose a day between 1 and 28";
  if (!Number.isInteger(next.lateFeeFlat) || next.lateFeeFlat < 0 || next.lateFeeFlat > 10000) e.lateFeeFlat = "Late fee must be between ₹0 (off) and ₹10,000";
  if (!Number.isInteger(next.lateFeeGraceDays) || next.lateFeeGraceDays < 0 || next.lateFeeGraceDays > 30) e.lateFeeGraceDays = "Grace period must be 0–30 days";
  if (Object.keys(e).length) throw invalid(e);

  const { orgName, timezone, currency, ...stored } = next;
  if (stored.gstin) stored.gstin = stored.gstin.toUpperCase();
  if (stored.contactPhone) stored.contactPhone = normalizePhone(stored.contactPhone);
  await prisma.$transaction(async (tx) => {
    await tx.organization.update({ where: { id: auth.orgId }, data: { name: orgName.trim(), settings: stored } });
    await logActivity(tx, auth, actorName, "settings", "Organization settings updated", null, "/owner/settings");
  });
  return settingsFor(auth.orgId);
}

// ── Plans ────────────────────────────────────────────────────────────────────
async function usage(orgId, db = prisma) {
  const [properties, beds, staff] = await Promise.all([
    db.property.count({ where: { orgId } }),
    db.bed.count({ where: { property: { orgId } } }),
    db.staffMember.count({ where: { orgId, status: { not: "inactive" } } }),
  ]);
  return { properties, beds, staff };
}

export async function planUsage(auth) {
  requireRole(auth, "owner");
  const org = await prisma.organization.findUnique({ where: { id: auth.orgId } });
  return { plan: planById(org.planId), plans: PLANS, ...(await usage(auth.orgId)) };
}

export async function changePlan(auth, actorName, planId) {
  requireRole(auth, "owner");
  const plan = PLANS.find((p) => p.id === planId);
  if (!plan) throw invalid({ planId: "Choose a plan" });
  const u = await usage(auth.orgId);
  if (u.properties > plan.propertyLimit || u.beds > plan.bedLimit || u.staff > plan.staffLimit) {
    throw conflict(`Your portfolio is larger than the ${plan.name} plan allows.`);
  }
  await prisma.$transaction(async (tx) => {
    await tx.organization.update({ where: { id: auth.orgId }, data: { planId } });
    await logActivity(tx, auth, actorName, "settings", `Plan changed to ${plan.name}`, null, "/owner/plans");
  });
  return planUsage(auth);
}

/**
 * Refuses an addition that would take the organization past its plan limit.
 * `add` = { properties?, beds?, staff? } being added. Call inside the creating
 * transaction so the count includes what is already being written.
 */
export async function assertWithinPlan(db, orgId, add) {
  const org = await db.organization.findUnique({ where: { id: orgId }, select: { planId: true } });
  const plan = planById(org.planId);
  const u = await usage(orgId, db);
  const over = [
    ["properties", "properties", plan.propertyLimit],
    ["beds", "beds", plan.bedLimit],
    ["staff", "active staff", plan.staffLimit],
  ].find(([k, , limit]) => add[k] && u[k] + add[k] > limit);
  if (over) {
    throw conflict(`Your ${plan.name} plan allows up to ${over[2]} ${over[1]}. Upgrade your plan to add more.`);
  }
}
