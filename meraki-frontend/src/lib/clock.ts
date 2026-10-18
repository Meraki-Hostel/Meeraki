/**
 * Demo clock. The seed data is anchored to 18 Oct 2026 so dues, overdue
 * states and "upcoming" lists stay deterministic regardless of when the demo
 * is opened. Time-of-day follows the real clock so new records sort naturally.
 */
export const DEMO_TODAY = '2026-10-18';
export const TIMEZONE = 'Asia/Kolkata';

export function now(): Date {
  const real = new Date();
  const [y, m, d] = DEMO_TODAY.split('-').map(Number);
  return new Date(y, m - 1, d, real.getHours(), real.getMinutes(), real.getSeconds(), real.getMilliseconds());
}
export const nowISO = (): string => now().toISOString();
export const todayISO = (): string => DEMO_TODAY;
export const currentPeriod = (): string => DEMO_TODAY.slice(0, 7);

export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00`);
  d.setDate(d.getDate() + days);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export function daysBetween(a: string, b: string): number {
  const da = new Date(`${a.slice(0, 10)}T00:00:00`).getTime();
  const db = new Date(`${b.slice(0, 10)}T00:00:00`).getTime();
  return Math.round((db - da) / 86_400_000);
}

/** ISO timestamp on a given date/time (local IST semantics for the demo). */
export function stamp(date: string, time = '10:00'): string {
  return new Date(`${date}T${time}:00+05:30`).toISOString();
}

export function greeting(): string {
  const h = now().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}
