import { useMemo, useState } from 'react';
import { BedDouble, Snowflake, Wrench } from 'lucide-react';
import type { RoomWithBeds } from '@/services/interfaces';
import { Card } from '@/components/ui/Card';
import { FilterBar, FilterSelect, SearchInput } from '@/components/ui/FilterBar';
import { EmptyState, Skeleton } from '@/components/ui/States';
import { formatINR, sentenceCase } from '@/lib/format';
import { cn } from '@/lib/cn';

/**
 * Read-only room and bed grid for the owner's property page. Mirrors the
 * manager's Rooms & beds layout; allotments stay with the property manager.
 */
export function PropertyRoomsTab({ rooms }: { rooms: RoomWithBeds[] | null | undefined }) {
  const [search, setSearch] = useState('');
  const [floor, setFloor] = useState('');
  const [avail, setAvail] = useState('');

  const list = useMemo(() => rooms ?? [], [rooms]);
  const floors = useMemo(() => Array.from(new Set(list.map((r) => r.floor))).sort((a, b) => a - b), [list]);
  const shown = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return list.filter((r) => {
      if (floor && String(r.floor) !== floor) return false;
      if (needle && !`${r.number} ${r.beds.map((b) => b.studentName ?? '').join(' ')}`.toLowerCase().includes(needle)) return false;
      if (avail === 'available') return r.status === 'active' && r.beds.some((b) => b.status === 'available');
      if (avail === 'full') return r.beds.every((b) => b.status === 'occupied');
      if (avail === 'blocked') return r.status === 'maintenance' || r.beds.some((b) => b.status === 'unavailable');
      return true;
    });
  }, [list, floor, search, avail]);

  if (!rooms) return <Skeleton className="h-64" />;
  if (rooms.length === 0) {
    return <Card className="p-8 text-center text-sm text-dust">No rooms yet. The property manager adds rooms from <strong>Rooms &amp; beds</strong>.</Card>;
  }

  const beds = list.flatMap((r) => r.beds);
  const stats: [string, number, string][] = [
    ['Total beds', beds.length, 'text-espresso'],
    ['Occupied', beds.filter((b) => b.status === 'occupied').length, 'text-slate-ink'],
    ['Available', beds.filter((b) => b.status === 'available').length, 'text-moss'],
    ['Blocked', beds.filter((b) => b.status === 'unavailable').length, 'text-dust'],
  ];

  return (
    <>
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map(([label, value, color]) => (
          <Card key={label} className="p-4">
            <p className="text-[13px] text-bark">{label}</p>
            <p className={cn('mt-1 font-display text-2xl font-semibold tabular-nums', color)}>{value}</p>
          </Card>
        ))}
      </div>
      <FilterBar className="mb-4">
        <SearchInput value={search} onChange={setSearch} placeholder="Room number or resident" label="Search rooms" />
        <FilterSelect label="Floors" value={floor} onChange={setFloor} options={floors.map((f) => ({ value: String(f), label: f === 0 ? 'Ground floor' : `Floor ${f}` }))} />
        <FilterSelect label="Rooms" value={avail} onChange={setAvail} options={[{ value: 'available', label: 'With free beds' }, { value: 'full', label: 'Fully occupied' }, { value: 'blocked', label: 'Blocked / maintenance' }]} />
      </FilterBar>
      {shown.length === 0 ? (
        <Card><EmptyState icon={<BedDouble className="size-5" />} title="No rooms match" message="Change the filters to see more rooms." /></Card>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((r) => (
            <li key={r.id} className="surface p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-xl font-semibold">Room {r.number}</h3>
                  <p className="flex flex-wrap items-center gap-x-2 text-xs text-dust">
                    {r.floor === 0 ? 'Ground' : `Floor ${r.floor}`} · {sentenceCase(r.type)} · {formatINR(r.rent)}
                    {r.ac && <span className="inline-flex items-center gap-0.5"><Snowflake className="size-3" aria-hidden />AC</span>}
                    {r.attachedBath && ' · Attached bath'}
                  </p>
                </div>
                {r.status === 'maintenance' && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-wash px-2 py-0.5 text-xs text-amber"><Wrench className="size-3" aria-hidden />Maintenance</span>
                )}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                {r.beds.map((b) => (
                  <div key={b.id} aria-label={`Bed ${b.label}: ${b.status === 'occupied' ? `occupied by ${b.studentName}` : b.status}`}
                    className={cn('flex flex-col items-start rounded-xl border px-3 py-2 text-left text-xs',
                      b.status === 'occupied' ? 'border-slate-soft/70 bg-slate-wash/70' : b.status === 'available' ? 'border-moss/30 bg-moss-wash/50' : 'border-line bg-sand/50')}>
                    <span className="flex w-full items-center justify-between font-semibold text-espresso">Bed {b.label}<BedDouble className="size-3.5 text-dust" aria-hidden /></span>
                    <span className={cn('mt-0.5 w-full truncate', b.status === 'occupied' ? 'text-slate-ink' : b.status === 'available' ? 'text-moss' : 'text-dust')}
                      title={b.status === 'unavailable' ? b.unavailableReason ?? undefined : undefined}>
                      {b.status === 'occupied' ? b.studentName : b.status === 'available' ? 'Available' : 'Blocked'}
                    </span>
                  </div>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-xs text-dust">Owners view rooms read-only. The property manager handles allotments, transfers and blocking beds.</p>
    </>
  );
}
