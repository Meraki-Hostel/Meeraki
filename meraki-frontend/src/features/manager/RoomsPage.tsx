import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BedDouble, Pencil, Plus, Snowflake, Wrench } from 'lucide-react';
import { services } from '@/services';
import type { BedView, RoomInput, RoomWithBeds } from '@/services/interfaces';
import type { RoomStatus, RoomType } from '@/types/domain';
import { useQuery } from '@/hooks/useQuery';
import { useMutation } from '@/hooks/useMutation';
import { useQueryParam } from '@/hooks/misc';
import { useConfirm } from '@/app/providers/ConfirmProvider';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button, IconButton } from '@/components/ui/Button';
import { Checkbox, Input, Select, Textarea } from '@/components/ui/Field';
import { Drawer, Modal } from '@/components/ui/Modal';
import { FilterBar, FilterSelect, SearchInput } from '@/components/ui/FilterBar';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState, QueryBoundary, Skeleton } from '@/components/ui/States';
import { AssignBedModal } from '@/components/domain/AssignBedModal';
import { formatINR, sentenceCase } from '@/lib/format';
import { cn } from '@/lib/cn';

const TYPES: RoomType[] = ['single', 'double', 'triple', 'quad'];
const BEDS = { single: 1, double: 2, triple: 3, quad: 4 };

