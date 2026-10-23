import { cn } from '../../lib/utils'

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-xl bg-slate-100', className)} />
}

export function PageSkeleton() {
  return (
    <div className="animate-fade-in">
      <Skeleton className="mb-2 h-4 w-32" />
      <Skeleton className="mb-7 h-7 w-64" />
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[104px] rounded-card" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-72 rounded-card lg:col-span-2" />
        <Skeleton className="h-72 rounded-card" />
      </div>
    </div>
  )
}
