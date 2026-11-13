import { prisma } from "../../config/prisma.js";
import { env } from "../../config/env.js";
import { conflict, notFound, notConfigured } from "../../utils/ApiError.js";
import { requireRole, assertPropertyAccess } from "../../utils/scope.js";
import { logActivity, notifyUsers } from "../../utils/sideEffects.js";
import {
  createLinkedAccount, createStakeholder, requestRouteProduct, updateRouteSettlement,
} from "../payments/payment.gateway.js";

// An owner's payout accounts: the bank accounts that receive online rent.
//
// Accounts belong to the organization and each property points at one, so an owner
// with several hostels can use the same account for all of them or a different one
// for each. Online rent is paid out only to an `active` account; there is no
// fallback to the platform's own Razorpay account (see payNow).
//
// The full bank account number and PAN go to Razorpay and are never stored here.

const view = (a, propertyIds = []) => ({
  id: a.id, label: a.label, businessType: a.businessType, legalName: a.legalName, contactName: a.contactName,
  email: a.email, phone: a.phone, bankHolderName: a.bankHolderName, bankLast4: a.bankLast4, ifsc: a.ifsc,
  kycStatus: a.kycStatus, kycNote: a.kycNote ?? undefined, propertyIds, createdAt: a.createdAt.toISOString(),
});

const propertyIdsByAccount = async (accountIds) => {
  const rows = accountIds.length
    ? await prisma.property.findMany({ where: { payoutAccountId: { in: accountIds } }, select: { id: true, payoutAccountId: true }, orderBy: { name: "asc" } })
    : [];
  const by = new Map();
  for (const r of rows) by.set(r.payoutAccountId, [...(by.get(r.payoutAccountId) ?? []), r.id]);
  return by;
};

async function ownAccount(auth, id) {
  const a = await prisma.payoutAccount.findUnique({ where: { id } });
  // Another organization's account is "not found", never "forbidden".
  if (!a || a.orgId !== auth.orgId) throw notFound("Payout account");
  return a;
}

export async function list(auth) {
  requireRole(auth, "owner");
  const accounts = await prisma.payoutAccount.findMany({ where: { orgId: auth.orgId }, orderBy: { createdAt: "asc" } });
  const by = await propertyIdsByAccount(accounts.map((a) => a.id));
  return accounts.map((a) => view(a, by.get(a.id) ?? []));
}

// Razorpay's activation_status → ours.
const KYC_FROM_GATEWAY = {
  requested: "submitted", under_review: "under_review", needs_clarification: "needs_clarification",
  activated: "active", suspended: "suspended", rejected: "rejected",
};

const describeRequirements = (reqs) => {
  if (!Array.isArray(reqs) || !reqs.length) return null;
  return reqs.map((r) => `${String(r.field_reference ?? "details").replaceAll("_", " ")} (${String(r.reason_code ?? "needs attention").replaceAll("_", " ")})`).join("; ").slice(0, 500);
};

async function saveProgress(id, data) {
  return prisma.payoutAccount.update({ where: { id }, data });
}

// A gateway answer we can show the owner (bad PAN, mismatched bank name, ...) vs. a
// network failure where the outcome is unknown. Either way the account stays a draft
// and re-submitting resumes from the step that failed.
function gatewayFailure(err) {
  if (err instanceof Error && err.message?.startsWith("Razorpay ")) {
    return conflict(`Razorpay could not register this account${err.gatewayDescription ? `: ${err.gatewayDescription}` : "."} Check the details and submit again.`);
  }
  return conflict("Could not reach Razorpay. Nothing was lost: submit again to continue.");
}

/**
 * Registers (or resumes registering) the account with the gateway. Progress is saved
 * after every step, so a failure halfway leaves a draft that picks up where it
 * stopped instead of creating a duplicate linked account.
 */
