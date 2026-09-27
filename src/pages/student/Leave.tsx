import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CalendarCheck, Clock, Moon, Plus } from 'lucide-react'
import { useCurrentStudent, useStore } from '../../store/AppStore'
import { DEMO_TODAY, addDays, daysBetween, formatDate, formatTime, isoDate, sleep, timeAgo, todayStart } from '../../lib/utils'
import { Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader, Segmented, Select, StatusBadge, useConfirm, useToast } from '../../components/ui'

const REASONS = ['Home visit', 'Family function', 'Medical', 'College trip', 'Festival at home', 'Outing with friends', 'Other']

export default function StudentLeave() {
  const { data, cancelLeave } = useStore()
  const s = useCurrentStudent()
  const toast = useToast()
  const confirm = useConfirm()
  const [params, setParams] = useSearchParams()
  const creating = params.get('new') === '1'
  const leaves = data.leaves.filter((l) => l.studentId === s.id).sort((a, b) => b.from.localeCompare(a.from))
  const upcoming = leaves.filter((l) => l.to.slice(0, 10) >= DEMO_TODAY)
  const past = leaves.filter((l) => l.to.slice(0, 10) < DEMO_TODAY)

  const Row = ({ l }: { l: (typeof leaves)[number] }) => {
    const away = l.status === 'approved' && l.from.slice(0, 10) <= DEMO_TODAY && l.to.slice(0, 10) >= DEMO_TODAY
    const nights = Math.max(0, daysBetween(l.from, l.to))
    return (
      <Card className="p-4">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600">{l.type === 'Outing' ? <Clock size={18} /> : <Moon size={18} />}</span>
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-slate-900">{formatDate(l.from)} → {formatDate(l.to)}</div>
            <div className="text-[13px] text-slate-500">{l.type} · {l.type === 'Outing' ? `${formatTime(l.from)} – ${formatTime(l.to)}` : `${nights} night${nights === 1 ? '' : 's'}`} · {l.reason}</div>
          </div>
          <StatusBadge status={away ? 'away' : l.status} />
        </div>
        {l.decisionNote && <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-[13px] text-slate-600">Warden’s note: {l.decisionNote}</p>}
        <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
          <span>Requested {timeAgo(l.createdAt)}{l.decidedAt && ` · decided ${timeAgo(l.decidedAt)}`}</span>
          {l.status === 'pending' && (
            <button className="font-medium text-rose-600" onClick={async () => { const { ok } = await confirm({ title: 'Withdraw this request?', tone: 'danger', confirmLabel: 'Withdraw' }); if (ok) { cancelLeave(l.id); toast.success('Request withdrawn') } }}>Withdraw</button>
          )}
        </div>
      </Card>
    )
  }

  return (
    <div>
      <PageHeader title="Leave & Outing" description="Request permission before you leave the hostel" actions={<Button variant="primary" icon={Plus} onClick={() => setParams({ new: '1' })}>New request</Button>} />
      {leaves.length === 0 && <Card><EmptyState icon={CalendarCheck} title="No leave requests" description="Going home or out late? Send a request to the warden." action={<Button size="sm" variant="primary" onClick={() => setParams({ new: '1' })}>Request leave</Button>} /></Card>}
      {upcoming.length > 0 && <><h2 className="mb-2 text-[13px] font-semibold text-slate-500">Upcoming & pending</h2><div className="mb-6 space-y-3">{upcoming.map((l) => <Row key={l.id} l={l} />)}</div></>}
      {past.length > 0 && <><h2 className="mb-2 text-[13px] font-semibold text-slate-500">History</h2><div className="space-y-3">{past.map((l) => <Row key={l.id} l={l} />)}</div></>}
      {creating && <LeaveForm onClose={() => setParams({})} />}
    </div>
  )
}

function LeaveForm({ onClose }: { onClose: () => void }) {
  const { createLeave } = useStore()
  const s = useCurrentStudent()
  const toast = useToast()
  const tomorrow = isoDate(addDays(todayStart(), 1))
  const [type, setType] = useState<'Leave' | 'Outing'>('Leave')
  const [f, setF] = useState({ from: tomorrow, fromTime: '09:00', to: isoDate(addDays(todayStart(), 2)), toTime: '20:00', reason: 'Home visit', note: '' })
  const [saving, setSaving] = useState(false)
  const submit = async () => {
    const from = new Date(`${f.from}T${f.fromTime}:00`)
    const to = new Date(`${type === 'Outing' ? f.from : f.to}T${f.toTime}:00`)
    if (to <= from) return toast.error('Return must be after departure.')
    if (f.from < DEMO_TODAY) return toast.error('Departure can’t be in the past.')
    setSaving(true)
    await sleep(500)
    createLeave({ studentId: s.id, propertyId: s.propertyId, type, from: from.toISOString(), to: to.toISOString(), reason: f.note ? `${f.reason} — ${f.note}` : f.reason })
    setSaving(false)
    toast.success('Leave request submitted', { description: 'The warden will review it shortly.' })
    onClose()
  }
  return (
    <Modal open onClose={onClose} title="New request" footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" loading={saving} onClick={submit}>Submit request</Button></>}>
      <div className="space-y-4">
        <Segmented items={[{ value: 'Leave', label: 'Leave (overnight)' }, { value: 'Outing', label: 'Outing (same day)' }]} value={type} onChange={setType} />
        <div className="grid grid-cols-2 gap-3">
          <Field label={type === 'Outing' ? 'Date' : 'Leaving on'}><Input type="date" min={DEMO_TODAY} value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></Field>
          <Field label="Time"><Input type="time" value={f.fromTime} onChange={(e) => setF({ ...f, fromTime: e.target.value })} /></Field>
          {type === 'Leave' && <Field label="Returning on"><Input type="date" min={f.from} value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></Field>}
          <Field label="Return time"><Input type="time" value={f.toTime} onChange={(e) => setF({ ...f, toTime: e.target.value })} /></Field>
        </div>
        <Field label="Reason"><Select value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })}>{REASONS.map((r) => <option key={r}>{r}</option>)}</Select></Field>
        <Field label="Details" hint="Optional — e.g. where you’re going"><Input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="e.g. Ujjain" /></Field>
        <p className="flex items-center gap-2 text-xs text-slate-500"><Badge tone="slate">Guardian</Badge>{s.guardianName} will be informed once approved (simulated).</p>
      </div>
    </Modal>
  )
}
