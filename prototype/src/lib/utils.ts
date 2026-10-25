import { clsx, type ClassValue } from 'clsx'

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs)
}

/**
 * The prototype runs on a fixed demo calendar day so that seeded data
 * ("today's visitors", "due on 5 Oct") always reads correctly.
 * The time of day is real, so new actions still get sensible timestamps.
 */
export const DEMO_TODAY = '2026-09-25'

export function now(): Date {
  const real = new Date()
  const d = new Date(`${DEMO_TODAY}T00:00:00`)
  d.setHours(real.getHours(), real.getMinutes(), real.getSeconds(), real.getMilliseconds())
  return d
}

export function nowIso() {
  return now().toISOString()
}

export function todayStart(): Date {
  return new Date(`${DEMO_TODAY}T00:00:00`)
}

export function uid(prefix = 'id') {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-3)}`
}

const inr = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 })

export function formatINR(n: number) {
  return `₹${inr.format(Math.round(n))}`
}

/** ₹24.8L, ₹1.2Cr, ₹42K */
export function compactINR(n: number) {
  const abs = Math.abs(n)
  const sign = n < 0 ? '-' : ''
  if (abs >= 1e7) return `${sign}₹${trim(abs / 1e7)}Cr`
  if (abs >= 1e5) return `${sign}₹${trim(abs / 1e5)}L`
  if (abs >= 1e3) return `${sign}₹${trim(abs / 1e3)}K`
  return `${sign}₹${abs}`
}

function trim(n: number) {
  return n >= 100 ? n.toFixed(0) : n.toFixed(1).replace(/\.0$/, '')
}

export function formatNumber(n: number) {
  return inr.format(n)
}

export function pct(n: number, digits = 1) {
  return `${(n * 100).toFixed(digits).replace(/\.0$/, '')}%`
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

function toDate(d: string | Date) {
  if (d instanceof Date) return d
  return d.length === 10 ? new Date(`${d}T00:00:00`) : new Date(d)
}

/** 25 Sep 2026 */
export function formatDate(d: string | Date, opts: { year?: boolean } = {}) {
  const x = toDate(d)
  const year = opts.year ?? x.getFullYear() !== todayStart().getFullYear()
  return `${x.getDate()} ${MONTHS[x.getMonth()]}${year ? ` ${x.getFullYear()}` : ''}`
}

export function formatDateLong(d: string | Date) {
  const x = toDate(d)
  return `${x.getDate()} ${MONTHS_LONG[x.getMonth()]} ${x.getFullYear()}`
}

export function formatTime(d: string | Date) {
  const x = toDate(d)
  let h = x.getHours()
  const m = x.getMinutes()
  const ampm = h >= 12 ? 'PM' : 'AM'
  h = h % 12 || 12
  return `${h}:${m.toString().padStart(2, '0')} ${ampm}`
}

export function formatDateTime(d: string | Date) {
  return `${formatDate(d)}, ${formatTime(d)}`
}

export function weekday(d: string | Date) {
  return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][toDate(d).getDay()]
}

export function cycleLabel(cycle: string, long = false) {
  const [y, m] = cycle.split('-').map(Number)
  return `${(long ? MONTHS_LONG : MONTHS)[m - 1]} ${y}`
}

export function monthShort(m: number) {
  return MONTHS[m]
}

export function isoDate(d: Date) {
  const y = d.getFullYear()
  const m = (d.getMonth() + 1).toString().padStart(2, '0')
  const day = d.getDate().toString().padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function addDays(d: Date, n: number) {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

export function sameDay(a: string | Date, b: string | Date) {
  return isoDate(toDate(a)) === isoDate(toDate(b))
}

export function daysBetween(a: string | Date, b: string | Date) {
  const ms = toDate(b).setHours(0, 0, 0, 0) - toDate(a).setHours(0, 0, 0, 0)
  return Math.round(ms / 86400000)
}

export function timeAgo(d: string | Date) {
  const diff = (now().getTime() - toDate(d).getTime()) / 1000
  if (diff < 45) return 'just now'
  if (diff < 3600) return `${Math.round(diff / 60)}m ago`
  if (diff < 86400) return `${Math.round(diff / 3600)}h ago`
  const days = Math.round(diff / 86400)
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days}d ago`
  return formatDate(d)
}

export function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

export function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('')
}

export function firstName(name: string) {
  return name.split(' ')[0]
}

export function sum<T>(arr: T[], f: (x: T) => number) {
  let s = 0
  for (const x of arr) s += f(x)
  return s
}

export function groupBy<T, K extends string | number>(arr: T[], f: (x: T) => K) {
  const out = {} as Record<K, T[]>
  for (const x of arr) {
    const k = f(x)
    ;(out[k] ||= []).push(x)
  }
  return out
}

/** Deterministic PRNG so the seed data is identical on every reset. */
export function mulberry32(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

export function formatPhone(p: string) {
  const d = p.replace(/\D/g, '').slice(-10)
  return d.length === 10 ? `+91 ${d.slice(0, 5)} ${d.slice(5)}` : p
}