async function onboard(account, input) {
  if (env.payments.mode === "simulated") {
    // Local development: no gateway, so nothing to verify. Clearly labelled.
    return saveProgress(account.id, { kycStatus: "active", kycNote: "Simulated account (local development, no money moves)." });
  }

  let a = account;
  try {
    if (!a.gatewayAccountId) {
      const gw = await createLinkedAccount({
        referenceId: a.id.replaceAll("-", "").slice(0, 20),
        email: input.email, phone: input.phone, legalName: input.legalName, contactName: input.contactName,
        businessType: input.businessType, address: input.address,
        // Individuals and sole proprietors are identified by the owner's own PAN (sent with the
        // stakeholder below); every other business type by its business PAN and GSTIN.
        pan: ["individual", "proprietorship"].includes(input.businessType) ? undefined : input.pan,
        gst: input.gstin || undefined,
      });
      a = await saveProgress(a.id, { gatewayAccountId: gw.id });
    }
    if (["individual", "proprietorship"].includes(input.businessType) && !a.gatewayStakeholderId) {
      const sh = await createStakeholder(a.gatewayAccountId, { name: input.contactName, email: input.email, pan: input.pan, address: input.address });
      a = await saveProgress(a.id, { gatewayStakeholderId: sh.id });
    }
    if (!a.gatewayProductId) {
      const prod = await requestRouteProduct(a.gatewayAccountId);
      a = await saveProgress(a.id, { gatewayProductId: prod.id });
    }
    // Always sent: on a re-submit this is how a corrected bank account reaches the gateway.
    const product = await updateRouteSettlement(a.gatewayAccountId, a.gatewayProductId, {
      accountNumber: input.bank.accountNumber, ifsc: input.bank.ifsc, beneficiaryName: input.bank.holderName,
    });
    return saveProgress(a.id, {
      kycStatus: KYC_FROM_GATEWAY[product.activation_status] ?? "submitted",
      kycNote: describeRequirements(product.requirements),
    });
  } catch (err) {
    await saveProgress(a.id, { kycNote: `Not finished: ${String(err.gatewayDescription ?? err.message).slice(0, 300)}` }).catch(() => {});
    throw gatewayFailure(err);
  }
}

const fieldsFrom = (input) => ({
  label: input.label, businessType: input.businessType, legalName: input.legalName, contactName: input.contactName,
  email: input.email, phone: input.phone, bankHolderName: input.bank.holderName,
  bankLast4: input.bank.accountNumber.slice(-4), ifsc: input.bank.ifsc,
});

function assertGatewayReady() {
  if (env.payments.mode === "disabled") {
    throw notConfigured("Online payments are not set up on this server yet, so payout accounts cannot be registered.");
  }
}

export async function create(auth, actorName, input) {
  requireRole(auth, "owner");
  assertGatewayReady();
  const row = await prisma.$transaction(async (tx) => {
    const r = await tx.payoutAccount.create({ data: { orgId: auth.orgId, ...fieldsFrom(input), kycStatus: "draft" } });
    await logActivity(tx, auth, actorName, "payment", `Payout account added: ${r.label}`, null, "/owner/settings");
    return r;
  });
  return view(await onboard(row, input));
}

/**
 * Re-submits an account that did not finish (`draft`) or that the gateway sent back
 * (`needs_clarification`, `rejected`) with corrected details.
 */
export async function resubmit(auth, actorName, id, input) {
  requireRole(auth, "owner");
  assertGatewayReady();
  const a = await ownAccount(auth, id);
  if (!["draft", "needs_clarification", "rejected"].includes(a.kycStatus)) {
    throw conflict("This account is already verified or under review. There is nothing to re-submit.");
  }
  const row = await saveProgress(a.id, { ...fieldsFrom(input), kycNote: null });
  await prisma.$transaction((tx) => logActivity(tx, auth, actorName, "payment", `Payout account re-submitted: ${row.label}`, null, "/owner/settings"));
  const done = await onboard(row, input);
  return view(done, (await propertyIdsByAccount([done.id])).get(done.id) ?? []);
}

export async function rename(auth, id, label) {
  requireRole(auth, "owner");
  await ownAccount(auth, id);
  const a = await saveProgress(id, { label });
  return view(a, (await propertyIdsByAccount([id])).get(id) ?? []);
}

export async function remove(auth, actorName, id) {
  requireRole(auth, "owner");
  const a = await ownAccount(auth, id);
  const [props, paid] = await Promise.all([
    prisma.property.count({ where: { payoutAccountId: id } }),
    prisma.payment.count({ where: { payoutAccountId: id } }),
  ]);
  if (props) throw conflict("This account is still used by a hostel. Choose another account for it first.");
  if (paid) throw conflict("Rent has already been paid out to this account, so it is kept for your records.");
  await prisma.$transaction(async (tx) => {
    await tx.payoutAccount.delete({ where: { id } });
    await logActivity(tx, auth, actorName, "payment", `Payout account removed: ${a.label}`, null, "/owner/settings");
  });
  return { id };
}

