import { prisma } from "../../config/prisma.js";
import { env } from "../../config/env.js";
import { invalid, notFound, forbidden, conflict } from "../../utils/ApiError.js";
import { requireRole, scopeProperty, assertPropertyAccess } from "../../utils/scope.js";
import { withBalance, iso, todayISO, currentPeriod } from "../../utils/money.js";
import { createOrder } from "./payment.gateway.js";

const inr = (n) => `₹${Number(n).toLocaleString("en-IN")}`;

// ── Shared helpers ───────────────────────────────────────────────────────────
async function lookups() {
  const [students, properties, rooms] = await Promise.all([
    prisma.studentProfile.findMany({ select: { id: true, name: true, studentCode: true, roomId: true } }),
    prisma.property.findMany({ select: { id: true, name: true } }),
    prisma.room.findMany({ select: { id: true, number: true } }),
  ]);
  const sById = new Map(students.map((s) => [s.id, s]));
  const pById = new Map(properties.map((p) => [p.id, p.name]));
  const rById = new Map(rooms.map((r) => [r.id, r.number]));
  return { sById, pById, rById };
}

// Receipt sequence via an atomic counter inside a transaction.
async function nextReceiptNo(tx) {
  const c = await tx.counter.upsert({
    where: { key: "receipt" },
    update: { value: { increment: 1 } },
    create: { key: "receipt", value: 1 },
  });
  return `RCPT-${new Date().getFullYear()}-${String(c.value).padStart(4, "0")}`;
}

async function logActivity(tx, auth, actorName, category, message, propertyId, link) {
  await tx.activityLog.create({
    data: { propertyId, actorName, actorRole: auth?.role ?? "system", category, message, link },
  });
}
async function notifyStudentUsers(tx, studentId, title, body, category, link) {
  const users = await tx.user.findMany({ where: { studentId }, select: { id: true } });
  if (users.length)
    await tx.notification.createMany({
      data: users.map((u) => ({ recipientUserId: u.id, title, body, category, link })),
    });
}
async function notifyStaffUsers(tx, propertyId, title, body, category, managerLink, ownerLink) {
  const mgrs = await tx.user.findMany({ where: { role: "manager", propertyId }, select: { id: true } });
  const owners = ownerLink ? await tx.user.findMany({ where: { role: "owner" }, select: { id: true } }) : [];
  const rows = [
    ...mgrs.map((u) => ({ recipientUserId: u.id, title, body, category, link: managerLink })),
    ...owners.map((u) => ({ recipientUserId: u.id, title, body, category, link: ownerLink })),
  ];
  if (rows.length) await tx.notification.createMany({ data: rows });
}

// Inserts a Payment row + receipt number. Caller supplies the resolved amount.
async function insertPayment(tx, auth, actorName, { chargeId, studentId, propertyId, amount, method, paidOn, reference, note, gatewayOrderId, gatewayPaymentId }) {
  const receiptNo = await nextReceiptNo(tx);
  return tx.payment.create({
    data: {
      chargeId, studentId, propertyId, amount, method,
      paidOn: new Date(paidOn), reference: reference || `DEMO${Date.now().toString().slice(-8)}`,
      receiptNo, recordedBy: actorName, note: note || null,
      gatewayOrderId: gatewayOrderId || null, gatewayPaymentId: gatewayPaymentId || null,
    },
  });
}

// Charges a given auth can see, scoped like the frontend.
function chargeScopeWhere(auth, propertyId) {
  if (auth.role === "student") return { studentId: auth.studentId };
  const pid = scopeProperty(auth, propertyId);
  return pid ? { propertyId: pid } : {};
}

// ── Reads ────────────────────────────────────────────────────────────────────
export async function listCharges(auth, filters = {}) {
  const where = { ...chargeScopeWhere(auth, filters.propertyId) };
  if (filters.studentId) where.studentId = filters.studentId;
  if (filters.period) where.period = filters.period;

  const charges = await prisma.rentCharge.findMany({ where });
  const payments = await prisma.payment.findMany({
    where: { chargeId: { in: charges.map((c) => c.id) } },
    select: { chargeId: true, amount: true },
  });
  const today = todayISO();
  const { sById, pById, rById } = await lookups();

  return charges
    .map((c) => withBalance(c, payments, today))
    .filter((c) => !filters.status || c.status === filters.status)
    .map((c) => {
      const st = sById.get(c.studentId);
      return {
        ...c, dueDate: iso(c.dueDate),
        studentName: st?.name ?? "Unknown", studentCode: st?.studentCode ?? "",
        roomNumber: st?.roomId ? rById.get(st.roomId) : undefined,
        propertyName: pById.get(c.propertyId) ?? "—",
      };
    })
    .sort((a, b) => b.period.localeCompare(a.period) || a.dueDate.localeCompare(b.dueDate));
}

