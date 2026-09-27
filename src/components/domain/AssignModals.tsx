import { useMemo, useState } from 'react'
import { ArrowRight, Search, UserPlus, Users } from 'lucide-react'
import { useStore } from '../../store/AppStore'
import { idx, locationOf } from '../../store/selectors'
import { cn, formatDate, sleep } from '../../lib/utils'
import { Avatar, Button, EmptyState, Input, Modal, useConfirm, useToast } from '../ui'
import { BedPicker } from './BedPicker'

/** Student → choose a bed */
export function AssignBedModal({ open, onClose, propertyId, studentId: preset }: { open: boolean; onClose: () => void; propertyId: string; studentId?: string }) {
  const { data, assignBed } = useStore()
  const toast = useToast()
  const [studentId, setStudentId] = useState<string | null>(preset ?? null)
  const [bedId, setBedId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const student = studentId ? idx(data).student.get(studentId) : null
  const unassigned = data.students.filter((s) => s.propertyId === propertyId && s.status === 'active' && !s.bedId)

  const save = async () => {
    if (!studentId) return toast.error('Select a student first.')
    if (!bedId) return toast.error('Please select a bed.')
    setSaving(true)
    await sleep(450)
    const res = assignBed(studentId, bedId)
    setSaving(false)
    if (!res.ok) return toast.error(res.error)
    const b = idx(data).bed.get(bedId)!
    toast.success('Bed assigned', { description: `${student?.name} → Room ${idx(data).room.get(b.roomId)!.number}-${b.label}` })
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} size="lg" title="Assign bed" description={student ? `Choose a bed for ${student.name}` : 'Choose a student awaiting allocation'}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" loading={saving} disabled={!studentId} onClick={save}>Assign bed</Button></>}>
      {!student ? (
        unassigned.length ? (
          <div className="divide-y divide-slate-100 rounded-xl border border-slate-200">
            {unassigned.map((s) => (
              <button key={s.id} onClick={() => setStudentId(s.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50">
                <Avatar name={s.name} size="sm" />
                <div className="flex-1">
                  <div className="text-sm font-medium text-slate-900">{s.name}</div>
                  <div className="text-xs text-slate-500">Admitted {formatDate(s.joinDate)} · {s.course}</div>
                </div>
                <ArrowRight size={16} className="text-slate-400" />
              </button>
            ))}
          </div>
        ) : (
          <EmptyState compact icon={Users} title="Everyone has a bed" description="No students are waiting for allocation. Use a student’s profile to transfer them instead." />
        )
      ) : (
        <BedPicker propertyId={propertyId} value={bedId} onChange={setBedId} excludeBedId={student.bedId} />
      )}
    </Modal>
  )
}

/** Bed → choose a student (or add a new one) */
export function AssignStudentModal({ open, onClose, bedId, onAddNew }: { open: boolean; onClose: () => void; bedId: string; onAddNew: () => void }) {
  const { data, assignBed } = useStore()
  const toast = useToast()
  const i = idx(data)
  const bed = i.bed.get(bedId)!
  const room = i.room.get(bed.roomId)!
  const [q, setQ] = useState('')
  const [saving, setSaving] = useState<string | null>(null)
  const unassigned = data.students.filter((s) => s.propertyId === bed.propertyId && s.status === 'active' && !s.bedId)
  const results = useMemo(() => {
    const t = q.trim().toLowerCase()
    if (!t) return []
    return data.students.filter((s) => s.propertyId === bed.propertyId && s.status === 'active' && s.bedId && s.name.toLowerCase().includes(t)).slice(0, 5)
  }, [q, data.students, bed.propertyId])

  const pickStudent = async (sid: string) => {
    setSaving(sid)
    await sleep(400)
    const res = assignBed(sid, bedId)
    setSaving(null)
    if (!res.ok) return toast.error(res.error)
    toast.success('Student assigned', { description: `${i.student.get(sid)?.name} → Room ${room.number}-${bed.label}` })
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={`Assign student to ${room.number}-${bed.label}`} description={`${room.type} room · ${room.building}, Floor ${room.floor}`}>
      <button onClick={onAddNew} className="mb-5 flex w-full items-center gap-3 rounded-xl border border-dashed border-brand-300 bg-brand-50/50 px-4 py-3 text-left hover:bg-brand-50">
        <span className="flex size-9 items-center justify-center rounded-lg bg-brand-600 text-white">
          <UserPlus size={17} />
        </span>
        <span>
          <span className="block text-sm font-semibold text-brand-800">Add a new student to this bed</span>
          <span className="text-xs text-brand-700/80">Opens the admission form with this bed pre-selected</span>
        </span>
      </button>
      <div className="mb-2 text-xs font-semibold tracking-wide text-slate-400 uppercase">Awaiting allocation</div>
      {unassigned.length ? (
        <div className="mb-5 divide-y divide-slate-100 rounded-xl border border-slate-200">
          {unassigned.map((s) => (
            <div key={s.id} className="flex items-center gap-3 px-4 py-2.5">
              <Avatar name={s.name} size="sm" />
              <div className="flex-1 text-sm font-medium text-slate-900">{s.name}</div>
              <Button size="sm" variant="subtle" loading={saving === s.id} onClick={() => pickStudent(s.id)}>
                Assign
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <p className="mb-5 text-[13px] text-slate-500">No students are waiting for a bed.</p>
      )}
      <div className="mb-2 text-xs font-semibold tracking-wide text-slate-400 uppercase">Or move an existing resident here</div>
      <div className="relative">
        <Search size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search resident by name" className="pl-9" />
      </div>
      {results.length > 0 && (
        <div className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-200">
          {results.map((s) => (
            <div key={s.id} className="flex items-center gap-3 px-4 py-2.5">
              <Avatar name={s.name} size="sm" />
              <div className="flex-1">
                <div className="text-sm font-medium text-slate-900">{s.name}</div>
                <div className="text-xs text-slate-500">Currently {locationOf(data, s)?.label}</div>
              </div>
              <Button size="sm" variant="secondary" loading={saving === s.id} onClick={() => pickStudent(s.id)}>
                Move here
              </Button>
            </div>
          ))}
        </div>
      )}
    </Modal>
  )
}

export function TransferModal({ open, onClose, studentId }: { open: boolean; onClose: () => void; studentId: string }) {
  const { data, transferStudent } = useStore()
  const toast = useToast()
  const confirm = useConfirm()
  const i = idx(data)
  const s = i.student.get(studentId)!
  const loc = locationOf(data, s)
  const [bedId, setBedId] = useState<string | null>(null)
  const target = bedId ? i.bed.get(bedId) : null
  const targetRoom = target ? i.room.get(target.roomId) : null

  const go = async () => {
    if (!bedId || !target || !targetRoom) return toast.error('Please select a bed.')
    const { ok } = await confirm({
      title: `Transfer ${s.name}?`,
      description: (
        <>
          From <b>{loc?.label ?? '—'}</b> to <b>{targetRoom.number}-{target.label}</b>. Bed {loc?.label} will become available.
          {targetRoom.rent !== s.monthlyRent && <span className="mt-2 block text-amber-700">Note: the new room’s standard rent is ₹{targetRoom.rent.toLocaleString('en-IN')} (current ₹{s.monthlyRent.toLocaleString('en-IN')}). Rent is unchanged — edit the profile to update it.</span>}
        </>
      ),
      confirmLabel: 'Confirm transfer',
    })
    if (!ok) return
    const res = transferStudent(studentId, bedId)
    if (!res.ok) return toast.error(res.error)
    toast.success('Student transferred', { description: `${res.from} → ${res.to}` })
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} size="lg" title={`Transfer ${s.name}`}
      description={<span className="inline-flex items-center gap-2">Current bed <b className="text-slate-800">{loc?.label ?? '—'}</b>{target && <><ArrowRight size={13} /><b className={cn('text-brand-700')}>{targetRoom?.number}-{target.label}</b></>}</span>}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!bedId} onClick={go}>Review transfer</Button></>}>
      <BedPicker propertyId={s.propertyId} value={bedId} onChange={setBedId} excludeBedId={s.bedId} />
    </Modal>
  )
}
