import type { AppData } from './types'
import { addDays, monthShort, sum, todayStart } from './utils'
import { THIS_MONTH, propertyStats } from '../store/selectors'

/**
 * Historical trends are synthesised deterministically from each property's current
 * state (there is no backend history). The latest point is always the live value,
 * so prototype actions (payments, expenses, allocations) move the charts.
 */
export type Range = '7d' | '30d' | '6m' | 'ytd'
export const RANGES: { value: Range; label: string }[] = [
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '6m', label: 'Last 6 months' },
  { value: 'ytd', label: 'This year' },
]

function noise(seed: string) {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619)
  return ((h >>> 0) % 1000) / 1000 - 0.5
}

// Month index 0 = Jan. Seasonal occupancy curve for an Indian student hostel.
const OCC_CURVE = [0.9, 0.9, 0.88, 0.8, 0.74, 0.8, 0.92, 0.98, 1, 1, 1, 1]

export interface MonthPoint {
  label: string
  occupancy: number
  revenue: number
  expenses: number
  maintenance: number
  net: number
}

export function monthlySeries(d: AppData, pid: string | 'all', range: '6m' | 'ytd'): MonthPoint[] {
  const cur = 8 // September
  const months = range === 'ytd' ? Array.from({ length: cur + 1 }, (_, i) => i) : Array.from({ length: 6 }, (_, i) => cur - 5 + i)
  const pids = pid === 'all' ? d.properties.map((p) => p.id) : [pid]
  return months.map((m) => {
    let occ = 0
    let beds = 0
    let revenue = 0
    let expenses = 0
    let maintenance = 0
    for (const id of pids) {
      const s = propertyStats(d, id)
      beds += s.totalBeds
      if (m === cur) {
        occ += s.occupied
        revenue += s.collectedThisMonth
        expenses += s.expensesThisMonth
        maintenance += s.maintenanceCostThisMonth
      } else {
        const f = OCC_CURVE[m]! / OCC_CURVE[cur]!
        const o = Math.min(s.totalBeds, Math.round(s.occupied * f * (1 + noise(`${id}o${m}`) * 0.03)))
        occ += o
        const avgRent = s.expectedCurrent / Math.max(1, s.activeStudents)
        // collections in a month also include some advance payments for the next cycle
        revenue += Math.round(o * avgRent * (1.04 + noise(`${id}r${m}`) * 0.06))
        const mExp = Math.round(s.expensesThisMonth * (0.9 + (o / Math.max(1, s.occupied)) * 0.08 + noise(`${id}e${m}`) * 0.08))
        expenses += mExp
        maintenance += Math.round(mExp * (0.06 + (noise(`${id}m${m}`) + 0.5) * 0.08))
      }
    }
    return { label: monthShort(m), occupancy: beds ? occ / beds : 0, revenue, expenses, maintenance, net: revenue - expenses }
  })
}

export interface DayPoint {
  label: string
  occupancy: number
  revenue: number
  expenses: number
}

export function dailySeries(d: AppData, pid: string | 'all', days: 7 | 30): DayPoint[] {
  const pids = pid === 'all' ? d.properties.map((p) => p.id) : [pid]
  const today = todayStart()
  const txns = d.transactions.filter((t) => pids.includes(t.propertyId))
  const exps = d.expenses.filter((e) => pids.includes(e.propertyId))
  const out: DayPoint[] = []
  for (let i = days - 1; i >= 0; i--) {
    const day = addDays(today, -i)
    const iso = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`
    let occ = 0
    let beds = 0
    for (const id of pids) {
      const s = propertyStats(d, id)
      beds += s.totalBeds
      // occupancy was slightly lower earlier in the month (late admissions)
      occ += i === 0 ? s.occupied : Math.round(s.occupied - Math.max(0, i - 2) * 0.12 + noise(`${id}${iso}`) * 1.5)
    }
    const inMonth = iso.slice(0, 7) === THIS_MONTH
    out.push({
      label: `${day.getDate()} ${monthShort(day.getMonth())}`,
      occupancy: beds ? occ / beds : 0,
      revenue: inMonth ? sum(txns.filter((t) => t.date.slice(0, 10) === iso), (t) => t.amount) : Math.round(sum(pids, (id) => propertyStats(d, id).expectedCurrent) * dayWeight(day.getDate())),
      expenses: inMonth ? sum(exps.filter((e) => e.date === iso), (e) => e.amount) : 0,
    })
  }
  return out
}

function dayWeight(dom: number) {
  // share of a month's rent collected on a given day of month
  if (dom <= 7) return 0.12
  if (dom <= 15) return 0.012
  return 0.004
}
