export const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
export const normalizePhone = (s) => String(s || "").replace(/\D/g, "").slice(-10);
export const isIndianPhone = (s) => /^[6-9]\d{9}$/.test(normalizePhone(s));
// YYYY-MM-DD that exists on the calendar. new Date() quietly rolls 2026-02-31 over to 3 March.
export const isCalendarDate = (s) => {
  const d = new Date(`${s}T00:00:00.000Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
};
