import { prisma } from "../../config/prisma.js";
import { env } from "../../config/env.js";
import { invalid, notFound, forbidden, conflict, notConfigured } from "../../utils/ApiError.js";
import { requireRole, propertyScope, assertPropertyAccess } from "../../utils/scope.js";
import { withBalance, iso, todayISO, currentPeriod, currentYear, counted } from "../../utils/money.js";
import { ledgerRows, balanceOf, countedRefund } from "../../utils/ledger.js";
import { nextValue, pad } from "../../utils/counters.js";
import { logActivity, notifyStudentUsers, notifyStaffUsers } from "../../utils/sideEffects.js";
import { createOrder, fetchPayment, refundPayment, verifyCheckoutSignature } from "./payment.gateway.js";

const inr = (n) => `₹${Number(n).toLocaleString("en-IN")}`;

// ── Shared helpers ───────────────────────────────────────────────────────────
// Display names for exactly the rows being returned (never a scan of every tenant's data).
async function lookupsFor(rows) {
  const studentIds = [...new Set(rows.map((r) => r.studentId))];
  const propertyIds = [...new Set(rows.map((r) => r.propertyId))];
  const [students, properties] = await Promise.all([
    prisma.studentProfile.findMany({ where: { id: { in: studentIds } }, select: { id: true, name: true, studentCode: true, roomId: true } }),
    prisma.property.findMany({ where: { id: { in: propertyIds } }, select: { id: true, name: true } }),
  ]);
  const roomIds = [...new Set(students.map((st) => st.roomId).filter(Boolean))];
  const rooms = roomIds.length ? await prisma.room.findMany({ where: { id: { in: roomIds } }, select: { id: true, number: true } }) : [];
  return {
    sById: new Map(students.map((st) => [st.id, st])),
    pById: new Map(properties.map((p) => [p.id, p.name])),
    rById: new Map(rooms.map((r) => [r.id, r.number])),
  };
}

const nextReceiptNo = async (tx) => `RCPT-${currentYear()}-${pad(await nextValue(tx, "receipt"))}`;
const nextRefundNo = async (tx) => `REF-${currentYear()}-${pad(await nextValue(tx, "refund"))}`;

// Serialises every write against one charge (record, pay-now, webhook, refund),
// so two of them can never both pass the balance check.
async function lockCharge(tx, chargeId) {
  await tx.$queryRaw`SELECT "id" FROM "RentCharge" WHERE "id" = ${chargeId} FOR UPDATE`;
  return tx.rentCharge.findUnique({ where: { id: chargeId } });
}

// Inserts a Payment row + receipt number. Caller supplies the resolved amount.
async function insertPayment(tx, actorName, { chargeId, studentId, propertyId, amount, method, paidOn, reference, note, gatewayOrderId, gatewayPaymentId, status = "captured" }) {
  const receiptNo = await nextReceiptNo(tx);
  return tx.payment.create({
    data: {
      chargeId, studentId, propertyId, amount, method, status,
      paidOn: new Date(paidOn), reference: reference || `DEMO${Date.now().toString().slice(-8)}`,
      receiptNo, recordedBy: actorName, note: note || null,
      gatewayOrderId: gatewayOrderId || null, gatewayPaymentId: gatewayPaymentId || null,
    },
  });
}

// Charges a given auth can see, scoped like the frontend.
async function chargeScopeWhere(auth, propertyId) {
  if (auth.role === "student") return { studentId: auth.studentId };
  return propertyScope(auth, propertyId);
}

