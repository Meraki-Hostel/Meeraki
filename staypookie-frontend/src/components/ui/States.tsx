import type { ReactNode } from 'react';
import { CircleAlert, Inbox } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Button } from './Button';

export function EmptyState({ title, message, action, icon, className }: { title: string; message?: ReactNode; action?: ReactNode; icon?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-2 px-6 py-12 text-center', className)}>
      <span className="mb-1 grid size-12 place-items-center rounded-full bg-sand text-clay-600" aria-hidden>{icon ?? <Inbox className="size-5" />}</span>
      <h3 className="font-display text-lg font-semibold text-espresso">{title}</h3>
      {message && <p className="max-w-sm text-sm text-dust">{message}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry, className }: { message: string; onRetry?: () => void; className?: string }) {
  return (
    <div role="alert" className={cn('flex flex-col items-center gap-2 px-6 py-10 text-center', className)}>
      <span className="grid size-12 place-items-center rounded-full bg-brick-wash text-brick" aria-hidden><CircleAlert className="size-5" /></span>
      <h3 className="font-display text-lg font-semibold">Couldn’t load this</h3>
      <p className="max-w-sm text-sm text-dust">{message}</p>
      {onRetry && <Button variant="secondary" size="sm" onClick={onRetry} className="mt-1">Try again</Button>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton rounded-lg', className)} aria-hidden />;
}

export function PageSkeleton() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Loading">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}</div>
      <div className="grid gap-4 lg:grid-cols-3"><Skeleton className="h-72 rounded-2xl lg:col-span-2" /><Skeleton className="h-72 rounded-2xl" /></div>
    </div>
  );
}

/** Renders loading / error / content consistently. */
export function QueryBoundary<T>({ query, children, skeleton }: { query: { data: T | undefined; loading: boolean; error: string | null; reload: () => void }; children: (data: T) => ReactNode; skeleton?: ReactNode }) {
  if (query.error && query.data === undefined) return <ErrorState message={query.error} onRetry={query.reload} />;
  if (query.loading || query.data === undefined) return <>{skeleton ?? <PageSkeleton />}</>;
  return <>{children(query.data)}</>;
}
