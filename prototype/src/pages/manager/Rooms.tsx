import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeftRight, BedDouble, Clock, Eye, Hammer, History, Plus, UserPlus, Wrench } from 'lucide-react'
import { useManagerProperty, useStore } from '../../store/AppStore'
import { idx, propertyStats } from '../../store/selectors'
import type { Bed, BedStatus, Room } from '../../lib/types'
import { cn, formatDateTime, formatINR, initials, timeAgo } from '../../lib/utils'
import { Badge, Button, Card, Chip, Drawer, EmptyState, Menu, PageHeader, SearchInput, Segmented, StatusBadge, Tabs, Tooltip, useConfirm, useToast } from '../../components/ui'
import { useModals } from '../../components/domain/ModalsProvider'

const BED_STYLE: Record<BedStatus, string> = {
  occupied: 'bg-brand-600 text-white border-brand-600',
  vacant: 'bg-emerald-50 text-emerald-700 border-emerald-300 border-dashed',
  reserved: 'bg-amber-100 text-amber-800 border-amber-300',
  maintenance: 'bg-slate-200 text-slate-500 border-slate-300',
}
const LEGEND: { status: BedStatus; label: string }[] = [
  { status: 'occupied', label: 'Occupied' },
  { status: 'vacant', label: 'Vacant' },
  { status: 'reserved', label: 'Reserved' },
  { status: 'maintenance', label: 'Maintenance' },
]

