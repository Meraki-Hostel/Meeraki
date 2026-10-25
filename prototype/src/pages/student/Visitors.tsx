import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Plus, UserCheck } from 'lucide-react'
import { useCurrentStudent, useStore } from '../../store/AppStore'
import { DEMO_TODAY, formatDate, formatTime, sleep } from '../../lib/utils'
import { Avatar, Button, Card, EmptyState, Field, Input, Modal, PageHeader, Select, StatusBadge } from '../../components/ui'
import { useToast } from '../../components/ui'

export default function StudentVisitors() {
  const { data } = useStore()
  const s = useCurrentStudent()
  const [params, setParams] = useSearchParams()
  const list = data.visitors.filter((v) => v.studentId === s.id)
  const upcoming = list.filter((v) => v.expectedAt.slice(0, 10) >= DEMO_TODAY && v.status !== 'checked-out' && v.status !== 'rejected').sort((a, b) => a.expectedAt.localeCompare(b.expectedAt))
  const history = list.filter((v) => !upcoming.includes(v)).sort((a, b) => b.expectedAt.localeCompare(a.expectedAt))
  const Row = ({ v }: { v: (typeof list)[number] }) => (
    <li className="flex items-center gap-3 px-4 py-3">
      <Avatar name={v.name} size="sm" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-slate-900">{v.name} <span className="font-normal text-slate-500">· {v.relation}</span></div>
        <div className="truncate text-xs text-slate-500">{formatDate(v.expectedAt)}, {formatTime(v.expectedAt)} · {v.purpose}</div>
      </div>
      <StatusBadge status={v.status} label={v.status === 'pending' ? 'Awaiting approval' : undefined} />
    </li>
  )
  return (
    <div>
      <PageHeader title="Visitors" description="Register visitors so security can let them in" actions={<Button variant="primary" icon={Plus} onClick={() => setParams({ new: '1' })}>Add visitor</Button>} />
      {list.length === 0 && <Card><EmptyState icon={UserCheck} title="No visitors yet" description="Expecting family or friends? Register them in advance." /></Card>}
      {upcoming.length > 0 && <Card className="mb-5"><div className="px-4 pt-4 pb-1 text-[13px] font-semibold text-slate-500">Upcoming</div><ul className="divide-y divide-slate-100">{upcoming.map((v) => <Row key={v.id} v={v} />)}</ul></Card>}
      {history.length > 0 && <Card><div className="px-4 pt-4 pb-1 text-[13px] font-semibold text-slate-500">Visitor history</div><ul className="divide-y divide-slate-100">{history.map((v) => <Row key={v.id} v={v} />)}</ul></Card>}
      {params.get('new') === '1' && <VisitorForm onClose={() => setParams({})} />}
    </div>
  )
}

function VisitorForm({ onClose }: { onClose: () => void }) {
  const { addVisitor } = useStore()
  const s = useCurrentStudent()
  const toast = useToast()
  const [f, setF] = useState({ name: '', phone: '', relation: 'Mother', purpose: 'Family visit', date: DEMO_TODAY, time: '17:00' })
  const [saving, setSaving] = useState(false)
  const submit = async () => {
    if (f.name.trim().length < 2) return toast.error('Enter the visitor’s name.')
    if (f.phone.replace(/\D/g, '').length !== 10) return toast.error('Enter a 10-digit phone number.')
    setSaving(true)
    await sleep(450)
    addVisitor({ studentId: s.id, propertyId: s.propertyId, name: f.name.trim(), phone: f.phone.replace(/\D/g, ''), relation: f.relation, purpose: f.purpose, expectedAt: new Date(`${f.date}T${f.time}:00`).toISOString() })
    setSaving(false)
    toast.success('Visitor registered', { description: 'Waiting for warden approval.' })
    onClose()
  }
  return (
    <Modal open onClose={onClose} title="Add visitor" footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" loading={saving} onClick={submit}>Register visitor</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Visitor name" className="sm:col-span-2"><Input autoFocus value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. Sunita Sharma" /></Field>
        <Field label="Phone"><Input inputMode="numeric" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="98260 12345" /></Field>
        <Field label="Relationship"><Select value={f.relation} onChange={(e) => setF({ ...f, relation: e.target.value })}>{['Mother', 'Father', 'Brother', 'Sister', 'Relative', 'Friend', 'Other'].map((r) => <option key={r}>{r}</option>)}</Select></Field>
        <Field label="Expected date"><Input type="date" min={DEMO_TODAY} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
        <Field label="Expected time"><Input type="time" value={f.time} onChange={(e) => setF({ ...f, time: e.target.value })} /></Field>
        <Field label="Purpose" className="sm:col-span-2"><Input value={f.purpose} onChange={(e) => setF({ ...f, purpose: e.target.value })} /></Field>
      </div>
    </Modal>
  )
}
