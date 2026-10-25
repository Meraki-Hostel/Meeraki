import type { HTMLAttributes, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/cn';

export function Card({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('surface', className)} {...rest}>{children}</div>;
}

export function CardHeader({ title, subtitle, action, className, as: As = 'h2' }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode; className?: string; as?: 'h2' | 'h3' }) {
  return (
    <div className={cn('flex flex-wrap items-start justify-between gap-3', className)}>
      <div className="min-w-0">
        <As className="text-lg font-semibold leading-tight text-espresso">{title}</As>
        {subtitle && <p className="mt-0.5 text-sm text-dust">{subtitle}</p>}
      </div>
      {action && <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div>}
    </div>
  );
}

interface KpiProps {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon: ReactNode;
  to?: string;
  tone?: 'slate' | 'clay' | 'amber' | 'moss' | 'brick';
  progress?: number;
  extra?: ReactNode;
}
const toneClass = { slate: 'bg-slate-wash text-slate-ink', clay: 'bg-clay-50 text-clay-700', amber: 'bg-amber-wash text-amber', moss: 'bg-moss-wash text-moss', brick: 'bg-brick-wash text-brick' };

export function KpiCard({ label, value, hint, icon, to, tone = 'slate', progress, extra }: KpiProps) {
  const body = (
    <>
      <div className="flex items-start gap-3.5">
        <span className={cn('grid size-11 shrink-0 place-items-center rounded-full', toneClass[tone])} aria-hidden>{icon}</span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium text-bark">{label}</p>
          <p className="mt-1 font-display text-[28px] font-semibold leading-none tracking-tight text-espresso tabular-nums">{value}</p>
          {hint && <p className="mt-1.5 text-xs text-dust">{hint}</p>}
        </div>
        {to && <ArrowUpRight className="size-4 shrink-0 text-mute transition-colors group-hover:text-clay-600" aria-hidden />}
      </div>
      {progress !== undefined && (
        <div className="mt-3 flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-wash" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label={`${label} progress`}>
            <div className="h-full rounded-full bg-slate-mid" style={{ width: `${Math.min(100, progress)}%` }} />
          </div>
          <span className="text-xs tabular-nums text-dust">{progress}%</span>
        </div>
      )}
      {extra}
    </>
  );
  const cls = 'group surface block p-4 sm:p-5 transition-colors';
  return to ? <Link to={to} className={cn(cls, 'hover:border-line-strong')}>{body}</Link> : <div className={cls}>{body}</div>;
}

export function ProgressBar({ value, label, tone = 'slate', className }: { value: number; label: string; tone?: 'slate' | 'moss' | 'amber' | 'brick' | 'clay'; className?: string }) {
  const bar = { slate: 'bg-slate-mid', moss: 'bg-moss', amber: 'bg-amber', brick: 'bg-brick', clay: 'bg-clay-500' }[tone];
  return (
    <div className={cn('h-1.5 w-full overflow-hidden rounded-full bg-slate-wash', className)} role="progressbar" aria-label={label} aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100}>
      <div className={cn('h-full rounded-full', bar)} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

export function DescriptionList({ items, cols = 2 }: { items: Array<{ label: string; value: ReactNode }>; cols?: 1 | 2 | 3 }) {
  return (
    <dl className={cn('grid gap-x-6 gap-y-4', cols === 2 && 'sm:grid-cols-2', cols === 3 && 'sm:grid-cols-2 lg:grid-cols-3')}>
      {items.map((i) => (
        <div key={i.label} className="min-w-0">
          <dt className="text-xs font-medium text-dust">{i.label}</dt>
          <dd className="mt-0.5 break-words text-sm text-espresso">{i.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function QuickAction({ icon, label, onClick, to }: { icon: ReactNode; label: string; onClick?: () => void; to?: string }) {
  const cls = 'flex min-h-[88px] flex-col items-center justify-center gap-2 rounded-2xl border border-line bg-white/60 px-3 py-3 text-center text-[13px] font-medium text-espresso transition-colors hover:border-clay-200 hover:bg-clay-50';
  const inner = <><span className="text-clay-600" aria-hidden>{icon}</span>{label}</>;
  return to ? <Link to={to} className={cls}>{inner}</Link> : <button type="button" onClick={onClick} className={cls}>{inner}</button>;
}
