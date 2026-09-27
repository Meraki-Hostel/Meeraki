import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '../../lib/utils'

export interface MenuItem {
  label: string
  icon?: LucideIcon
  onClick: () => void
  danger?: boolean
  disabled?: boolean
}

export function Menu({ trigger, items, align = 'right', width = 'w-52' }: { trigger: (open: boolean) => ReactNode; items: (MenuItem | 'divider')[]; align?: 'left' | 'right'; width?: string }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    const k = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', h)
    document.addEventListener('keydown', k)
    return () => {
      document.removeEventListener('mousedown', h)
      document.removeEventListener('keydown', k)
    }
  }, [open])
  return (
    <div ref={ref} className="relative" onClick={(e) => e.stopPropagation()}>
      <div onClick={() => setOpen((o) => !o)}>{trigger(open)}</div>
      {open && (
        <div className={cn('absolute z-40 mt-1.5 animate-slide-up rounded-xl border border-slate-200 bg-white p-1 shadow-pop', width, align === 'right' ? 'right-0' : 'left-0')}>
          {items.map((it, i) =>
            it === 'divider' ? (
              <div key={i} className="my-1 h-px bg-slate-100" />
            ) : (
              <button
                key={i}
                disabled={it.disabled}
                onClick={() => {
                  setOpen(false)
                  it.onClick()
                }}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] font-medium transition-colors disabled:opacity-40',
                  it.danger ? 'text-rose-600 hover:bg-rose-50' : 'text-slate-700 hover:bg-slate-100',
                )}
              >
                {it.icon && <it.icon size={15} className={it.danger ? '' : 'text-slate-400'} />}
                {it.label}
              </button>
            ),
          )}
        </div>
      )}
    </div>
  )
}

export function Tooltip({ label, children, side = 'top' }: { label: string; children: ReactNode; side?: 'top' | 'bottom' }) {
  return (
    <span className="group/tt relative inline-flex">
      {children}
      <span
        role="tooltip"
        className={cn(
          'pointer-events-none absolute left-1/2 z-50 -translate-x-1/2 rounded-md bg-slate-900 px-2 py-1 text-[11px] font-medium whitespace-nowrap text-white opacity-0 shadow transition-opacity delay-150 group-hover/tt:opacity-100',
          side === 'top' ? 'bottom-full mb-1.5' : 'top-full mt-1.5',
        )}
      >
        {label}
      </span>
    </span>
  )
}
