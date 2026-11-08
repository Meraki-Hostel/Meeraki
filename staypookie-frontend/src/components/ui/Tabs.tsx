import { useId, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface TabItem<T extends string> { value: T; label: string; count?: number }

/** WAI-ARIA tabs with arrow-key navigation. Panels are rendered by the caller via `renderPanel`. */
export function Tabs<T extends string>({ items, value, onChange, label, className }: { items: TabItem<T>[]; value: T; onChange: (v: T) => void; label: string; className?: string }) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const base = useId();
  const onKey = (e: KeyboardEvent, i: number) => {
    let n = i;
    if (e.key === 'ArrowRight') n = (i + 1) % items.length;
    else if (e.key === 'ArrowLeft') n = (i - 1 + items.length) % items.length;
    else if (e.key === 'Home') n = 0;
    else if (e.key === 'End') n = items.length - 1;
    else return;
    e.preventDefault();
    refs.current[n]?.focus();
    onChange(items[n]!.value);
  };
  return (
    <div role="tablist" aria-label={label} className={cn('scroll-thin flex gap-1 overflow-x-auto border-b border-line', className)}>
      {items.map((t, i) => (
        <button key={t.value} ref={(el) => { refs.current[i] = el; }} role="tab" id={`${base}-${t.value}`} aria-selected={value === t.value} tabIndex={value === t.value ? 0 : -1}
          onClick={() => onChange(t.value)} onKeyDown={(e) => onKey(e, i)}
          className={cn('-mb-px flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors',
            value === t.value ? 'border-clay-600 text-espresso' : 'border-transparent text-dust hover:text-espresso')}>
          {t.label}
          {t.count !== undefined && <span className={cn('rounded-full px-1.5 text-[11px] tabular-nums', value === t.value ? 'bg-clay-100 text-clay-800' : 'bg-sand text-bark')}>{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function TabPanel({ children, className }: { children: ReactNode; className?: string }) {
  return <div role="tabpanel" className={cn('pt-5', className)}>{children}</div>;
}

export function SegmentedControl<T extends string>({ options, value, onChange, label, size = 'md' }: { options: Array<{ value: T; label: string; icon?: ReactNode }>; value: T; onChange: (v: T) => void; label: string; size?: 'sm' | 'md' }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-xl border border-line bg-white/60 p-1">
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value} onClick={() => onChange(o.value)}
          className={cn('flex flex-1 items-center justify-center gap-1.5 rounded-lg font-medium transition-colors',
            size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-sm',
            value === o.value ? 'bg-clay-50 text-clay-800 shadow-sm ring-1 ring-clay-100' : 'text-dust hover:text-espresso')}>
          {o.icon}{o.label}
        </button>
      ))}
    </div>
  );
}
