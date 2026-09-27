import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '../../lib/utils'

export function EmptyState({ icon: Icon, title, description, action, className, compact }: { icon: LucideIcon; title: string; description?: ReactNode; action?: ReactNode; className?: string; compact?: boolean }) {
  return (
    <div className={cn('flex flex-col items-center justify-center text-center', compact ? 'px-4 py-8' : 'px-6 py-14', className)}>
      <div className="mb-3 flex size-12 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-400">
        <Icon size={22} strokeWidth={1.75} />
      </div>
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      {description && <p className="mt-1 max-w-sm text-[13px] text-slate-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
