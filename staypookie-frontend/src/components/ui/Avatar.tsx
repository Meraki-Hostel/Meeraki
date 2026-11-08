import { cn } from '@/lib/cn';
import { initials } from '@/lib/format';

const palette = ['bg-clay-100 text-clay-800', 'bg-slate-wash text-slate-ink', 'bg-moss-wash text-moss', 'bg-amber-wash text-amber', 'bg-sand text-bark'];
const hash = (s: string) => s.split('').reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);

export function Avatar({ name, size = 'md', className }: { name: string; size?: 'sm' | 'md' | 'lg' | 'xl'; className?: string }) {
  const sz = { sm: 'size-8 text-xs', md: 'size-10 text-sm', lg: 'size-14 text-lg', xl: 'size-20 text-2xl' }[size];
  return (
    <span className={cn('inline-grid shrink-0 place-items-center rounded-full font-display font-semibold', palette[hash(name) % palette.length], sz, className)} aria-hidden>
      {initials(name)}
    </span>
  );
}