export async function listPayments(auth, filters = {}) {
  const where = {};
  if (auth.role === "student") where.studentId = auth.studentId;
  else {
    const pid = scopeProperty(auth, filters.propertyId);
    if (pid) where.propertyId = pid;
  }
  if (filters.studentId) where.studentId = filters.studentId;
  if (filters.method) where.method = filters.method;

  const payments = await prisma.payment.findMany({ where });
  const { sById, pById } = await lookups();
  const chargePeriods = new Map(
    (await prisma.rentCharge.findMany({ select: { id: true, period: true } })).map((c) => [c.id, c.period])
  );

  return payments
    .map((p) => ({ ...p, paidOn: iso(p.paidOn) }))
    .filter((p) => !filters.from || p.paidOn >= filters.from)
    .filter((p) => !filters.to || p.paidOn <= filters.to)
    .map((p) => {
      const st = sById.get(p.studentId);
      return {
        ...p, studentName: st?.name ?? "Unknown", studentCode: st?.studentCode ?? "",
        propertyName: pById.get(p.propertyId) ?? "—", period: chargePeriods.get(p.chargeId) ?? "",
      };
    })
    .sort((a, b) => b.paidOn.localeCompare(a.paidOn) || b.receiptNo.localeCompare(a.receiptNo));
}

export async function summary(auth, filters = {}) {
  const where = { ...chargeScopeWhere(auth, filters.propertyId) };
  const period = filters.period ?? currentPeriod();
  if (period !== "all") where.period = period;

  const charges = await prisma.rentCharge.findMany({ where });
  const payments = await prisma.payment.findMany({
    where: { chargeId: { in: charges.map((c) => c.id) } },
    select: { chargeId: true, amount: true },
  });
  const today = todayISO();
  const wb = charges.map((c) => withBalance(c, payments, today));

  const expected = wb.reduce((a, c) => a + c.amount, 0);
  const collected = wb.reduce((a, c) => a + Math.min(c.paid, c.amount), 0);
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
  if (!p) throw notFound("Receipt");
  if (auth.role === "student" && p.studentId !== auth.studentId) throw forbidden();
  if (auth.role !== "student") assertPropertyAccess(auth, p.propertyId);

  const [charge, student, property] = await Promise.all([
    prisma.rentCharge.findUnique({ where: { id: p.chargeId } }),
    prisma.studentProfile.findUnique({ where: { id: p.studentId } }),
    prisma.property.findUnique({ where: { id: p.propertyId } }),
  ]);
  const bed = student?.bedId ? await prisma.bed.findUnique({ where: { id: student.bedId } }) : null;
  const room = student?.roomId ? await prisma.room.findUnique({ where: { id: student.roomId } }) : null;

  return {
    receiptNo: p.receiptNo,
    payment: { ...p, paidOn: iso(p.paidOn) },
    charge: { ...charge, dueDate: iso(charge.dueDate) },
    student: { id: student.id, name: student.name, studentCode: student.studentCode, phone: student.phone },
    property: { id: property.id, name: property.name, address: property.address },
    roomLabel: room ? `Room ${room.number}${bed ? `, Bed ${bed.label}` : ""}` : "Not allotted",
  };
}

// ── Writes ───────────────────────────────────────────────────────────────────
export async function recordPayment(auth, actorName, input) {
  requireRole(auth, "owner", "manager");
  const charge = await prisma.rentCharge.findUnique({ where: { id: input.chargeId } });
  if (!charge) throw invalid({ chargeId: "Choose a due to pay against" });
  assertPropertyAccess(auth, charge.propertyId);

  const existing = await prisma.payment.findMany({ where: { chargeId: charge.id }, select: { chargeId: true, amount: true } });
  const { balance } = withBalance(charge, existing, todayISO());

  const e = {};
  if (!(input.amount > 0)) e.amount = "Amount must be greater than zero";
  else if (input.amount > balance) e.amount = `Amount cannot exceed the balance of ${inr(balance)}`;
  if (!input.paidOn) e.paidOn = "Payment date is required";
  else if (input.paidOn > todayISO()) e.paidOn = "Payment date cannot be in the future";
  if (input.method !== "cash" && !input.reference.trim()) e.reference = "Reference / UTR is required for non-cash payments";
  if (Object.keys(e).length) throw invalid(e);

  const created = await prisma.$transaction(async (tx) => {
    const p = await insertPayment(tx, auth, actorName, {
      chargeId: charge.id, studentId: charge.studentId, propertyId: charge.propertyId,
      amount: input.amount, method: input.method, paidOn: input.paidOn,
      reference: input.reference.trim(), note: input.note?.trim(),
    });
    const st = await tx.studentProfile.findUnique({ where: { id: charge.studentId }, select: { name: true } });
    await logActivity(tx, auth, actorName, "payment", `Recorded ${inr(input.amount)} ${input.method.replace("_", " ")} payment from ${st.name}`, charge.propertyId, `/manager/students/${charge.studentId}`);
    await notifyStudentUsers(tx, charge.studentId, "Payment received", `${inr(input.amount)} received. Receipt ${p.receiptNo}.`, "payment", "/student/rent");
    return p;
  });
  return { ...created, paidOn: iso(created.paidOn) };
}