function RoomForm({ open, onClose, room }: { open: boolean; onClose: () => void; room: RoomWithBeds | null }) {
  const blank = { number: '', floor: '1', type: 'double' as RoomType, rent: '9500', ac: false, attachedBath: false, status: 'active' as RoomStatus };
  const [f, setF] = useState(blank);
  useEffect(() => { if (open) setF(room ? { number: room.number, floor: String(room.floor), type: room.type, rent: String(room.rent), ac: room.ac, attachedBath: room.attachedBath, status: room.status } : blank); }, [open, room?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const save = useMutation((i: RoomInput) => (room ? services.rooms.update(room.id, i) : services.rooms.create(i)), { success: room ? 'Room updated.' : 'Room added with its beds.', onSuccess: onClose });
  const e = save.fieldErrors;
  return (
    <Modal open={open} onClose={onClose} title={room ? `Edit Room ${room.number}` : 'Add room'} description={room ? 'Reducing capacity is blocked while extra beds are occupied.' : 'Beds are created automatically from the room type.'}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={save.pending} onClick={() => void save.run({ ...f, floor: Number(f.floor), rent: Number(f.rent) })}>{room ? 'Save room' : 'Add room'}</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Room number" required value={f.number} onChange={(ev) => setF({ ...f, number: ev.target.value })} error={e.number} placeholder="e.g. 205" />
        <Input label="Floor" type="number" min={0} max={20} required value={f.floor} onChange={(ev) => setF({ ...f, floor: ev.target.value })} error={e.floor} hint="0 = ground" />
        <Select label="Sharing" value={f.type} onChange={(ev) => setF({ ...f, type: ev.target.value as RoomType })} error={e.type} options={TYPES.map((t) => ({ value: t, label: `${sentenceCase(t)} (${BEDS[t]} bed${BEDS[t] > 1 ? 's' : ''})` }))} />
        <Input label="Rent per bed (₹/month)" type="number" min={1000} required value={f.rent} onChange={(ev) => setF({ ...f, rent: ev.target.value })} error={e.rent} hint={room ? 'Updates rent for current occupants too' : undefined} />
        <Checkbox label="Air-conditioned" checked={f.ac} onChange={(ev) => setF({ ...f, ac: ev.target.checked })} />
        <Checkbox label="Attached bathroom" checked={f.attachedBath} onChange={(ev) => setF({ ...f, attachedBath: ev.target.checked })} />
        {room && <Select className="sm:col-span-2" label="Room status" value={f.status} onChange={(ev) => setF({ ...f, status: ev.target.value as RoomStatus })} options={[{ value: 'active', label: 'Active' }, { value: 'maintenance', label: 'Under maintenance (no new allotments)' }]} />}
      </div>
    </Modal>
  );
}

function BedDrawer({ bed, room, onClose }: { bed: BedView | null; room: RoomWithBeds | null; onClose: () => void }) {
  const confirm = useConfirm();
  const [reason, setReason] = useState('');
  const [transfer, setTransfer] = useState(false);
  const [assignTo, setAssignTo] = useState('');
  const unassigned = useQuery(() => (bed?.status === 'available' ? services.students.list() : Promise.resolve([])), [bed?.id, bed?.status]);
  const candidates = (unassigned.data ?? []).filter((s) => !s.bedId && s.status !== 'moved_out');
  useEffect(() => { setReason(''); setAssignTo(''); }, [bed?.id]);
  const setStatus = useMutation((st: 'available' | 'unavailable') => services.rooms.setBedStatus(bed!.id, st, reason), { success: (b) => `Bed ${b.label} marked ${b.status}.`, onSuccess: onClose });
  const vacate = useMutation(() => services.rooms.vacateBed(bed!.studentId!), { success: 'Bed vacated. The resident is now awaiting a bed.', onSuccess: onClose });
  const assign = useMutation(() => services.rooms.assignBed(assignTo, bed!.id), { success: 'Bed allotted. The student profile has been updated.', onSuccess: onClose });
  if (!bed || !room) return null;
  return (
    <>
      <Drawer open onClose={onClose} title={`Room ${room.number} · Bed ${bed.label}`} description={<span className="flex items-center gap-2">{sentenceCase(room.type)} · {formatINR(room.rent)}/month <StatusBadge kind="bed" value={bed.status} /></span>} width="max-w-md">
        {bed.status === 'occupied' && (
          <div className="space-y-5">
            <div className="rounded-2xl border border-line bg-white/60 p-4">
              <p className="text-xs text-dust">Occupied by</p>
              <p className="text-lg font-semibold">{bed.studentName}</p>
              <p className="text-sm text-dust">{bed.studentCode}</p>
              <Link to={`/manager/students/${bed.studentId}`} className="mt-2 inline-block text-sm font-medium text-clay-700 hover:underline">Open profile</Link>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => setTransfer(true)}>Transfer to another bed</Button>
              <Button variant="secondary" loading={vacate.pending} onClick={async () => { if (await confirm({ title: `Vacate bed for ${bed.studentName}?`, message: 'The bed becomes available and the resident moves to “Awaiting bed”. Their dues are not affected.', confirmLabel: 'Vacate bed', tone: 'danger' })) void vacate.run(); }}>Vacate bed</Button>
            </div>
          </div>
        )}
        {bed.status === 'available' && (
          <div className="space-y-6">
            <section>
              <h3 className="mb-2 text-base font-semibold">Allot to a student</h3>
              {room.status === 'maintenance' ? <p className="text-sm text-dust">Room is under maintenance. Set it back to active to allot beds.</p> : candidates.length === 0 ? (
                <p className="text-sm text-dust">Everyone already has a bed. <Link className="text-clay-700 underline" to="/manager/students" state={{ openWizard: true }}>Add a new student</Link>.</p>
              ) : (
                <>
                  <Select label="Student awaiting a bed" value={assignTo} onChange={(e) => setAssignTo(e.target.value)} placeholder="Choose student" options={candidates.map((s) => ({ value: s.id, label: `${s.name} (${s.studentCode})` }))} />
                  <Button className="mt-3" disabled={!assignTo} loading={assign.pending} onClick={() => void assign.run()} title={!assignTo ? 'Choose a student first' : undefined}>Allot bed</Button>
                </>
              )}
            </section>
            <section className="border-t border-line pt-5">
              <h3 className="mb-2 text-base font-semibold">Block this bed</h3>
              <Textarea label="Reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} error={setStatus.fieldErrors.reason} placeholder="e.g. Mattress replacement pending" />
              <Button variant="secondary" className="mt-3" loading={setStatus.pending} onClick={() => void setStatus.run('unavailable')}>Mark unavailable</Button>
            </section>
          </div>
        )}
        {bed.status === 'unavailable' && (
          <div className="space-y-4">
            <p className="rounded-xl bg-sand/60 px-3 py-2 text-sm text-bark">Blocked: {bed.unavailableReason ?? 'No reason given'}</p>
            <Button loading={setStatus.pending} onClick={() => void setStatus.run('available')}>Mark available</Button>
          </div>
        )}
      </Drawer>
      {bed.studentId && <AssignBedModal open={transfer} onClose={() => { setTransfer(false); onClose(); }} studentId={bed.studentId} studentName={bed.studentName ?? ''} currentBedId={bed.id} />}
    </>
  );
}

export function RoomsPage() {
  const q = useQuery(() => services.rooms.list(), []);
  const [search, setSearch] = useState('');
  const [floor, setFloor] = useState('');
  const [avail, setAvail] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<RoomWithBeds | null>(null);
  const [sel, setSel] = useState<{ roomId: string; bedId: string } | null>(null);
  const [focusRoom] = useQueryParam('room');
  const rooms = useMemo(() => q.data ?? [], [q.data]);
  const floors = Array.from(new Set(rooms.map((r) => r.floor))).sort((a, b) => a - b);
  const shown = useMemo(() => rooms.filter((r) => (!floor || String(r.floor) === floor) && (!search || `${r.number} ${r.beds.map((b) => b.studentName ?? '').join(' ')}`.toLowerCase().includes(search.toLowerCase()))
    && (!avail || (avail === 'available' ? r.beds.some((b) => b.status === 'available') && r.status === 'active' : avail === 'full' ? r.beds.every((b) => b.status === 'occupied') : r.status === 'maintenance' || r.beds.some((b) => b.status === 'unavailable')))), [rooms, floor, search, avail]);
  const all = rooms.flatMap((r) => r.beds);
  const selRoom = rooms.find((r) => r.id === sel?.roomId) ?? null;
  const selBed = selRoom?.beds.find((b) => b.id === sel?.bedId) ?? null;
  useEffect(() => { if (focusRoom) setTimeout(() => document.getElementById(`room-${focusRoom}`)?.scrollIntoView({ block: 'center' }), 200); }, [focusRoom, q.data]);

  return (
    <>
      <PageHeader title="Rooms & beds" subtitle="Tap a bed to allot, transfer, vacate or block it." actions={<Button icon={<Plus className="size-4" />} onClick={() => { setEditing(null); setFormOpen(true); }}>Add room</Button>} />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[['Total beds', all.length, 'text-espresso'], ['Occupied', all.filter((b) => b.status === 'occupied').length, 'text-slate-ink'], ['Available', all.filter((b) => b.status === 'available').length, 'text-moss'], ['Blocked', all.filter((b) => b.status === 'unavailable').length, 'text-dust']].map(([l, v, c]) => (
          <Card key={l as string} className="p-4"><p className="text-[13px] text-bark">{l}</p><p className={cn('mt-1 font-display text-2xl font-semibold tabular-nums', c as string)}>{v}</p></Card>
        ))}
      </div>
      <FilterBar className="mb-4">
        <SearchInput value={search} onChange={setSearch} placeholder="Room number or resident" label="Search rooms" />
        <FilterSelect label="Floors" value={floor} onChange={setFloor} options={floors.map((f) => ({ value: String(f), label: f === 0 ? 'Ground floor' : `Floor ${f}` }))} />
        <FilterSelect label="Rooms" value={avail} onChange={setAvail} options={[{ value: 'available', label: 'With free beds' }, { value: 'full', label: 'Fully occupied' }, { value: 'blocked', label: 'Blocked / maintenance' }]} />
      </FilterBar>
      <QueryBoundary query={q} skeleton={<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-44" />)}</div>}>
        {() => shown.length === 0 ? <Card><EmptyState icon={<BedDouble className="size-5" />} title="No rooms match" message="Change filters or add a room." /></Card> : (
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {shown.map((r) => (
              <li key={r.id} id={`room-${r.id}`} className={cn('surface p-4', focusRoom === r.id && 'ring-2 ring-clay-200')}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 className="text-xl font-semibold">Room {r.number}</h2>
                    <p className="flex flex-wrap items-center gap-x-2 text-xs text-dust">{r.floor === 0 ? 'Ground' : `Floor ${r.floor}`} · {sentenceCase(r.type)} · {formatINR(r.rent)}{r.ac && <span className="inline-flex items-center gap-0.5"><Snowflake className="size-3" aria-hidden />AC</span>}{r.attachedBath && ' · Attached bath'}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    {r.status === 'maintenance' && <span className="inline-flex items-center gap-1 rounded-full bg-amber-wash px-2 py-0.5 text-xs text-amber"><Wrench className="size-3" aria-hidden />Maintenance</span>}
                    <IconButton size="sm" label={`Edit room ${r.number}`} onClick={() => { setEditing(r); setFormOpen(true); }}><Pencil className="size-4" /></IconButton>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  {r.beds.map((b) => (
                    <button key={b.id} type="button" onClick={() => setSel({ roomId: r.id, bedId: b.id })} aria-label={`Bed ${b.label}: ${b.status === 'occupied' ? `occupied by ${b.studentName}` : b.status}`}
                      className={cn('flex flex-col items-start rounded-xl border px-3 py-2 text-left text-xs transition-colors',
                        b.status === 'occupied' ? 'border-slate-soft/70 bg-slate-wash/70 hover:border-slate-mid' : b.status === 'available' ? 'border-moss/30 bg-moss-wash/50 hover:border-moss' : 'border-line bg-sand/50 hover:border-line-strong')}>
                      <span className="flex w-full items-center justify-between font-semibold text-espresso">Bed {b.label}<BedDouble className="size-3.5 text-dust" aria-hidden /></span>
                      <span className={cn('mt-0.5 w-full truncate', b.status === 'occupied' ? 'text-slate-ink' : b.status === 'available' ? 'text-moss' : 'text-dust')}>{b.status === 'occupied' ? b.studentName : b.status === 'available' ? 'Available' : 'Blocked'}</span>
                    </button>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </QueryBoundary>
      <RoomForm open={formOpen} onClose={() => setFormOpen(false)} room={editing} />
      <BedDrawer bed={selBed} room={selRoom} onClose={() => setSel(null)} />
    </>
  );
}
