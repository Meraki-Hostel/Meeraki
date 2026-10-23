import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export const CHART = {
  ink: '#3f5784', mid: '#5a72a0', soft: '#b9c6df', wash: '#e7ecf5', clay: '#9c665b', moss: '#4c7a58', amber: '#a6731f', brick: '#b0473e', grid: '#e6d8c5', text: '#7d6b63',
};

export function Legend({ items, className }: { items: Array<{ label: string; color: string; value?: ReactNode }>; className?: string }) {
  return (
    <ul className={cn('flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-bark', className)}>
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full" style={{ background: i.color }} aria-hidden />
          {i.label}{i.value !== undefined && <span className="font-semibold text-espresso">{i.value}</span>}
        </li>
      ))}
    </ul>
  );
}

/** Wraps a chart with an accessible text summary (charts themselves are aria-hidden). */
export function ChartFrame({ summary, children, height = 260 }: { summary: string; children: ReactNode; height?: number }) {
  return (
    <figure className="m-0">
      <div style={{ height }} aria-hidden className="w-full min-w-0">{children}</div>
      <figcaption className="sr-only">{summary}</figcaption>
    </figure>
  );
}