// ── Reads ────────────────────────────────────────────────────────────────────
export async function listCharges(auth, filters = {}) {
  const where = { ...(await chargeScopeWhere(auth, filters.propertyId)) };
  if (filters.studentId) where.studentId = filters.studentId;
  if (filters.period) where.period = filters.period;
  if (filters.kind) where.kind = filters.kind;

  const charges = await prisma.rentCharge.findMany({ where });
  const rows = await ledgerRows(prisma, { chargeId: { in: charges.map((c) => c.id) } });
  const today = todayISO();
  const { sById, pById, rById } = await lookupsFor(charges);

  return charges
    .map((c) => withBalance(c, rows, today))
    .filter((c) => !filters.status || c.status === filters.status)
    .map((c) => {
      const st = sById.get(c.studentId);
      return {
        ...c, dueDate: iso(c.dueDate), createdAt: undefined, updatedAt: undefined,
        studentName: st?.name ?? "Unknown", studentCode: st?.studentCode ?? "",
        roomNumber: st?.roomId ? rById.get(st.roomId) : undefined,
        propertyName: pById.get(c.propertyId) ?? "—",
      };
    })
    .sort((a, b) => b.period.localeCompare(a.period) || a.dueDate.localeCompare(b.dueDate));
}

export async function listPayments(auth, filters = {}) {
  const where = { ...counted }; // open or failed gateway attempts are not payments
  if (auth.role === "student") where.studentId = auth.studentId;
  else Object.assign(where, await propertyScope(auth, filters.propertyId));
  if (filters.studentId && auth.role !== "student") where.studentId = filters.studentId;
  if (filters.method) where.method = filters.method;
  if (filters.from || filters.to) {
    where.paidOn = {
      ...(filters.from ? { gte: new Date(`${filters.from}T00:00:00.000Z`) } : {}),
      ...(filters.to ? { lte: new Date(`${filters.to}T00:00:00.000Z`) } : {}),
    };
  }

  const payments = await prisma.payment.findMany({ where });
  const ids = payments.map((p) => p.id);
  const [{ sById, pById }, charges, refunds] = await Promise.all([
    lookupsFor(payments),
    prisma.rentCharge.findMany({ where: { id: { in: [...new Set(payments.map((p) => p.chargeId))] } }, select: { id: true, period: true, kind: true } }),
    prisma.refund.groupBy({ by: ["paymentId"], where: { paymentId: { in: ids }, ...countedRefund }, _sum: { amount: true } }),
  ]);
  const chargeById = new Map(charges.map((c) => [c.id, c]));
  const refundedBy = new Map(refunds.map((r) => [r.paymentId, r._sum.amount ?? 0]));

  return payments
    .map((p) => {
      const st = sById.get(p.studentId);
      return {
        ...p, paidOn: iso(p.paidOn), createdAt: undefined,
        studentName: st?.name ?? "Unknown", studentCode: st?.studentCode ?? "",
        propertyName: pById.get(p.propertyId) ?? "—",
        period: chargeById.get(p.chargeId)?.period ?? "", chargeKind: chargeById.get(p.chargeId)?.kind,
        refundedAmount: refundedBy.get(p.id) ?? 0,
      };
    })
    .sort((a, b) => b.paidOn.localeCompare(a.paidOn) || b.receiptNo.localeCompare(a.receiptNo));
}

export async function summary(auth, filters = {}) {
  const where = { ...(await chargeScopeWhere(auth, filters.propertyId)) };
  const period = filters.period ?? currentPeriod();
  if (period !== "all") where.period = period;

  const charges = await prisma.rentCharge.findMany({ where });
  const rows = await ledgerRows(prisma, { chargeId: { in: charges.map((c) => c.id) } });
  const today = todayISO();
  const wb = charges.map((c) => withBalance(c, rows, today));

  const expected = wb.reduce((a, c) => a + c.amount, 0);
  const collected = wb.reduce((a, c) => a + Math.max(0, Math.min(c.paid, c.amount)), 0);
  const overdue = wb.filter((c) => c.status === "overdue");
  const pending = wb.filter((c) => c.status === "pending" || c.status === "partial");
  return {
    expected, collected,
    overdue: overdue.reduce((a, c) => a + c.balance, 0),
    pending: pending.reduce((a, c) => a + c.balance, 0),
    collectionPct: expected ? Math.round((collected / expected) * 100) : 0,
    overdueCount: overdue.length, pendingCount: pending.length,
  };
}

