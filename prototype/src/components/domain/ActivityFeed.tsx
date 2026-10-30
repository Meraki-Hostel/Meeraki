import { AlertTriangle, BedDouble, CalendarDays, ClipboardList, IndianRupee, LogOut, Megaphone, MessageSquareWarning, Package, Receipt, Star, UserCheck, UserPlus, Users, Wrench, type LucideIcon } from 'lucide-react'
import type { Activity, ActivityKind } from '../../lib/types'
import { cn, timeAgo } from '../../lib/utils'

const KIND: Record<ActivityKind, { icon: LucideIcon; tone: string }> = {
  student: { icon: UserPlus, tone: 'bg-brand-50 text-brand-600' },
  payment: { icon: IndianRupee, tone: 'bg-emerald-50 text-emerald-600' },
  complaint: { icon: MessageSquareWarning, tone: 'bg-amber-50 text-amber-600' },
  leave: { icon: LogOut, tone: 'bg-violet-50 text-violet-600' },
  visitor: { icon: UserCheck, tone: 'bg-sky-50 text-sky-600' },
  room: { icon: BedDouble, tone: 'bg-indigo-50 text-indigo-600' },
  inventory: { icon: Package, tone: 'bg-orange-50 text-orange-600' },
  announcement: { icon: Megaphone, tone: 'bg-slate-100 text-slate-600' },
  event: { icon: CalendarDays, tone: 'bg-pink-50 text-pink-600' },
  staff: { icon: Users, tone: 'bg-teal-50 text-teal-600' },
  maintenance: { icon: Wrench, tone: 'bg-slate-100 text-slate-600' },
  emergency: { icon: AlertTriangle, tone: 'bg-rose-50 text-rose-600' },
  expense: { icon: Receipt, tone: 'bg-slate-100 text-slate-600' },
  feedback: { icon: Star, tone: 'bg-amber-50 text-amber-600' },
}

export function activityIcon(kind: ActivityKind) {
  return KIND[kind] ?? { icon: ClipboardList, tone: 'bg-slate-100 text-slate-600' }
}

export function ActivityFeed({ items, showProperty, propertyName, dense }: { items: Activity[]; showProperty?: boolean; propertyName?: (id: string) => string; dense?: boolean }) {
  return (
    <ol className="relative">
      {items.map((a, n) => {
        const k = activityIcon(a.kind)
        return (
          <li key={a.id} className={cn('relative flex gap-3', dense ? 'pb-3' : 'pb-4')}>
            {n < items.length - 1 && <span className="absolute top-8 bottom-0 left-[15px] w-px bg-slate-100" />}
            <span className={cn('relative flex size-8 shrink-0 items-center justify-center rounded-full', k.tone)}>
              <k.icon size={15} />
            </span>
            <div className="min-w-0 flex-1 pt-1">
              <p className="text-[13px] leading-snug text-slate-800">{a.message}</p>
              <p className="mt-0.5 text-xs text-slate-400">
                {timeAgo(a.at)} · {a.actor}
                {showProperty && propertyName && ` · ${propertyName(a.propertyId)}`}
              </p>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
