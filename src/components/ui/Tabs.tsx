import { cn } from '../../lib/utils'

export interface TabItem<T extends string> {
  value: T
  label: string
  count?: number
}

export function Tabs<T extends string>({ items, value, onChange, className }: { items: TabItem<T>[]; value: T; onChange: (v: T) => void; className?: string }) {
  return (
    <div className={cn('no-scrollbar -mx-1 flex gap-1 overflow-x-auto border-b border-slate-200 px-1', className)} role="tablist">
      {items.map((t) => {
        const active = t.value === value
        return (
          <button
            key={t.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.value)}
            className={cn(
              '-mb-px flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors',
              active ? 'border-brand-600 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-800',
            )}
          >
            {t.label}
            {t.count !== undefined && (
              <span className={cn('rounded-full px-1.5 py-px text-[11px] font-semibold tabular', active ? 'bg-brand-50 text-brand-700' : 'bg-slate-100 text-slate-500')}>{t.count}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}

export function Segmented<T extends string>({ items, value, onChange, className, size = 'md' }: { items: { value: T; label: string }[]; value: T; onChange: (v: T) => void; className?: string; size?: 'sm' | 'md' }) {
  return (
    <div className={cn('inline-flex rounded-lg bg-slate-100 p-0.5', className)}>
      {items.map((t) => (
        <button
          key={t.value}
          onClick={() => onChange(t.value)}
          className={cn(
            'rounded-md font-medium transition-all',
            size === 'sm' ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-[13px]',
            t.value === value ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/70' : 'text-slate-500 hover:text-slate-800',
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

export function Chip({ active, onClick, children, className }: { active?: boolean; onClick?: () => void; children: React.ReactNode; className?: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium transition-colors',
        active ? 'border-brand-200 bg-brand-50 text-brand-700' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900',
        className,
      )}
    >
      {children}
    </button>
  )
}
