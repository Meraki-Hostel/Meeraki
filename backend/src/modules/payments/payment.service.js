import { prisma } from "../../config/prisma.js";
import { env } from "../../config/env.js";
import { invalid, notFound, forbidden, conflict, notConfigured } from "../../utils/ApiError.js";
import { requireRole, propertyScope, assertPropertyAccess } from "../../utils/scope.js";
import { withBalance, iso, todayISO, currentPeriod, currentYear, counted } from "../../utils/money.js";
import { createOrder } from "./payment.gateway.js";
import { logActivity, notifyStudentUsers, notifyStaffUsers, nextCounter } from "../../utils/effects.js";

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

async function nextReceiptNo(tx) {
  return `RCPT-${currentYear()}-${String(await nextCounter(tx, "receipt")).padStart(4, "0")}`;
}

// Serialises every write against one charge (record, pay-now, webhook), so two
// payments can never both pass the balance check.
async function lockCharge(tx, chargeId) {
  await tx.$queryRaw`SELECT "id" FROM "RentCharge" WHERE "id" = ${chargeId} FOR UPDATE`;
  return tx.rentCharge.findUnique({ where: { id: chargeId } });
}

async function balanceOf(tx, charge) {
  const paid = await tx.payment.findMany({ where: { chargeId: charge.id, ...counted }, select: { chargeId: true, amount: true } });
  return withBalance(charge, paid, todayISO()).balance;
}

// Inserts a Payment row + receipt number. Caller supplies the resolved amount.
async function insertPayment(tx, auth, actorName, { chargeId, studentId, propertyId, amount, method, paidOn, reference, note, gatewayOrderId, gatewayPaymentId, status = "captured" }) {
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

  const charges = await prisma.rentCharge.findMany({ where });
  const payments = await prisma.payment.findMany({
    where: { chargeId: { in: charges.map((c) => c.id) }, ...counted },
    select: { chargeId: true, amount: true },
  });
  const today = todayISO();
  const { sById, pById, rById } = await lookupsFor(charges);

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
  const where = { ...counted }; // open or failed gateway attempts are not payments
  if (auth.role === "student") where.studentId = auth.studentId;
  else Object.assign(where, await propertyScope(auth, filters.propertyId));
  if (filters.studentId && auth.role !== "student") where.studentId = filters.studentId;
  if (filters.method) where.method = filters.method;

  const payments = await prisma.payment.findMany({ where });
  const { sById, pById } = await lookupsFor(payments);
  const chargePeriods = new Map(
    (await prisma.rentCharge.findMany({ where: { id: { in: [...new Set(payments.map((p) => p.chargeId))] } }, select: { id: true, period: true } }))
      .map((c) => [c.id, c.period]),
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
  const where = { ...(await chargeScopeWhere(auth, filters.propertyId)) };
  const period = filters.period ?? currentPeriod();
  if (period !== "all") where.period = period;

  const charges = await prisma.rentCharge.findMany({ where });
  const payments = await prisma.payment.findMany({
    where: { chargeId: { in: charges.map((c) => c.id) }, ...counted },
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
  if (!p || !["captured", "simulated"].includes(p.status)) throw notFound("Receipt"); // no receipt for money not received
  if (auth.role === "student" && p.studentId !== auth.studentId) throw forbidden();
  if (auth.role !== "student") await assertPropertyAccess(auth, p.propertyId);

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
  const found = await prisma.rentCharge.findUnique({ where: { id: input.chargeId } });
  if (!found) throw invalid({ chargeId: "Choose a due to pay against" });
  await assertPropertyAccess(auth, found.propertyId);

  const e = {};
  if (!(input.amount > 0)) e.amount = "Amount must be greater than zero";
  if (!input.paidOn) e.paidOn = "Payment date is required";
  else if (input.paidOn > todayISO()) e.paidOn = "Payment date cannot be in the future";
  if (input.method !== "cash" && !input.reference.trim()) e.reference = "Reference / UTR is required for non-cash payments";
  if (Object.keys(e).length) throw invalid(e);

  const created = await prisma.$transaction(async (tx) => {
    const charge = await lockCharge(tx, found.id);
    const balance = await balanceOf(tx, charge);
    if (input.amount > balance) throw invalid({ amount: `Amount cannot exceed the balance of ${inr(balance)}` });
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
  const payments = await prisma.payment.findMany({ where: { chargeId: { in: chargeIds }, ...counted }, select: { chargeId: true, amount: true } });
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
// - disabled (default): online payment is not set up → NOT_CONFIGURED. Staff record payments.
// - simulated (local development only; production refuses to start with it):
//   records a "simulated" payment, clearly labelled, no money moved.
// - razorpay: creates (or reuses) a gateway Order and returns it as pending.
//   Nothing counts as paid until the signed webhook confirms the capture.
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
      receipt: `charge_${charge.id}`,
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
    const p = await insertPayment(tx, auth, actorName, {
      chargeId: charge.id, studentId: charge.studentId, propertyId: charge.propertyId, status: "simulated",
      amount: balance, method: gatewayMethod, paidOn: todayISO(),
      reference: `SIM${Date.now().toString().slice(-9)}`, note: "Simulated online payment (demo, no money moved)",
    });
    await logActivity(tx, auth, actorName, "payment", `${actorName} paid ${inr(balance)} online (simulated, no money moved)`, charge.propertyId, `/manager/students/${charge.studentId}`);
    await notifyStaffUsers(tx, charge.propertyId, "Simulated payment", `${actorName} paid ${inr(balance)} (simulated, no money moved).`, "payment", "/manager/payments", "/owner/finance");
    await notifyStudentUsers(tx, charge.studentId, "Simulated payment recorded", `${inr(balance)} (simulated, no money moved). Receipt ${p.receiptNo}.`, "payment", "/student/rent");
    return p;
  });
  return { ...created, paidOn: iso(created.paidOn) };
}

function pendingResponse(orderId, amountRupees) {
  return {
    pending: true,
    order: { id: orderId, amount: Math.round(amountRupees * 100), currency: "INR" },
    keyId: env.payments.razorpayKeyId,
  };
}

// Called only after the webhook signature has been verified. Idempotent: a replay,
// or a concurrent delivery of the same event, confirms the payment at most once.
// The captured amount and currency must match the order exactly; anything else is
// left pending and flagged for staff instead of being guessed at.
export async function confirmWebhookPayment({ orderId, gatewayPaymentId, amountPaise, currency }) {
  const pending = orderId ? await prisma.payment.findUnique({ where: { gatewayOrderId: orderId } }) : null;
  if (!pending) return { ignored: "unknown order" };
  if (pending.status === "captured") return { alreadyConfirmed: true };
  if (pending.status !== "pending") return { ignored: `payment is ${pending.status}` };

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
    if (fresh.status !== "pending") return { alreadyConfirmed: true };
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
    await notifyStudentUsers(tx, pending.studentId, "Payment successful", `${inr(pending.amount)} paid. Receipt ${receiptNo}.`, "payment", "/student/rent");
    await notifyStaffUsers(tx, pending.propertyId, "Online payment received", `${inr(pending.amount)} paid online.`, "payment", "/manager/payments", "/owner/finance");
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
