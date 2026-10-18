import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type Tone = 'neutral' | 'slate' | 'moss' | 'amber' | 'brick' | 'clay';
const tones: Record<Tone, string> = {
  neutral: 'bg-sand text-bark border-line',
  slate: 'bg-slate-wash text-slate-ink border-slate-soft/60',
  moss: 'bg-moss-wash text-moss border-moss/20',
  amber: 'bg-amber-wash text-amber border-amber/25',
  brick: 'bg-brick-wash text-brick border-brick/25',
  clay: 'bg-clay-50 text-clay-700 border-clay-100',
};
const dots: Record<Tone, string> = { neutral: 'bg-dust', slate: 'bg-slate-ink', moss: 'bg-moss', amber: 'bg-amber', brick: 'bg-brick', clay: 'bg-clay-600' };

export function Badge({ tone = 'neutral', children, dot = true, className }: { tone?: Tone; children: ReactNode; dot?: boolean; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium', tones[tone], className)}>
      {dot && <span className={cn('size-1.5 rounded-full', dots[tone])} aria-hidden />}
      {children}
    </span>
  );
}
