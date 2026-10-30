import { useState } from 'react'
import { Briefcase, IdCard, Plus, Trash2, UserPlus } from 'lucide-react'
import { useManagerProperty, useStore } from '../../store/AppStore'
import type { Attendance, Staff } from '../../lib/types'
import { DEMO_TODAY, cn, formatPhone, isoDate, timeAgo } from '../../lib/utils'
import { Avatar, Badge, Button, Card, CardHeader, Checkbox, EmptyState, Field, Input, KpiCard, Modal, PageHeader, Select, Table, Td, Th, Tr, useToast } from '../../components/ui'

const ROLES: Staff['role'][] = ['Warden', 'Cleaner', 'Security', 'Cook', 'Electrician', 'Plumber', 'Housekeeping', 'Maintenance']
const PERMS = ['Students', 'Rooms', 'Payments', 'Complaints', 'Visitors', 'Inventory', 'Reports']

export default function StaffPage() {
  const { data, setAttendance, closeRequirement } = useStore()
  const property = useManagerProperty()
  const toast = useToast()
  const [adding, setAdding] = useState(false)
  const [reqOpen, setReqOpen] = useState(false)
  const staff = data.staff.filter((s) => s.propertyId === property.id)
  const reqs = data.requirements.filter((r) => r.propertyId === property.id)
  const count = (a: Attendance) => staff.filter((s) => s.attendance === a).length
  const openTasks = (id: string) => data.complaints.filter((c) => c.assignedTo === id && c.status !== 'resolved').length + data.maintenance.filter((m) => m.assignedTo === id && m.status !== 'done').length

  return (
    <div>
      <PageHeader title="Staff" description={`Team & today’s attendance · ${new Date(`${DEMO_TODAY}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}`} actions={<Button variant="primary" icon={UserPlus} onClick={() => setAdding(true)}>Add staff</Button>} />
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard label="Total staff" value={staff.length} icon={IdCard} />
        <KpiCard label="Present" value={count('present')} tone="green" />
        <KpiCard label="Absent" value={count('absent')} tone="red" />
        <KpiCard label="On leave" value={count('leave')} tone="amber" />
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Team" subtitle="Tap attendance to update today’s register" />
          <div className="hidden md:block">
            <Table>
              <thead><tr><Th>Name</Th><Th>Role</Th><Th>Shift</Th><Th>Open tasks</Th><Th>Access</Th><Th>Attendance</Th></tr></thead>
              <tbody>
                {staff.map((s) => (
                  <Tr key={s.id}>
                    <Td>
                      <div className="flex items-center gap-2.5">
                        <Avatar name={s.name} size="sm" />
                        <div>
                          <div className="font-medium text-slate-900">{s.name}</div>
                          <div className="text-xs text-slate-500 tabular">{formatPhone(s.phone)}</div>
                        </div>
                      </div>
                    </Td>
                    <Td className="text-[13px]">{s.role}</Td>
                    <Td className="text-[13px]">{s.shift}</Td>
                    <Td className="text-[13px] tabular">{openTasks(s.id) || <span className="text-slate-300">0</span>}</Td>
                    <Td><div className="flex max-w-56 flex-wrap gap-1">{s.permissions.slice(0, 3).map((p) => <Badge key={p} tone="slate">{p}</Badge>)}{s.permissions.length > 3 && <Badge tone="slate">+{s.permissions.length - 3}</Badge>}</div></Td>
                    <Td><AttendanceToggle value={s.attendance} onChange={(a) => { setAttendance(s.id, a); toast.success(`${s.name} marked ${a === 'leave' ? 'on leave' : a}`) }} /></Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </div>
          <ul className="divide-y divide-slate-100 border-t border-slate-100 md:hidden">
            {staff.map((s) => (
              <li key={s.id} className="flex items-center gap-3 px-4 py-3">
                <Avatar name={s.name} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-slate-900">{s.name}</div>
                  <div className="text-xs text-slate-500">{s.role} · {s.shift}</div>
                </div>
                <AttendanceToggle compact value={s.attendance} onChange={(a) => setAttendance(s.id, a)} />
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardHeader title="Hiring requirements" subtitle="Open positions for this property" action={<Button size="sm" icon={Plus} onClick={() => setReqOpen(true)}>Add</Button>} />
          {reqs.length === 0 ? (
            <EmptyState compact icon={Briefcase} title="No open positions" description="Post a requirement when you need more staff." />
          ) : (
            <ul className="divide-y divide-slate-100 border-t border-slate-100">
              {reqs.map((r) => (
                <li key={r.id} className="flex items-start gap-3 px-5 py-3">
                  <span className="mt-0.5 flex size-8 items-center justify-center rounded-lg bg-teal-50 text-teal-600"><Briefcase size={15} /></span>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-slate-900">{r.title} <span className="text-slate-400">× {r.openings}</span></div>
                    <div className="text-xs text-slate-500">{r.note || '—'} · posted {timeAgo(r.createdAt)}</div>
                  </div>
                  <Button size="xs" variant="ghost" icon={Trash2} aria-label="Close requirement" title="Mark filled" onClick={() => { closeRequirement(r.id); toast.success('Requirement closed') }} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
      {adding && <AddStaffModal onClose={() => setAdding(false)} propertyId={property.id} />}
      {reqOpen && <RequirementModal onClose={() => setReqOpen(false)} propertyId={property.id} />}
    </div>
  )
}

function AttendanceToggle({ value, onChange, compact }: { value: Attendance; onChange: (a: Attendance) => void; compact?: boolean }) {
  const opts: { v: Attendance; label: string; on: string }[] = [
    { v: 'present', label: compact ? 'P' : 'Present', on: 'bg-emerald-600 text-white' },
    { v: 'absent', label: compact ? 'A' : 'Absent', on: 'bg-rose-600 text-white' },
    { v: 'leave', label: compact ? 'L' : 'Leave', on: 'bg-amber-500 text-white' },
  ]
  return (
    <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5">
      {opts.map((o) => (
        <button key={o.v} onClick={() => onChange(o.v)} className={cn('rounded-md px-2 py-1 text-xs font-medium transition-colors', value === o.v ? o.on : 'text-slate-500 hover:bg-slate-100')} title={o.v}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

function AddStaffModal({ onClose, propertyId }: { onClose: () => void; propertyId: string }) {
  const { addStaff } = useStore()
  const toast = useToast()
  const [f, setF] = useState({ name: '', phone: '', role: 'Cleaner' as Staff['role'], shift: 'Morning' as Staff['shift'], salary: '12000', permissions: ['Complaints'] })
  const save = () => {
    if (!f.name.trim() || f.phone.replace(/\D/g, '').length !== 10) return toast.error('Enter a name and a 10-digit phone number.')
    addStaff({ propertyId, name: f.name.trim(), phone: f.phone.replace(/\D/g, ''), role: f.role, shift: f.shift, salary: Number(f.salary) || 0, permissions: f.permissions, attendance: 'present', joinedOn: isoDate(new Date(`${DEMO_TODAY}T00:00:00`)) })
    toast.success(`${f.name} added to staff`)
    onClose()
  }
  return (
    <Modal open onClose={onClose} title="Add staff member" footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" onClick={save}>Add staff</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name"><Input autoFocus value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. Ramesh Patil" /></Field>
        <Field label="Phone"><Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="98260 12345" /></Field>
        <Field label="Role"><Select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as Staff['role'] })}>{ROLES.map((r) => <option key={r}>{r}</option>)}</Select></Field>
        <Field label="Shift"><Select value={f.shift} onChange={(e) => setF({ ...f, shift: e.target.value as Staff['shift'] })}>{['Morning', 'Evening', 'Night', 'General'].map((r) => <option key={r}>{r}</option>)}</Select></Field>
        <Field label="Monthly salary"><Input prefix="₹" type="number" value={f.salary} onChange={(e) => setF({ ...f, salary: e.target.value })} /></Field>
        <Field label="App access" className="sm:col-span-2" hint="What this person can see in the staff app">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {PERMS.map((p) => <Checkbox key={p} label={p} checked={f.permissions.includes(p)} onChange={(v) => setF({ ...f, permissions: v ? [...f.permissions, p] : f.permissions.filter((x) => x !== p) })} />)}
          </div>
        </Field>
      </div>
    </Modal>
  )
}

function RequirementModal({ onClose, propertyId }: { onClose: () => void; propertyId: string }) {
  const { addRequirement } = useStore()
  const toast = useToast()
  const [f, setF] = useState({ title: '', openings: '1', note: '' })
  return (
    <Modal open onClose={onClose} size="sm" title="Post staff requirement" footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" onClick={() => { if (!f.title.trim()) return toast.error('Add a job title.'); addRequirement(propertyId, f.title.trim(), Number(f.openings) || 1, f.note.trim()); toast.success('Requirement posted'); onClose() }}>Post</Button></>}>
      <div className="space-y-4">
        <Field label="Position"><Input autoFocus value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="e.g. Night security guard" /></Field>
        <Field label="Openings"><Input type="number" min={1} value={f.openings} onChange={(e) => setF({ ...f, openings: e.target.value })} /></Field>
        <Field label="Note"><Input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="Shift, location, urgency" /></Field>
      </div>
    </Modal>
  )
}

