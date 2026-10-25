import { BedDouble, CircleHelp, Droplets, Sparkles, UtensilsCrossed, Wifi, Zap, type LucideIcon } from 'lucide-react'
import type { ComplaintCategory } from './types'

export const COMPLAINT_CATEGORIES: ComplaintCategory[] = ['Electrical', 'Plumbing', 'Cleaning', 'WiFi', 'Food', 'Room', 'Other']

export const CATEGORY_META: Record<ComplaintCategory, { icon: LucideIcon; tone: string }> = {
  Electrical: { icon: Zap, tone: 'bg-amber-50 text-amber-700' },
  Plumbing: { icon: Droplets, tone: 'bg-sky-50 text-sky-700' },
  Cleaning: { icon: Sparkles, tone: 'bg-emerald-50 text-emerald-700' },
  WiFi: { icon: Wifi, tone: 'bg-violet-50 text-violet-700' },
  Food: { icon: UtensilsCrossed, tone: 'bg-orange-50 text-orange-700' },
  Room: { icon: BedDouble, tone: 'bg-indigo-50 text-indigo-700' },
  Other: { icon: CircleHelp, tone: 'bg-slate-100 text-slate-600' },
}

export const FEEDBACK_LABELS: Record<string, string> = {
  cleanliness: 'Cleanliness', food: 'Food', maintenance: 'Maintenance', staff: 'Staff', safety: 'Safety', wifi: 'WiFi',
}