export async function getReceipt(auth, paymentId) {
  const p = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!p || !["captured", "simulated"].includes(p.status)) throw notFound("Receipt"); // no receipt for money not received
  if (auth.role === "student" && p.studentId !== auth.studentId) throw forbidden();
  if (auth.role !== "student") await assertPropertyAccess(auth, p.propertyId);

  const [charge, student, property, refunds] = await Promise.all([
    prisma.rentCharge.findUnique({ where: { id: p.chargeId } }),
    prisma.studentProfile.findUnique({ where: { id: p.studentId } }),
    prisma.property.findUnique({ where: { id: p.propertyId }, include: { org: true } }),
    prisma.refund.findMany({ where: { paymentId: p.id, ...countedRefund }, orderBy: { createdAt: "asc" } }),
  ]);
  const bed = student?.bedId ? await prisma.bed.findUnique({ where: { id: student.bedId } }) : null;
  const room = student?.roomId ? await prisma.room.findUnique({ where: { id: student.roomId } }) : null;
  const orgSettings = property.org.settings ?? {};

  return {
    receiptNo: p.receiptNo,
    payment: { ...p, paidOn: iso(p.paidOn), createdAt: undefined },
    charge: { ...charge, dueDate: iso(charge.dueDate), createdAt: undefined, updatedAt: undefined },
    student: { id: student.id, name: student.name, studentCode: student.studentCode, phone: student.phone },
    property: { id: property.id, name: property.name, address: property.address },
    roomLabel: room ? `Room ${room.number}${bed ? `, Bed ${bed.label}` : ""}` : "Not allotted",
    issuer: { name: orgSettings.legalName || property.org.name, gstin: orgSettings.gstin || undefined },
    refunds: refunds.map((r) => ({ refundNo: r.refundNo, amount: r.amount, reason: r.reason, status: r.status, date: r.createdAt.toISOString() })),
  };
}

// ── Writes ───────────────────────────────────────────────────────────────────
export async function recordPayment(auth, actorName, input) {
  requireRole(auth, "owner", "manager");
  const found = await prisma.rentCharge.findUnique({ where: { id: input.chargeId } });
  if (!found) throw invalid({ chargeId: "Choose a due to pay against" });
  await assertPropertyAccess(auth, found.propertyId);

  const e = {};
  if (!(input.amount > 0)) e.amount = "Amount must be greater than zero";
  else if (!Number.isInteger(input.amount)) e.amount = "Amount must be in whole rupees";
  if (!input.paidOn) e.paidOn = "Payment date is required";
  else if (input.paidOn > todayISO()) e.paidOn = "Payment date cannot be in the future";
  if (input.method !== "cash" && !input.reference.trim()) e.reference = "Reference / UTR is required for non-cash payments";
  if (Object.keys(e).length) throw invalid(e);

  const created = await prisma.$transaction(async (tx) => {
    const charge = await lockCharge(tx, found.id);
    const balance = await balanceOf(tx, charge);
    if (input.amount > balance) throw invalid({ amount: `Amount cannot exceed the balance of ${inr(balance)}` });
    const p = await insertPayment(tx, actorName, {
      chargeId: charge.id, studentId: charge.studentId, propertyId: charge.propertyId,
      amount: input.amount, method: input.method, paidOn: input.paidOn,
      reference: input.reference.trim(), note: input.note?.trim(),
    });
    const st = await tx.studentProfile.findUnique({ where: { id: charge.studentId }, select: { name: true } });
    await logActivity(tx, auth, actorName, "payment", `Recorded ${inr(input.amount)} ${input.method.replace("_", " ")} payment from ${st.name}`, charge.propertyId, `/manager/students/${charge.studentId}`);
    await notifyStudentUsers(tx, charge.studentId, "Payment received", `${inr(input.amount)} received. Receipt ${p.receiptNo}.`, "payment", "/student/rent");
    return p;
  });
  return { ...created, paidOn: iso(created.paidOn), createdAt: undefined };
}

