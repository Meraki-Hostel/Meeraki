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
  const iconTone = { neutral: 'bg-slate-100 text-slate-600', brand: 'bg-brand-50 text-brand-600', green: 'bg-emerald-50 text-emerald-600', amber: 'bg-amber-50 text-amber-600', red: 'bg-rose-50 text-rose-600' }[tone]
  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-[13px] font-medium text-slate-500">{label}</span>
        {Icon && (
          <span className={cn('flex size-7 shrink-0 items-center justify-center rounded-lg', iconTone)}>
            <Icon size={15} strokeWidth={2} />
          </span>
        )}
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">{value}</div>
      <div className="mt-1 flex min-h-5 items-center gap-2 text-[13px] text-slate-500">
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
  const cls = cn('block rounded-2xl border border-slate-200/80 bg-white p-4 shadow-card transition-colors', (to || onClick) && 'hover:border-slate-300 hover:bg-slate-50/50', className)
  if (to) return <Link to={to} className={cls}>{body}</Link>
  if (onClick) return <button onClick={onClick} className={cn(cls, 'w-full text-left')}>{body}</button>
  return <div className={cls}>{body}</div>
}