export async function sendReminders(auth, actorName, chargeIds) {
  requireRole(auth, "owner", "manager");
  if (!chargeIds.length) throw invalid({ chargeIds: "Select at least one due" });
  const charges = await prisma.rentCharge.findMany({ where: { id: { in: chargeIds } } });
  const payments = await prisma.payment.findMany({ where: { chargeId: { in: chargeIds } }, select: { chargeId: true, amount: true } });
  const today = todayISO();

  let count = 0;
  await prisma.$transaction(async (tx) => {
    for (const ch of charges) {
      if (auth.role === "manager" && ch.propertyId !== auth.propertyId) continue;
      const wb = withBalance(ch, payments, today);
      if (wb.balance <= 0) continue;
      await notifyStudentUsers(tx, ch.studentId, "Rent reminder", `${inr(wb.balance)} is due for ${ch.period}. Due date: ${iso(ch.dueDate)}.`, "payment", "/student/rent");
      count++;
    }
    if (count) await logActivity(tx, auth, actorName, "payment", `Sent rent reminders to ${count} resident${count > 1 ? "s" : ""}`, auth.propertyId, "/manager/payments");
  });
  return count;
}

// payNow: student self-service online payment.
// - simulated mode: posts a completed payment immediately (mirrors the frontend demo).
// - razorpay mode: creates an Order and returns it; the actual Payment row is
//   created by the verified webhook (see confirmWebhookPayment). The frontend
//   should then use Razorpay Checkout with the returned order.
export async function payNow(auth, actorName, chargeId, method) {
  requireRole(auth, "student");
  const charge = await prisma.rentCharge.findUnique({ where: { id: chargeId } });
  if (!charge) throw notFound("Due");
  if (charge.studentId !== auth.studentId) throw forbidden();
  const existing = await prisma.payment.findMany({ where: { chargeId: charge.id }, select: { chargeId: true, amount: true } });
  const { balance } = withBalance(charge, existing, todayISO());
  if (balance <= 0) throw conflict("This due is already paid.");

  if (env.payments.mode === "razorpay") {
    const order = await createOrder({
      amountRupees: balance,
      receipt: `charge_${charge.id}`,
      notes: { chargeId: charge.id, studentId: charge.studentId, propertyId: charge.propertyId, method },
    });
    // Persist the pending order so the webhook can reconcile idempotently.
    await prisma.payment.create({
      data: {
        chargeId: charge.id, studentId: charge.studentId, propertyId: charge.propertyId,
        amount: balance, method: method === "netbanking" ? "bank_transfer" : method,
        paidOn: new Date(), reference: `PENDING_${order.id}`, receiptNo: `PENDING-${order.id}`,
        recordedBy: actorName, note: "Awaiting gateway confirmation", gatewayOrderId: order.id,
      },
    });
    return { pending: true, order, keyId: env.payments.razorpayKeyId };
  }

  // Simulated mode (default) — matches the frontend mock exactly.
  const created = await prisma.$transaction(async (tx) => {
    const p = await insertPayment(tx, auth, actorName, {
      chargeId: charge.id, studentId: charge.studentId, propertyId: charge.propertyId,
      amount: balance, method: method === "netbanking" ? "bank_transfer" : method,
      paidOn: todayISO(), reference: `SIM${Date.now().toString().slice(-9)}`, note: "Simulated online payment (demo)",
    });
    await logActivity(tx, auth, actorName, "payment", `${actorName} paid ${inr(balance)} online (simulated)`, charge.propertyId, `/manager/students/${charge.studentId}`);
    await notifyStaffUsers(tx, charge.propertyId, "Online payment received", `${actorName} paid ${inr(balance)} (simulated).`, "payment", "/manager/payments", "/owner/finance");
    await notifyStudentUsers(tx, charge.studentId, "Payment successful", `${inr(balance)} paid. Receipt ${p.receiptNo}.`, "payment", "/student/rent");
    return p;
  });
  return { ...created, paidOn: iso(created.paidOn) };
}

// Called by the verified Razorpay webhook. Idempotent on gatewayOrderId.
export async function confirmWebhookPayment({ orderId, gatewayPaymentId }) {
  const pending = await prisma.payment.findUnique({ where: { gatewayOrderId: orderId } });
  if (!pending) return { ignored: true }; // unknown order
  if (!pending.receiptNo.startsWith("PENDING-")) return { alreadyConfirmed: true };

  await prisma.$transaction(async (tx) => {
    const receiptNo = await nextReceiptNo(tx);
    await tx.payment.update({
      where: { id: pending.id },
      data: { receiptNo, reference: gatewayPaymentId || pending.reference, gatewayPaymentId, note: "Online payment (Razorpay)" },
    });
    await notifyStudentUsers(tx, pending.studentId, "Payment successful", `${inr(pending.amount)} paid. Receipt ${receiptNo}.`, "payment", "/student/rent");
    await notifyStaffUsers(tx, pending.propertyId, "Online payment received", `${inr(pending.amount)} paid online.`, "payment", "/manager/payments", "/owner/finance");
  });
  return { confirmed: true };
}