export async function sendReminders(auth, actorName, chargeIds) {
  requireRole(auth, "owner", "manager");
  if (!chargeIds.length) throw invalid({ chargeIds: "Select at least one due" });
  const charges = await prisma.rentCharge.findMany({ where: { id: { in: chargeIds } } });
  const rows = await ledgerRows(prisma, { chargeId: { in: chargeIds } });
  const today = todayISO();
  // Owners may only remind about their own organization's dues.
  const allowed = auth.role === "owner"
    ? new Set((await prisma.property.findMany({ where: { orgId: auth.orgId }, select: { id: true } })).map((p) => p.id))
    : new Set([auth.propertyId]);

  let count = 0;
  await prisma.$transaction(async (tx) => {
    for (const ch of charges) {
      if (!allowed.has(ch.propertyId)) continue;
      const wb = withBalance(ch, rows, today);
      if (wb.balance <= 0) continue;
      await notifyStudentUsers(tx, ch.studentId, "Rent reminder", `${inr(wb.balance)} is due for ${ch.period}. Due date: ${iso(ch.dueDate)}.`, "payment", "/student/rent");
      count++;
    }
    if (count) await logActivity(tx, auth, actorName, "payment", `Sent rent reminders to ${count} resident${count > 1 ? "s" : ""}`, auth.propertyId, "/manager/payments");
  });
  return count;
}

// payNow: student self-service online payment.
// - disabled (default): online payment is not set up → NOT_CONFIGURED. Staff record payments.
// - simulated (local development only; production refuses to start with it):
//   records a "simulated" payment, clearly labelled, no money moved.
// - razorpay: creates (or reuses) a gateway Order and returns it as pending.
//   Nothing counts as paid until the server confirms the capture with Razorpay.
export async function payNow(auth, actorName, chargeId, method) {
  requireRole(auth, "student");
  const charge = await prisma.rentCharge.findUnique({ where: { id: chargeId } });
  if (!charge) throw notFound("Due");
  if (charge.studentId !== auth.studentId) throw forbidden();
  const gatewayMethod = method === "netbanking" ? "bank_transfer" : method;

  if (env.payments.mode === "disabled") {
    throw notConfigured("Online payment is not set up for your hostel yet. Pay at the office and the manager will record it.");
  }

  if (env.payments.mode === "razorpay") {
    const balance = await balanceOf(prisma, charge);
    if (balance <= 0) throw conflict("This due is already paid.");

    // Reuse the open order when it is still for the right amount.
    const open = await prisma.payment.findFirst({ where: { chargeId: charge.id, status: "pending" } });
    if (open && open.amount === balance) return pendingResponse(open.gatewayOrderId, balance);
    if (open) await prisma.payment.updateMany({ where: { id: open.id, status: "pending" }, data: { status: "failed", note: "Superseded: balance changed before payment" } });

    const order = await createOrder({
      amountRupees: balance,
      receipt: `chg_${charge.id}`,
      notes: { chargeId: charge.id, studentId: charge.studentId, propertyId: charge.propertyId, method },
    });
    try {
      await prisma.payment.create({
        data: {
          chargeId: charge.id, studentId: charge.studentId, propertyId: charge.propertyId, status: "pending",
          amount: balance, method: gatewayMethod, paidOn: new Date(todayISO()),
          reference: `PENDING_${order.id}`, receiptNo: `PENDING-${order.id}`,
          recordedBy: actorName, note: "Awaiting gateway confirmation", gatewayOrderId: order.id,
        },
      });
    } catch (err) {
      // A concurrent pay-now opened an order first (one pending order per charge): use that one.
      if (err?.code !== "P2002") throw err;
      const winner = await prisma.payment.findFirst({ where: { chargeId: charge.id, status: "pending" } });
      if (!winner) throw err;
      return pendingResponse(winner.gatewayOrderId, winner.amount);
    }
    return pendingResponse(order.id, balance);
  }

  // Simulated mode (local development only).
  const created = await prisma.$transaction(async (tx) => {
    const locked = await lockCharge(tx, charge.id);
    const balance = await balanceOf(tx, locked);
    if (balance <= 0) throw conflict("This due is already paid.");
    const p = await insertPayment(tx, actorName, {
      chargeId: charge.id, studentId: charge.studentId, propertyId: charge.propertyId, status: "simulated",
      amount: balance, method: gatewayMethod, paidOn: todayISO(),
      reference: `SIM${Date.now().toString().slice(-9)}`, note: "Simulated online payment (demo, no money moved)",
    });
    await logActivity(tx, auth, actorName, "payment", `${actorName} paid ${inr(balance)} online (simulated, no money moved)`, charge.propertyId, `/manager/students/${charge.studentId}`);
    await notifyStaffUsers(tx, charge.propertyId, "Simulated payment", `${actorName} paid ${inr(balance)} (simulated, no money moved).`, "payment", "/manager/payments", "/owner/finance");
    await notifyStudentUsers(tx, charge.studentId, "Simulated payment recorded", `${inr(balance)} (simulated, no money moved). Receipt ${p.receiptNo}.`, "payment", "/student/rent");
    return p;
  });
  return { ...created, paidOn: iso(created.paidOn), createdAt: undefined };
}

