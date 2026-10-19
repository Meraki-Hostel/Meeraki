// Charge status + balance derivations — identical logic to the frontend base.ts.
export function chargeStatus(amount, paid, dueDateISO, todayISO) {
  if (paid >= amount) return "paid";
  if (todayISO > dueDateISO) return "overdue";
  if (paid > 0) return "partial";
  return "pending";
}

export function withBalance(charge, payments, todayISO) {
  const paid = payments
    .filter((p) => p.chargeId === charge.id)
    .reduce((a, p) => a + p.amount, 0);
  return {
    ...charge,
    paid,
    balance: Math.max(0, charge.amount - paid),
    status: chargeStatus(charge.amount, paid, iso(charge.dueDate), todayISO),
  };
}

// Dates in the DB are DateTime; the frontend expects ISODate (YYYY-MM-DD).
export const iso = (d) => (d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10));
export const todayISO = () => new Date().toISOString().slice(0, 10);
export const currentPeriod = () => new Date().toISOString().slice(0, 7);
