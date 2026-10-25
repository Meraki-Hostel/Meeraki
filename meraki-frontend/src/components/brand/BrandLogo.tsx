import { cn } from '@/lib/cn';

export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 32" className={cn('h-7 w-auto', className)} aria-hidden>
      <path d="M2 26 24 4l22 22h-8.5L24 12.5 10.5 26z" fill="#8c5850" />
      <path d="M14 28 24 18l10 10h-6.2L24 24.2 20.2 28z" fill="#3b2622" />
    </svg>
  );
}

export function BrandLogo({ className, tone = 'dark', compact }: { className?: string; tone?: 'dark' | 'light'; compact?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)} aria-label="Meraki Hostel Management">
      <BrandMark />
      {!compact && (
        <span className="flex flex-col leading-none">
          <span className={cn('font-display text-[21px] font-semibold tracking-tight', tone === 'dark' ? 'text-espresso' : 'text-cream')}>Meraki</span>
          <span className={cn('mt-0.5 text-[10.5px] font-medium', tone === 'dark' ? 'text-dust' : 'text-cream/80')}>Hostel Management</span>
        </span>
      )}
    </span>
  );
}