function pendingResponse(orderId, amountRupees) {
  return {
    pending: true,
    order: { id: orderId, amount: Math.round(amountRupees * 100), currency: "INR" },
    keyId: env.payments.razorpayKeyId,
  };
}

/**
 * Called by the browser after Razorpay Checkout reports success. The browser's
 * word is not trusted: the Checkout signature must verify with our key secret,
 * and the payment is then fetched from Razorpay's API. Only a payment Razorpay
 * itself reports as captured, for this order and the exact amount, is credited.
 */
export async function verifyCheckout(auth, { orderId, paymentId, signature }) {
  requireRole(auth, "student");
  if (env.payments.mode !== "razorpay") throw notConfigured("Online payment is not set up for your hostel yet.");
  const pending = await prisma.payment.findUnique({ where: { gatewayOrderId: orderId } });
  if (!pending || pending.studentId !== auth.studentId) throw notFound("Payment");
  if (!verifyCheckoutSignature(orderId, paymentId, signature)) throw invalid({ signature: "Payment could not be verified" }, "Payment could not be verified.");

  if (pending.status === "pending") {
    const gw = await fetchPayment(paymentId);
    if (gw.order_id !== orderId) throw invalid({ paymentId: "Payment does not belong to this order" });
    if (gw.status === "captured") {
      await confirmWebhookPayment({ orderId, gatewayPaymentId: gw.id, amountPaise: gw.amount, currency: gw.currency });
    } else if (gw.status === "failed") {
      await failWebhookPayment({ orderId });
    }
    // 'authorized' / 'created': still settling; the webhook will confirm it.
  }
  const p = await prisma.payment.findUnique({ where: { id: pending.id } });
  return {
    status: p.status === "captured" ? "paid" : p.status === "failed" ? "failed" : "processing",
    payment: p.status === "captured" ? { ...p, paidOn: iso(p.paidOn), createdAt: undefined } : undefined,
  };
}

