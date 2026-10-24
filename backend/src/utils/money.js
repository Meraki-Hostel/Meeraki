import { env } from "../config/env.js";

// Payments that count toward a balance. Pending and failed gateway attempts never do;
// "simulated" exists only in local development (production refuses that mode).
export const COUNTED_STATUSES = ["captured", "simulated"];
export const counted = { status: { in: COUNTED_STATUSES } };

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
// Business dates follow APP_TIMEZONE (default Asia/Kolkata), not the server's UTC clock:
// at 00:30 IST on the 1st the server is still on the previous UTC day.
const formatters = new Map();
function dayFormatter(tz) {
  if (!formatters.has(tz)) {
    // en-CA formats as YYYY-MM-DD
    formatters.set(tz, new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }));
  }
  return formatters.get(tz);
}
export const todayISO = (now = new Date()) => dayFormatter(env.timezone).format(now);
export const currentPeriod = (now = new Date()) => todayISO(now).slice(0, 7);
export const currentYear = (now = new Date()) => todayISO(now).slice(0, 4);