export default function RoomsPage() {
  const { data } = useStore()
  const property = useManagerProperty()
  const modals = useModals()
  const [params, setParams] = useSearchParams()
  const [building, setBuilding] = useState(property.buildings[0]!)
  const [floor, setFloor] = useState<number | 'all'>('all')
  const [q, setQ] = useState('')
  const statusFilter = (params.get('status') as BedStatus | null) ?? null
  const openRoomId = params.get('room')
  const i = idx(data)
  const st = propertyStats(data, property.id)

  const rooms = useMemo(() => data.rooms.filter((r) => r.propertyId === property.id && (property.buildings.length === 1 || r.building === building)), [data.rooms, property, building])
  const floors = Array.from(new Set(rooms.map((r) => r.floor))).sort()
  const visible = rooms.filter((r) => {
    if (floor !== 'all' && r.floor !== floor) return false
    if (q && !r.number.includes(q.trim())) return false
    if (statusFilter && !(i.bedsByRoom.get(r.id) ?? []).some((b) => b.status === statusFilter)) return false
    return true
  })
  const setParam = (k: string, v: string | null) => {
    if (v) params.set(k, v)
    else params.delete(k)
    setParams(params, { replace: true })
  }
  const counts: Record<BedStatus, number> = { occupied: st.occupied, vacant: st.available, reserved: st.reserved, maintenance: st.maintenance }

  return (
    <div>
      <PageHeader
        title="Rooms & Beds"
        description={`${property.name} · ${st.totalBeds} beds in ${data.rooms.filter((r) => r.propertyId === property.id).length} rooms`}
        actions={
          <>
            <Button icon={BedDouble} onClick={() => modals.open({ type: 'assignBed' })}>Assign bed</Button>
            <Button variant="primary" icon={Plus} onClick={() => modals.open({ type: 'addStudent' })}>Add Student</Button>
          </>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {LEGEND.map((l) => (
          <button
            key={l.status}
            onClick={() => setParam('status', statusFilter === l.status ? null : l.status)}
            className={cn('flex items-center gap-3 rounded-2xl border bg-white p-3.5 text-left transition-all', statusFilter === l.status ? 'border-brand-500 ring-3 ring-brand-500/15' : 'border-slate-200/80 hover:border-slate-300')}
          >
            <span className={cn('size-8 rounded-lg border-2', BED_STYLE[l.status])} />
            <span>
              <span className="block text-xl font-semibold text-slate-900 tabular">{counts[l.status]}</span>
              <span className="text-xs text-slate-500">{l.label}</span>
            </span>
          </button>
        ))}
      </div>

      <Card className="mb-5 p-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          {property.buildings.length > 1 && <Segmented items={property.buildings.map((b) => ({ value: b, label: b }))} value={building} onChange={(b) => { setBuilding(b); setFloor('all') }} />}
          <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
            <Chip active={floor === 'all'} onClick={() => setFloor('all')}>All floors</Chip>
            {floors.map((f) => <Chip key={f} active={floor === f} onClick={() => setFloor(f)}>Floor {f}</Chip>)}
          </div>
          <SearchInput value={q} onChange={setQ} placeholder="Room number" className="lg:ml-auto lg:w-48" />
        </div>
        {statusFilter && (
          <div className="mt-3 flex items-center gap-2 border-t border-slate-100 pt-3 text-[13px] text-slate-600">
            Showing rooms with <StatusBadge status={statusFilter} /> beds
            <button onClick={() => setParam('status', null)} className="font-medium text-brand-700">Clear</button>
          </div>
        )}
      </Card>

      {visible.length === 0 && <Card><EmptyState icon={BedDouble} title="No rooms match" description="Try another floor, building or status." /></Card>}

      <div className="space-y-7">
        {floors.filter((f) => visible.some((r) => r.floor === f)).map((f) => {
          const fr = visible.filter((r) => r.floor === f)
          const fb = rooms.filter((r) => r.floor === f).flatMap((r) => i.bedsByRoom.get(r.id) ?? [])
          return (
            <section key={f}>
              <div className="mb-3 flex items-baseline gap-3">
                <h2 className="text-[15px] font-semibold text-slate-900">Floor {f}</h2>
                <span className="text-[13px] text-slate-500">
                  {fb.filter((b) => b.status === 'occupied').length}/{fb.length} occupied · <span className="text-emerald-700">{fb.filter((b) => b.status === 'vacant').length} vacant</span>
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
                {fr.map((r) => (
                  <RoomCard key={r.id} room={r} beds={i.bedsByRoom.get(r.id) ?? []} highlight={statusFilter} onOpen={() => setParam('room', r.id)} />
                ))}
              </div>
            </section>
          )
        })}
      </div>

      {openRoomId && i.room.get(openRoomId) && <RoomDrawer room={i.room.get(openRoomId)!} onClose={() => setParam('room', null)} />}
    </div>
  )
}

function RoomCard({ room, beds, onOpen, highlight }: { room: Room; beds: Bed[]; onOpen: () => void; highlight: BedStatus | null }) {
  const { data } = useStore()
  const i = idx(data)
  const occ = beds.filter((b) => b.status === 'occupied').length
  const vacant = beds.filter((b) => b.status === 'vacant').length
  return (
    <button onClick={onOpen} className="group rounded-2xl border border-slate-200/80 bg-white p-3.5 text-left shadow-card transition-all hover:-translate-y-px hover:border-slate-300 hover:shadow-md">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[15px] font-semibold text-slate-900">{room.number}</div>
          <div className="text-[11px] text-slate-500">{room.type}</div>
        </div>
        <span className={cn('rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular', vacant ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500')}>
          {occ}/{beds.length}
        </span>
      </div>
      <div className="mt-3 flex gap-1.5">
        {beds.map((b) => {
          const s = b.studentId ? i.student.get(b.studentId) : null
          return (
            <Tooltip key={b.id} label={`Bed ${b.label} · ${s ? s.name : b.status === 'vacant' ? 'Vacant' : b.status}`}>
              <span className={cn('flex h-8 w-full min-w-8 items-center justify-center rounded-md border text-[10px] font-semibold transition-opacity', BED_STYLE[b.status], highlight && b.status !== highlight && 'opacity-30')}>
                {s ? initials(s.name) : b.label}
              </span>
            </Tooltip>
          )
        })}
      </div>
    </button>
  )
}

function RoomDrawer({ room, onClose }: { room: Room; onClose: () => void }) {
  const { data, setBedStatus, setRoomMaintenance } = useStore()
  const modals = useModals()
  const toast = useToast()
  const confirm = useConfirm()
  const navigate = useNavigate()
  const [tab, setTab] = useState<'beds' | 'history'>('beds')
  const i = idx(data)
  const beds = i.bedsByRoom.get(room.id) ?? []
  const occ = beds.filter((b) => b.status === 'occupied').length
  const avail = beds.filter((b) => b.status === 'vacant').length
  const inMaint = beds.some((b) => b.status === 'maintenance')
  const history = data.activity.filter((a) => a.roomId === room.id)
  const complaints = data.complaints.filter((c) => c.roomId === room.id && c.status !== 'resolved')
  const firstVacant = beds.find((b) => b.status === 'vacant')

  return (
    <Drawer
      open
      onClose={onClose}
      title={`Room ${room.number}`}
      description={`${room.type} · ${room.building}, Floor ${room.floor} · ${formatINR(room.rent)}/bed/month`}
      headerExtra={
        <>
          <div className="mt-4 grid grid-cols-3 divide-x divide-slate-100 rounded-xl border border-slate-200">
            <Stat label="Capacity" value={beds.length} />
            <Stat label="Occupied" value={occ} />
            <Stat label="Available" value={avail} accent />
          </div>
          <Tabs className="mt-4 -mb-4 border-b-0" value={tab} onChange={setTab} items={[{ value: 'beds', label: 'Beds' }, { value: 'history', label: 'Room history', count: history.length }]} />
        </>
      }
      footer={
        <>
          <Button
            icon={Wrench}
            onClick={async () => {
              if (!inMaint) {
                const { ok } = await confirm({ title: `Mark Room ${room.number} under maintenance?`, description: 'All vacant and reserved beds in this room will be blocked from allocation. Occupied beds are not affected.', confirmLabel: 'Mark maintenance' })
                if (!ok) return
              }
              const n = setRoomMaintenance(room.id, !inMaint)
              toast.success(inMaint ? 'Room available again' : 'Room marked under maintenance', { description: `${n} bed${n === 1 ? '' : 's'} updated` })
            }}
          >
            {inMaint ? 'Clear maintenance' : 'Mark maintenance'}
          </Button>
          <Button variant="primary" icon={UserPlus} disabled={!firstVacant} onClick={() => firstVacant && modals.open({ type: 'assignStudent', bedId: firstVacant.id })}>
            Assign student
          </Button>
        </>
      }
    >
      {tab === 'beds' ? (
        <div className="space-y-3">
          {complaints.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-900">
              <b>{complaints.length} open complaint{complaints.length > 1 ? 's' : ''}</b> in this room: {complaints.map((c) => c.title).join(', ')}
            </div>
          )}
          {beds.map((b) => {
            const s = b.studentId ? i.student.get(b.studentId) : null
            return (
              <div key={b.id} className="flex items-center gap-3 rounded-xl border border-slate-200 p-3">
                <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-lg border-2 text-sm font-semibold', BED_STYLE[b.status])}>{b.label}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-slate-900">Bed {b.label}</div>
                  {s ? (
                    <Link to={`/manager/students/${s.id}`} className="truncate text-[13px] text-brand-700 hover:underline">{s.name}</Link>
                  ) : (
                    <StatusBadge status={b.status} />
                  )}
                </div>
                {b.status === 'occupied' && s && (
                  <Menu
                    items={[
                      { label: 'View profile', icon: Eye, onClick: () => navigate(`/manager/students/${s.id}`) },
                      { label: 'Transfer student', icon: ArrowLeftRight, onClick: () => modals.open({ type: 'transfer', studentId: s.id }) },
                    ]}
                    trigger={() => <Button size="sm">Manage</Button>}
                  />
                )}
                {b.status === 'vacant' && (
                  <div className="flex gap-1.5">
                    <Menu
                      items={[
                        { label: 'Mark reserved', icon: Clock, onClick: () => { setBedStatus(b.id, 'reserved'); toast.success(`Bed ${room.number}-${b.label} reserved`) } },
                        { label: 'Mark maintenance', icon: Hammer, onClick: () => { setBedStatus(b.id, 'maintenance'); toast.success(`Bed ${room.number}-${b.label} under maintenance`) } },
                      ]}
                      trigger={() => <Button size="sm" variant="ghost">More</Button>}
                    />
                    <Button size="sm" variant="subtle" onClick={() => modals.open({ type: 'assignStudent', bedId: b.id })}>Assign</Button>
                  </div>
                )}
                {(b.status === 'reserved' || b.status === 'maintenance') && (
                  <Button size="sm" onClick={() => { setBedStatus(b.id, 'vacant'); toast.success(`Bed ${room.number}-${b.label} is available`) }}>Mark available</Button>
                )}
              </div>
            )
          })}
          <div className="pt-2">
            <div className="mb-2 text-xs font-semibold tracking-wide text-slate-400 uppercase">Amenities</div>
            <div className="flex flex-wrap gap-1.5">{room.amenities.map((a) => <Badge key={a} tone="slate">{a}</Badge>)}</div>
          </div>
        </div>
      ) : history.length ? (
        <ol className="space-y-3">
          {history.map((h) => (
            <li key={h.id} className="flex gap-3">
              <History size={16} className="mt-0.5 shrink-0 text-slate-400" />
              <div>
                <div className="text-[13px] text-slate-800">{h.message}</div>
                <div className="text-xs text-slate-400">{formatDateTime(h.at)} · {timeAgo(h.at)} · {h.actor}</div>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <EmptyState compact icon={History} title="No history yet" description="Allocations, transfers and maintenance for this room will appear here." />
      )}
    </Drawer>
  )
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="px-3 py-2.5 text-center">
      <div className={cn('text-lg font-semibold tabular', accent ? 'text-emerald-700' : 'text-slate-900')}>{value}</div>
      <div className="text-[11px] text-slate-500">{label}</div>
    </div>
  )
}
