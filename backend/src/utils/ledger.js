import { prisma } from "../config/prisma.js";
import { counted, withBalance, todayISO } from "./money.js";

// Refunds that reduce what was paid on a charge. A failed refund returned nothing.
export const countedRefund = { status: { in: ["pending", "processed"] } };

/**
 * Money movements against charges, as rows `withBalance` can sum: each counted
 * payment is +amount and each counted refund -amount. Refunds that also reduced
 * the charge (deposit returned, goodwill) are excluded: the charge amount was
 * lowered by the same sum, so the balance stays settled.
 */
export async function ledgerRows(db, where) {
  const [payments, refunds] = await Promise.all([
    db.payment.findMany({ where: { ...where, ...counted }, select: { chargeId: true, studentId: true, amount: true } }),
    db.refund.findMany({ where: { ...where, ...countedRefund, adjustCharge: false }, select: { chargeId: true, studentId: true, amount: true } }),
  ]);
  return [...payments, ...refunds.map((r) => ({ ...r, amount: -r.amount }))];
}

/** Outstanding balance of one charge, using the given client (pass `tx` inside a lock). */
export async function balanceOf(db, charge) {
  const rows = await ledgerRows(db, { chargeId: charge.id });
  return withBalance(charge, rows, todayISO()).balance;
}

/** Total balance due per student, for the given students. */
export async function balancesByStudent(studentIds, db = prisma) {
  if (!studentIds.length) return new Map();
  const [charges, rows] = await Promise.all([
    db.rentCharge.findMany({ where: { studentId: { in: studentIds } } }),
    ledgerRows(db, { studentId: { in: studentIds } }),
  ]);
  const today = todayISO();
  const m = new Map();
  for (const c of charges) m.set(c.studentId, (m.get(c.studentId) ?? 0) + withBalance(c, rows, today).balance);
  return m;
}
