// Money and dates the way the web app shows them: ₹ with Indian grouping, and
// "today" in Asia/Kolkata (the API's business day), not the phone's zone.
const TZ = 'Asia/Kolkata';

export const inr = (n: number | undefined | null) =>
  `₹${Math.round(Number(n ?? 0)).toLocaleString('en-IN')}`;

/** YYYY-MM-DD for "today" in Asia/Kolkata. */
export function todayISO(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  return parts; // en-CA formats as YYYY-MM-DD
}

export function addDaysISO(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** "12 Nov 2026" for a date-only value (YYYY-MM-DD), no zone shift. */
export function date(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: iso.length === 10 ? 'UTC' : TZ }).format(d);
}

/** "12 Nov, 4:05 pm" for a timestamp. */
export function dateTime(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: TZ }).format(d);
}

/** "5 min ago", "3 h ago", "2 d ago", else a date. */
export function ago(iso: string, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 7 * 86400) return `${Math.floor(s / 86400)} d ago`;
  return date(iso);
}

/** "2026-11" → "Nov 2026". */
export function period(p?: string): string {
  if (!p || !/^\d{4}-\d{2}$/.test(p)) return p ?? '';
  return new Intl.DateTimeFormat('en-IN', { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${p}-01T00:00:00Z`));
}

/** "in_progress" → "In progress". */
export const humanize = (s?: string | null) => (s ? s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ') : '');

/** A real calendar date as YYYY-MM-DD. JS rolls "2026-02-30" over to March, so round-trip it. */
export function isISODate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}
export const isIndianPhone = (s: string) => /^[6-9]\d{9}$/.test(s.replace(/\D/g, '').slice(-10)) && s.replace(/\D/g, '').length >= 10;
