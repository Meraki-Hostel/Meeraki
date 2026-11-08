/**
 * Business clock. "Today", the billing month and greetings follow Indian time
 * (Asia/Kolkata), whatever the device's own zone is, and always the real date.
 * The API uses the same zone (backend APP_TIMEZONE), so both sides agree on
 * which day and month it is.
 */
export const TIMEZONE = 'Asia/Kolkata';

const dayFmt = new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' });
const hourFmt = new Intl.DateTimeFormat('en-GB', { timeZone: TIMEZONE, hour: '2-digit', hourCycle: 'h23' });

export const now = (): Date => new Date();
export const nowISO = (): string => now().toISOString();
/** YYYY-MM-DD in Indian time. */
export const todayISO = (): string => dayFmt.format(now());
/** YYYY-MM in Indian time. */
export const currentPeriod = (): string => todayISO().slice(0, 7);

/** The current billing month and the n-1 before it, newest first: ['2026-10', '2026-09', …]. */
export function recentPeriods(n: number, from = currentPeriod()): string[] {
  const [y, m] = from.split('-').map(Number);
  return Array.from({ length: n }, (_, i) => {
    const idx = y * 12 + (m - 1) - i;
    return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, '0')}`;
  });
}
export const previousPeriod = (period: string): string => recentPeriods(2, period)[1]!;

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

/** ISO timestamp on a given date/time in Indian time. */
export function stamp(date: string, time = '10:00'): string {
  return new Date(`${date}T${time}:00+05:30`).toISOString();
}

export function greeting(): string {
  const h = Number(hourFmt.format(now()));
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}