// Called only after the payment was verified with Razorpay (webhook signature, or
// a server-side fetch). Idempotent: a replay, or a concurrent delivery of the same
// event, confirms the payment at most once. The captured amount and currency must
// match the order exactly; anything else is left pending and flagged for staff.
export async function confirmWebhookPayment({ orderId, gatewayPaymentId, amountPaise, currency }) {
  const pending = orderId ? await prisma.payment.findUnique({ where: { gatewayOrderId: orderId } }) : null;
  if (!pending) return { ignored: "unknown order" };
  if (pending.status === "captured") return { alreadyConfirmed: true };
  // A payment already marked "failed" (e.g. a declined attempt) can still be the
  // one Razorpay later reports as captured, on a retry within the same order.
  if (!["pending", "failed"].includes(pending.status)) return { ignored: `payment is ${pending.status}` };

  if (currency !== "INR" || amountPaise !== Math.round(pending.amount * 100)) {
    await prisma.payment.updateMany({
      where: { id: pending.id, status: "pending" },
      data: { note: `Needs review: gateway reported ${amountPaise} ${currency}, order was ${Math.round(pending.amount * 100)} INR` },
    });
    await prisma.$transaction(async (tx) => {
      await notifyStaffUsers(tx, pending.propertyId, "Online payment needs review", `Gateway amount did not match order ${orderId}. Not credited.`, "payment", "/manager/payments", "/owner/finance");
    });
    return { mismatch: true };
  }

  return prisma.$transaction(async (tx) => {
    // The charge lock serialises concurrent deliveries; re-read after taking it.
    const charge = await lockCharge(tx, pending.chargeId);
    const fresh = await tx.payment.findUnique({ where: { id: pending.id } });
    if (fresh.status === "captured") return { alreadyConfirmed: true };
    if (!["pending", "failed"].includes(fresh.status)) return { ignored: `payment is ${fresh.status}` };
    // Money was received, so it is always credited; if staff recorded a payment in
    // the meantime this overpays, which is flagged for a refund decision.
    const overpaid = pending.amount > (await balanceOf(tx, charge));
    const receiptNo = await nextReceiptNo(tx);
    await tx.payment.update({
      where: { id: pending.id },
      data: {
        status: "captured", receiptNo, reference: gatewayPaymentId || pending.reference, gatewayPaymentId, paidOn: new Date(todayISO()),
        note: overpaid ? "Online payment (Razorpay). OVERPAID: the due was already settled; review for refund." : "Online payment (Razorpay)",
      },
    });
    const st = await tx.studentProfile.findUnique({ where: { id: pending.studentId }, select: { name: true } });
    await logActivity(tx, { role: "student" }, st?.name ?? "Resident", "payment", `${st?.name ?? "A resident"} paid ${inr(pending.amount)} online (Razorpay)`, pending.propertyId, `/manager/students/${pending.studentId}`);
    await notifyStudentUsers(tx, pending.studentId, "Payment successful", `${inr(pending.amount)} paid. Receipt ${receiptNo}.`, "payment", "/student/rent");
    await notifyStaffUsers(tx, pending.propertyId, overpaid ? "Online payment needs review" : "Online payment received",
      overpaid ? `${inr(pending.amount)} paid online for a due that was already settled. Review for refund.` : `${inr(pending.amount)} paid online.`,
      "payment", "/manager/payments", "/owner/finance");
    return { confirmed: true };
  });
}

// The gateway reported a failed attempt: close the order so the student can retry.
export async function failWebhookPayment({ orderId }) {
  if (!orderId) return { ignored: "no order" };
  const { count } = await prisma.payment.updateMany({
    where: { gatewayOrderId: orderId, status: "pending" },
    data: { status: "failed", note: "Gateway reported the payment failed" },
  });
  return count ? { failed: true } : { ignored: "not pending" };
}

// ── Refunds ──────────────────────────────────────────────────────────────────
/**
 * Owner-only. Online (Razorpay) payments are refunded through Razorpay; cash and
 * bank payments are recorded as refunded by hand. `adjustCharge` also lowers the
 * charge by the same amount (deposit returned at move-out, goodwill waiver), so
 * the due stays settled; without it the student owes the refunded amount again.
 */
