import { useMemo, useState } from 'react'
import { BedDouble, Check, Search } from 'lucide-react'
import { useStore } from '../../store/AppStore'
import { idx } from '../../store/selectors'
import type { Bed, Room } from '../../lib/types'
import { cn, formatINR } from '../../lib/utils'
import { Chip, EmptyState, Segmented } from '../ui'

/** Two-step room → bed selector used by Add Student, Assign Bed and Transfer. */
export function BedPicker({ propertyId, value, onChange, excludeBedId }: { propertyId: string; value: string | null; onChange: (bedId: string | null) => void; excludeBedId?: string | null }) {
  const { data } = useStore()
  const i = idx(data)
  const property = data.properties.find((p) => p.id === propertyId)!
  const [building, setBuilding] = useState(property.buildings[0]!)
  const [floor, setFloor] = useState<number | 'all'>('all')
  const [q, setQ] = useState('')
  const [onlyAvailable, setOnlyAvailable] = useState(true)
  const selectedBed = value ? i.bed.get(value) : null
  const [roomId, setRoomId] = useState<string | null>(selectedBed?.roomId ?? null)

  const rooms = useMemo(() => data.rooms.filter((r) => r.propertyId === propertyId && r.building === building), [data.rooms, propertyId, building])
  const floors = Array.from(new Set(rooms.map((r) => r.floor))).sort()
  const avail = (r: Room) => (i.bedsByRoom.get(r.id) ?? []).filter((b) => b.status === 'vacant' && b.id !== excludeBedId).length
  const visible = rooms.filter((r) => (floor === 'all' || r.floor === floor) && (!q || r.number.includes(q.trim())) && (!onlyAvailable || avail(r) > 0))
  const byFloor = floors.map((f) => ({ floor: f, rooms: visible.filter((r) => r.floor === f) })).filter((g) => g.rooms.length)
  const room = roomId ? i.room.get(roomId) : null
  const beds = room ? (i.bedsByRoom.get(room.id) ?? []) : []

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {property.buildings.length > 1 && (
          <Segmented
            items={property.buildings.map((b) => ({ value: b, label: b }))}
            value={building}
            onChange={(b) => {
              setBuilding(b)
              setRoomId(null)
              onChange(null)
            }}
          />
        )}
        <div className="relative w-32">
          <Search size={14} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Room no." className="h-9 w-full rounded-lg border border-slate-200 pr-2 pl-8 text-sm focus:border-brand-500 focus:ring-3 focus:ring-brand-500/15 focus:outline-none" />
        </div>
        <label className="ml-auto flex items-center gap-2 text-[13px] text-slate-600">
          <input type="checkbox" checked={onlyAvailable} onChange={(e) => setOnlyAvailable(e.target.checked)} className="accent-brand-600" />
          Only rooms with vacancy
        </label>
      </div>
      <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
        <Chip active={floor === 'all'} onClick={() => setFloor('all')}>All floors</Chip>
        {floors.map((f) => (
          <Chip key={f} active={floor === f} onClick={() => setFloor(f)}>
            Floor {f}
          </Chip>
        ))}
      </div>

      <div className="scrollbar-thin max-h-64 space-y-4 overflow-y-auto pr-1">
        {byFloor.length === 0 && <EmptyState compact icon={BedDouble} title="No rooms match" description="Try another floor or turn off “Only rooms with vacancy”." />}
        {byFloor.map((g) => (
          <div key={g.floor}>
            <div className="mb-2 text-xs font-semibold tracking-wide text-slate-400 uppercase">Floor {g.floor}</div>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {g.rooms.map((r) => {
                const n = avail(r)
                const active = r.id === roomId
                return (
                  <button
                    key={r.id}
                    onClick={() => {
                      setRoomId(r.id)
                      if (selectedBed?.roomId !== r.id) onChange(null)
                    }}
                    className={cn(
                      'rounded-xl border px-2.5 py-2 text-left transition-all',
                      active ? 'border-brand-500 bg-brand-50 ring-3 ring-brand-500/15' : n ? 'border-slate-200 bg-white hover:border-slate-300' : 'border-slate-100 bg-slate-50',
                    )}
                  >
                    <div className={cn('text-sm font-semibold', n ? 'text-slate-900' : 'text-slate-400')}>{r.number}</div>
                    <div className={cn('text-[11px]', n ? 'text-emerald-700' : 'text-slate-400')}>{n ? `${n} vacan${n > 1 ? 'cies' : 'cy'}` : 'Full'}</div>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {room && (
        <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-slate-900">
                Room {room.number} · {room.type}
              </div>
              <div className="text-xs text-slate-500">
                {room.building} · Floor {room.floor} · {formatINR(room.rent)}/month
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {beds.map((b) => (
              <BedOption key={b.id} bed={b} selected={b.id === value} disabled={b.status !== 'vacant' || b.id === excludeBedId} occupantName={b.studentId ? i.student.get(b.studentId)?.name : undefined} current={b.id === excludeBedId} onClick={() => onChange(b.id)} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function BedOption({ bed, selected, disabled, occupantName, onClick, current }: { bed: Bed; selected: boolean; disabled: boolean; occupantName?: string; onClick: () => void; current?: boolean }) {
  const label = current ? 'Current bed' : bed.status === 'occupied' ? occupantName ?? 'Occupied' : bed.status === 'vacant' ? 'Available' : bed.status === 'reserved' ? 'Reserved' : 'Maintenance'
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'relative rounded-lg border px-3 py-2.5 text-left transition-all',
        selected ? 'border-brand-500 bg-white ring-3 ring-brand-500/15' : disabled ? 'border-slate-200 bg-slate-100/70' : 'border-emerald-200 bg-white hover:border-emerald-400',
      )}
    >
      <div className={cn('text-sm font-semibold', disabled ? 'text-slate-400' : 'text-slate-900')}>Bed {bed.label}</div>
      <div className={cn('truncate text-[11px]', disabled ? 'text-slate-400' : 'text-emerald-700')}>{label}</div>
      {selected && (
        <span className="absolute top-2 right-2 flex size-4 items-center justify-center rounded-full bg-brand-600 text-white">
          <Check size={11} strokeWidth={3} />
        </span>
      )}
    </button>
  )
}
