import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowDownRight, ArrowUpRight, type LucideIcon } from 'lucide-react'
import { cn } from '../../lib/utils'

export function KpiCard({ label, value, sub, icon: Icon, to, tone = 'neutral', trend, onClick, className }: {
  label: string
  value: ReactNode
  sub?: ReactNode
  icon?: LucideIcon
  to?: string
  onClick?: () => void
  tone?: 'neutral' | 'brand' | 'green' | 'amber' | 'red'
  trend?: { value: string; up: boolean; good?: boolean }
  className?: string
}) {
  // Tone picks a pastel surface (lavender / mint / butter / blush); neutral stays white
  const surface = {
    neutral: ['border-slate-200/70 bg-white', 'hover:border-slate-300 hover:bg-slate-50/50'],
    brand: ['border-lavender bg-lavender', 'hover:border-lavender-deep'],
    green: ['border-mint bg-mint', 'hover:border-mint-deep'],
    amber: ['border-butter bg-butter', 'hover:border-butter-deep'],
    red: ['border-blush bg-blush', 'hover:border-blush-deep'],
  }[tone]
  const iconTone = tone === 'neutral' ? 'bg-slate-50 text-slate-600 ring-slate-200/70' : 'bg-white text-ink ring-black/5'
  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className={cn('truncate text-[13px] font-medium', tone === 'neutral' ? 'text-slate-500' : 'text-slate-700')}>{label}</span>
        {Icon && (
          <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-full ring-1', iconTone)}>
            <Icon size={16} strokeWidth={2} />
          </span>
        )}
      </div>
      <div className="mt-3 text-[26px] leading-none font-semibold tracking-tight text-slate-900">{value}</div>
      <div className={cn('mt-2 flex min-h-5 items-center gap-2 text-[13px]', tone === 'neutral' ? 'text-slate-500' : 'text-slate-600')}>
        {trend && (
          <span className={cn('inline-flex items-center gap-0.5 font-medium', (trend.good ?? trend.up) ? 'text-emerald-700' : 'text-rose-600')}>
            {trend.up ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
            {trend.value}
          </span>
        )}
        {sub && <span className="truncate">{sub}</span>}
      </div>
    </>
  )
  const cls = cn('block rounded-card border p-5 transition-colors', surface[0], (to || onClick) && surface[1], className)
  if (to) return <Link to={to} className={cls}>{body}</Link>
  if (onClick) return <button onClick={onClick} className={cn(cls, 'w-full text-left')}>{body}</button>
  return <div className={cls}>{body}</div>
}