/** Point a hostel at one of the owner's accounts (or `null` to turn online rent off for it). */
export async function assign(auth, actorName, propertyId, payoutAccountId) {
  requireRole(auth, "owner");
  await assertPropertyAccess(auth, propertyId);
  const account = payoutAccountId ? await ownAccount(auth, payoutAccountId) : null;
  await prisma.$transaction(async (tx) => {
    const p = await tx.property.update({ where: { id: propertyId }, data: { payoutAccountId: account?.id ?? null } });
    await logActivity(tx, auth, actorName, "payment",
      account ? `${p.name}: online rent now goes to "${account.label}"` : `${p.name}: online rent turned off`, propertyId, `/owner/properties/${propertyId}`);
  });
  return { propertyId, payoutAccountId: account?.id ?? null };
}

/** The account that receives a property's online rent, if one is set up and verified. */
export async function activeAccountFor(propertyId) {
  const p = await prisma.property.findUnique({ where: { id: propertyId }, select: { payoutAccount: true } });
  const a = p?.payoutAccount;
  return a && a.kycStatus === "active" && a.gatewayAccountId ? a : null;
}

// ── Gateway webhooks ─────────────────────────────────────────────────────────
const ownersOf = (tx, orgId) => tx.user.findMany({ where: { orgId, role: "owner", disabledAt: null }, select: { id: true } });

/** product.route.* : the gateway moved a linked account along its verification. */
export async function applyProductEvent({ gatewayAccountId, activationStatus, requirements }) {
  if (!gatewayAccountId) return { ignored: "no account" };
  const a = await prisma.payoutAccount.findUnique({ where: { gatewayAccountId } });
  if (!a) return { ignored: "unknown account" };
  const next = KYC_FROM_GATEWAY[activationStatus];
  if (!next) return { ignored: `status ${activationStatus}` };
  if (next === a.kycStatus) return { alreadyApplied: true };
  await prisma.$transaction(async (tx) => {
    await tx.payoutAccount.update({ where: { id: a.id }, data: { kycStatus: next, kycNote: describeRequirements(requirements) } });
    const copy = {
      active: ["Payout account verified", `"${a.label}" is verified. Students can now pay rent online for hostels using it.`],
      needs_clarification: ["Payout account needs a correction", `"${a.label}" needs a correction before it can be verified. Open it and re-submit.`],
      rejected: ["Payout account rejected", `"${a.label}" could not be verified by the payment provider.`],
      suspended: ["Payout account suspended", `"${a.label}" was paused by the payment provider. Online rent for its hostels is off.`],
    }[next];
    if (copy) await notifyUsers(tx, (await ownersOf(tx, a.orgId)).map((u) => u.id), copy[0], copy[1], "payment", "/owner/settings");
  });
  return { updated: next };
}

/** transfer.processed / transfer.failed : the owner's share of a payment moved (or didn't). */
export async function settleTransfer({ gatewayTransferId, status }) {
  if (!gatewayTransferId || !["processed", "failed"].includes(status)) return { ignored: "not a settled transfer" };
  const p = await prisma.payment.findUnique({ where: { gatewayTransferId } });
  if (!p) return { ignored: "unknown transfer" };
  if (p.transferStatus === status || p.transferStatus === "reversed") return { alreadyApplied: true };
  await prisma.$transaction(async (tx) => {
    await tx.payment.update({ where: { id: p.id }, data: { transferStatus: status } });
    if (status === "failed") {
      const prop = await tx.property.findUnique({ where: { id: p.propertyId }, select: { orgId: true, name: true } });
      await notifyUsers(tx, (await ownersOf(tx, prop.orgId)).map((u) => u.id), "Rent payout failed",
        `Payment ${p.receiptNo} for ${prop.name} was collected but could not be paid out to your account. Check the payout account; the payment provider retries automatically.`,
        "payment", "/owner/finance");
    }
  });
  return { updated: status };
}
