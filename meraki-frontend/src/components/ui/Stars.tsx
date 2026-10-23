import { Star } from 'lucide-react';
import { cn } from '@/lib/cn';

export function Stars({ value, size = 'sm' }: { value: number; size?: 'sm' | 'md' }) {
  return (
    <span className="inline-flex items-center gap-0.5" role="img" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => <Star key={i} aria-hidden className={cn(size === 'sm' ? 'size-3.5' : 'size-5', i <= Math.round(value) ? 'fill-amber text-amber' : 'text-line-strong')} />)}
    </span>
  );
}

export function StarInput({ value, onChange, error }: { value: number; onChange: (v: 1 | 2 | 3 | 4 | 5) => void; error?: string }) {
  const labels = ['Very poor', 'Poor', 'Okay', 'Good', 'Excellent'];
  return (
    <fieldset>
      <legend className="mb-1.5 text-[13px] font-medium text-bark">Rating<span className="text-clay-600" aria-hidden>*</span></legend>
      <div className="flex items-center gap-1" role="radiogroup" aria-label="Rating">
        {([1, 2, 3, 4, 5] as const).map((i) => (
          <button key={i} type="button" role="radio" aria-checked={value === i} aria-label={`${i} star — ${labels[i - 1]}`} onClick={() => onChange(i)} className="rounded-md p-1 hover:bg-amber-wash">
            <Star className={cn('size-7', i <= value ? 'fill-amber text-amber' : 'text-line-strong')} aria-hidden />
          </button>
        ))}
        <span className="ml-2 text-sm text-dust">{value ? labels[value - 1] : 'Tap to rate'}</span>
      </div>
      {error && <p className="mt-1 text-xs font-medium text-brick" role="alert">{error}</p>}
    </fieldset>
  );
}