export async function refund(auth, actorName, paymentId, { amount, reason, adjustCharge = false }) {
  requireRole(auth, "owner");
  const p = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!p || !["captured", "simulated"].includes(p.status)) throw notFound("Payment");
  await assertPropertyAccess(auth, p.propertyId);
  const e = {};
  if (!(Number.isInteger(amount) && amount > 0)) e.amount = "Enter a whole-rupee amount greater than zero";
  if (!reason?.trim()) e.reason = "Give a reason for the refund";
  if (Object.keys(e).length) throw invalid(e);
  const viaGateway = Boolean(p.gatewayPaymentId) && p.status === "captured";
  if (viaGateway && env.payments.mode !== "razorpay") {
    throw notConfigured("This was an online payment. Refunds for it need online payments (Razorpay) to be set up.");
  }

  const row = await prisma.$transaction(async (tx) => {
    const charge = await lockCharge(tx, p.chargeId);
    const already = await tx.refund.aggregate({ where: { paymentId: p.id, ...countedRefund }, _sum: { amount: true } });
    const left = p.amount - (already._sum.amount ?? 0);
    if (amount > left) throw invalid({ amount: `At most ${inr(left)} of this payment can still be refunded` });
    if (adjustCharge && amount > charge.amount) throw invalid({ amount: "Cannot reduce the charge below zero" });
    if (adjustCharge) await tx.rentCharge.update({ where: { id: charge.id }, data: { amount: charge.amount - amount } });
    const r = await tx.refund.create({
      data: {
        refundNo: await nextRefundNo(tx), paymentId: p.id, chargeId: p.chargeId, studentId: p.studentId, propertyId: p.propertyId,
        amount, reason: reason.trim(), adjustCharge, createdBy: actorName,
        method: viaGateway ? "gateway" : "manual", status: viaGateway ? "pending" : "processed",
      },
    });
    const st = await tx.studentProfile.findUnique({ where: { id: p.studentId }, select: { name: true } });
    await logActivity(tx, auth, actorName, "payment", `Refunded ${inr(amount)} to ${st.name} (${r.refundNo}): ${reason.trim()}`, p.propertyId, `/manager/students/${p.studentId}`);
    await notifyStudentUsers(tx, p.studentId, "Refund issued", `${inr(amount)} is being refunded (${r.refundNo}). ${viaGateway ? "It reaches your account in 5–7 working days." : "Collect it from the hostel office."}`, "payment", "/student/rent");
    return r;
  });

  if (!viaGateway) return refundView(row);
  // Money only moves at the gateway once our record exists; a refusal is recorded as failed.
  try {
    const gw = await refundPayment(p.gatewayPaymentId, amount, { refundNo: row.refundNo, reason: reason.trim().slice(0, 200) });
    const updated = await prisma.refund.update({
      where: { id: row.id },
      data: { gatewayRefundId: gw.id, status: gw.status === "processed" ? "processed" : gw.status === "failed" ? "failed" : "pending" },
    });
    return refundView(updated);
  } catch (err) {
    await prisma.$transaction(async (tx) => {
      await tx.refund.update({ where: { id: row.id }, data: { status: "failed" } });
      if (adjustCharge) await tx.rentCharge.update({ where: { id: p.chargeId }, data: { amount: { increment: amount } } });
    });
    throw conflict(`Razorpay refused the refund${err.gatewayDescription ? `: ${err.gatewayDescription}` : ""}. Nothing was refunded.`);
  }
}

/** Razorpay webhook: refund.processed / refund.failed. Idempotent. */
export async function settleWebhookRefund({ gatewayRefundId, status }) {
  const r = gatewayRefundId ? await prisma.refund.findUnique({ where: { gatewayRefundId } }) : null;
  if (!r) return { ignored: "unknown refund" };
  if (r.status === status) return { alreadySettled: true };
  if (r.status === "failed") return { ignored: "refund already failed" };
  await prisma.$transaction(async (tx) => {
    await tx.refund.update({ where: { id: r.id }, data: { status } });
    if (status === "failed") {
      if (r.adjustCharge) await tx.rentCharge.update({ where: { id: r.chargeId }, data: { amount: { increment: r.amount } } });
      await notifyStaffUsers(tx, r.propertyId, "Refund failed", `Refund ${r.refundNo} of ${inr(r.amount)} failed at Razorpay and was not paid out.`, "payment", "/manager/payments", "/owner/finance");
    }
  });
  return { settled: status };
}

const refundView = (r) => ({ ...r, createdAt: r.createdAt.toISOString(), updatedAt: undefined });

export async function listRefunds(auth, filters = {}) {
  requireRole(auth, "owner", "manager");
  const where = await propertyScope(auth, filters.propertyId);
  if (filters.paymentId) where.paymentId = filters.paymentId;
  const rows = await prisma.refund.findMany({ where, orderBy: { createdAt: "desc" }, take: 500 });
  return rows.map(refundView);
}
