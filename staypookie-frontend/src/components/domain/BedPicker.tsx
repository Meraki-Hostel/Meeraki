import { BedDouble } from 'lucide-react';
import type { RoomWithBeds } from '@/services/interfaces';
import { formatINR, sentenceCase } from '@/lib/format';
import { cn } from '@/lib/cn';
import { Skeleton } from '@/components/ui/States';

export function BedPicker({ rooms, loading, value, onChange, currentBedId }: { rooms?: RoomWithBeds[]; loading?: boolean; value: string | null; onChange: (id: string | null) => void; currentBedId?: string }) {
  if (loading || !rooms) return <div className="grid gap-3 sm:grid-cols-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}</div>;
  const available = rooms.reduce((a, r) => a + (r.status === 'active' ? r.beds.filter((b) => b.status === 'available').length : 0), 0);
  return (
    <div>
      <p className="mb-3 text-sm text-dust">{available} available bed{available === 1 ? '' : 's'} across {rooms.length} rooms.</p>
      <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Choose a bed">
        {rooms.map((r) => (
          <fieldset key={r.id} className={cn('rounded-2xl border border-line bg-white/60 p-3', r.status === 'maintenance' && 'opacity-60')}>
            <legend className="sr-only">Room {r.number}</legend>
            <div className="mb-2 flex items-baseline justify-between text-sm">
              <span className="font-semibold">Room {r.number}</span>
              <span className="text-xs text-dust">{sentenceCase(r.type)} · {formatINR(r.rent)}{r.ac ? ' · AC' : ''}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {r.beds.map((b) => {
                const isCurrent = b.id === currentBedId;
                const disabled = b.status !== 'available' || r.status === 'maintenance';
                const reason = isCurrent ? 'Current bed' : b.status === 'occupied' ? `Occupied by ${b.studentName}` : b.status === 'unavailable' ? b.unavailableReason ?? 'Unavailable' : r.status === 'maintenance' ? 'Room under maintenance' : 'Available';
                return (
                  <button key={b.id} type="button" role="radio" aria-checked={value === b.id} disabled={disabled} onClick={() => onChange(b.id)} title={reason}
                    aria-label={`Room ${r.number} bed ${b.label}: ${reason}`}
                    className={cn('flex min-w-[64px] flex-col items-center gap-0.5 rounded-xl border px-2.5 py-2 text-xs font-medium transition-colors',
                      value === b.id ? 'border-clay-600 bg-clay-50 text-clay-800 ring-2 ring-clay-100' :
                        isCurrent ? 'border-slate-soft bg-slate-wash text-slate-ink' :
                          disabled ? 'cursor-not-allowed border-line bg-sand/50 text-mute line-through decoration-mute/60' : 'border-moss/30 bg-moss-wash/60 text-moss hover:border-moss')}>
                    <BedDouble className="size-4" aria-hidden />Bed {b.label}
                    <span className="text-[10px] font-normal no-underline">{isCurrent ? 'Current' : b.status === 'available' && r.status === 'active' ? 'Free' : b.status === 'occupied' ? 'Taken' : 'Blocked'}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>
        ))}
      </div>
    </div>
  );
}
