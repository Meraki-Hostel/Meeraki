import { cn, initials } from '../../lib/utils'

const COLORS = [
  'bg-indigo-100 text-indigo-700', 'bg-emerald-100 text-emerald-700', 'bg-amber-100 text-amber-800', 'bg-rose-100 text-rose-700',
  'bg-sky-100 text-sky-700', 'bg-violet-100 text-violet-700', 'bg-teal-100 text-teal-700', 'bg-orange-100 text-orange-700',
]

function hash(s: string) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

export function Avatar({ name, size = 'md', className }: { name: string; size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'; className?: string }) {
  const s = { xs: 'size-6 text-[10px]', sm: 'size-8 text-xs', md: 'size-9 text-[13px]', lg: 'size-12 text-base', xl: 'size-16 text-xl' }[size]
  return <span className={cn('inline-flex shrink-0 items-center justify-center rounded-full font-semibold', COLORS[hash(name) % COLORS.length], s, className)}>{initials(name)}</span>
}
