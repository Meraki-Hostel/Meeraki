import { TIMEZONE } from './clock';

const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
const inrCompact = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', notation: 'compact', maximumFractionDigits: 1 });
const num = new Intl.NumberFormat('en-IN');

export const formatINR = (n: number): string => inr.format(n);
export const formatINRCompact = (n: number): string => inrCompact.format(n);
export const formatNumber = (n: number): string => num.format(n);
export const formatPct = (n: number, digits = 0): string => `${n.toFixed(digits)}%`;

function toDate(v: string): Date {
  return v.length === 10 ? new Date(`${v}T12:00:00+05:30`) : new Date(v);
}

/** 18 Oct 2026 */
export function formatDate(v?: string): string {
  if (!v) return '—';
  return toDate(v).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: TIMEZONE });
}
/** Sun, 18 Oct 2026 */
export function formatDateLong(v: string): string {
  return toDate(v).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: TIMEZONE });
}
/** 18 Oct */
export function formatDateShort(v: string): string {
  return toDate(v).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: TIMEZONE });
}
/** 18 Oct 2026, 4:30 pm */
export function formatDateTime(v?: string): string {
  if (!v) return '—';
  return toDate(v).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: TIMEZONE });
}
export function formatTime(v: string): string {
  return toDate(v).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', timeZone: TIMEZONE });
}
/** "14:30" → "2:30 pm" */
export function formatClock(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  const suffix = h >= 12 ? 'pm' : 'am';
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${suffix}`;
}
/** 2026-10 → October 2026 */
export function formatPeriod(p: string): string {
  return toDate(`${p}-01`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: TIMEZONE });
}
export function formatPeriodShort(p: string): string {
  return toDate(`${p}-01`).toLocaleDateString('en-GB', { month: 'short', timeZone: TIMEZONE });
}

export function relativeTime(iso: string, ref: Date): string {
  const diff = (ref.getTime() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} h ago`;
  const days = Math.floor(diff / 86400);
  if (days < 7) return `${days} d ago`;
  return formatDate(iso);
}

/** +91 98765 43210 */
export function formatPhone(p: string): string {
  const digits = p.replace(/\D/g, '').slice(-10);
  if (digits.length !== 10) return p;
  return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
}

export function initials(name: string): string {
  return name.replace(/^(Mr|Mrs|Ms|Dr)\.?\s+/i, '').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('');
}

export function titleCase(s: string): string {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
export function sentenceCase(s: string): string {
  const t = s.replace(/_/g, ' ');
  return t.charAt(0).toUpperCase() + t.slice(1);
}
