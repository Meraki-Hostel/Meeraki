import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Check, LogIn, LogOut, Plus, UserCheck, X } from 'lucide-react'
import { useManagerProperty, useStore } from '../../store/AppStore'
import { idx, locationOf } from '../../store/selectors'
import type { Visitor, VisitorStatus } from '../../lib/types'
import { DEMO_TODAY, formatDate, formatPhone, formatTime, nowIso } from '../../lib/utils'
import { Avatar, Button, Card, EmptyState, Field, Input, KpiCard, Modal, PageHeader, Select, StatusBadge, Table, Tabs, Td, Th, Tr, useConfirm, useToast } from '../../components/ui'

type Tab = 'today' | 'pending' | 'upcoming' | 'history'

export default function VisitorsPage() {
  const { data, setVisitorStatus } = useStore()
  const property = useManagerProperty()
  const toast = useToast()
  const confirm = useConfirm()
  const [params, setParams] = useSearchParams()
  const tab = (params.get('tab') as Tab) ?? 'today'
  const [walkIn, setWalkIn] = useState(false)
  const i = idx(data)
  const all = data.visitors.filter((v) => v.propertyId === property.id)
  const day = (v: Visitor) => v.expectedAt.slice(0, 10)
  const lists: Record<Tab, Visitor[]> = {
    today: all.filter((v) => day(v) === DEMO_TODAY && v.status !== 'rejected').sort((a, b) => a.expectedAt.localeCompare(b.expectedAt)),
    pending: all.filter((v) => v.status === 'pending').sort((a, b) => a.expectedAt.localeCompare(b.expectedAt)),
    upcoming: all.filter((v) => day(v) > DEMO_TODAY && v.status !== 'rejected').sort((a, b) => a.expectedAt.localeCompare(b.expectedAt)),
    history: all.filter((v) => day(v) < DEMO_TODAY || v.status === 'checked-out' || v.status === 'rejected').sort((a, b) => b.expectedAt.localeCompare(a.expectedAt)),
  }
  const rows = lists[tab]
  const inside = all.filter((v) => v.status === 'checked-in').length

  const act = async (v: Visitor, status: VisitorStatus) => {
    if (status === 'rejected') {
      const { ok } = await confirm({ title: `Reject visit by ${v.name}?`, description: 'The student will be notified.', tone: 'danger', confirmLabel: 'Reject visit' })
      if (!ok) return
    }
    setVisitorStatus(v.id, status)
    const msg = { approved: 'Visit approved', rejected: 'Visit rejected', 'checked-in': `${v.name} checked in`, 'checked-out': `${v.name} checked out`, pending: '' }[status]
    toast.success(msg)
  }

  const actions = (v: Visitor) => {
    const isToday = day(v) === DEMO_TODAY
    return (
      <div className="flex justify-end gap-1.5">
        {v.status === 'pending' && (
          <>
            <Button size="xs" variant="ghost" icon={X} onClick={() => act(v, 'rejected')}>Reject</Button>
            <Button size="xs" variant="subtle" icon={Check} onClick={() => act(v, 'approved')}>Approve</Button>
          </>
        )}
        {v.status === 'approved' && (isToday ? <Button size="xs" variant="primary" icon={LogIn} onClick={() => act(v, 'checked-in')}>Check in</Button> : <span className="text-xs text-slate-400">Expected {formatDate(v.expectedAt)}</span>)}
        {v.status === 'checked-in' && <Button size="xs" icon={LogOut} onClick={() => act(v, 'checked-out')}>Check out</Button>}
      </div>
    )
  }

  return (
    <div>
      <PageHeader title="Visitors" description="Gate register for today and upcoming visits" actions={<Button variant="primary" icon={Plus} onClick={() => setWalkIn(true)}>Log walk-in visitor</Button>} />
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard label="Expected today" value={lists.today.length} />
        <KpiCard label="Inside now" value={inside} tone="brand" icon={UserCheck} />
        <KpiCard label="Awaiting approval" value={lists.pending.length} tone="amber" onClick={() => setParams({ tab: 'pending' })} />
        <KpiCard label="Upcoming" value={lists.upcoming.length} />
      </div>
      <Card>
        <div className="px-4 pt-2">
          <Tabs<Tab>
            value={tab}
            onChange={(t) => setParams({ tab: t }, { replace: true })}
            items={[
              { value: 'today', label: 'Today', count: lists.today.length },
              { value: 'pending', label: 'Pending approval', count: lists.pending.length },
              { value: 'upcoming', label: 'Upcoming', count: lists.upcoming.length },
              { value: 'history', label: 'History', count: lists.history.length },
            ]}
          />
        </div>
        {rows.length === 0 ? (
          <EmptyState icon={UserCheck} title="No visitors here" description={tab === 'pending' ? 'All visit requests have been handled.' : 'Visitors registered by students will appear here.'} />
        ) : (
          <>
            <div className="hidden md:block">
              <Table>
                <thead><tr><Th>Visitor</Th><Th>Student</Th><Th>Room</Th><Th>Time</Th><Th>Purpose</Th><Th>Status</Th><Th className="text-right">Actions</Th></tr></thead>
                <tbody>
                  {rows.map((v) => {
                    const s = i.student.get(v.studentId)
                    return (
                      <Tr key={v.id}>
                        <Td>
                          <div className="flex items-center gap-2.5">
                            <Avatar name={v.name} size="sm" />
                            <div>
                              <div className="font-medium text-slate-900">{v.name}</div>
                              <div className="text-xs text-slate-500">{v.relation} · {formatPhone(v.phone)}</div>
                            </div>
                          </div>
                        </Td>
                        <Td className="text-[13px]">{s?.name}</Td>
                        <Td className="text-[13px]">{locationOf(data, s)?.room.number ?? '—'}</Td>
                        <Td className="text-[13px] whitespace-nowrap">
                          {day(v) !== DEMO_TODAY && `${formatDate(v.expectedAt)}, `}{formatTime(v.expectedAt)}
                          {v.checkInAt && <div className="text-xs text-slate-400">In {formatTime(v.checkInAt)}{v.checkOutAt && ` · Out ${formatTime(v.checkOutAt)}`}</div>}
                        </Td>
                        <Td className="max-w-48 truncate text-[13px]">{v.purpose}</Td>
                        <Td><StatusBadge status={v.status} /></Td>
                        <Td>{actions(v)}</Td>
                      </Tr>
                    )
                  })}
                </tbody>
              </Table>
            </div>
            <ul className="divide-y divide-slate-100 md:hidden">
              {rows.map((v) => {
                const s = i.student.get(v.studentId)
                return (
                  <li key={v.id} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-sm font-medium text-slate-900">{v.name} <span className="font-normal text-slate-500">· {v.relation}</span></div>
                        <div className="text-xs text-slate-500">For {s?.name} ({locationOf(data, s)?.room.number}) · {formatDate(v.expectedAt)}, {formatTime(v.expectedAt)}</div>
                      </div>
                      <StatusBadge status={v.status} />
                    </div>
                    <div className="mt-2">{actions(v)}</div>
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </Card>
      {walkIn && <WalkInModal onClose={() => setWalkIn(false)} propertyId={property.id} />}
    </div>
  )
}

function WalkInModal({ onClose, propertyId }: { onClose: () => void; propertyId: string }) {
  const { data, addVisitor } = useStore()
  const toast = useToast()
  const [f, setF] = useState({ studentId: '', name: '', phone: '', relation: 'Parent', purpose: 'Family visit' })
  const students = data.students.filter((s) => s.propertyId === propertyId && s.status === 'active' && s.bedId).sort((a, b) => a.name.localeCompare(b.name))
  const save = () => {
    if (!f.studentId || !f.name.trim()) return toast.error('Select the student and enter the visitor’s name.')
    addVisitor({ studentId: f.studentId, propertyId, name: f.name.trim(), phone: f.phone, relation: f.relation, purpose: f.purpose, expectedAt: nowIso() }, 'checked-in')
    toast.success(`${f.name} checked in`, { description: 'Student has been notified.' })
    onClose()
  }
  return (
    <Modal open onClose={onClose} title="Log walk-in visitor" description="Visitor is checked in immediately" footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" icon={LogIn} onClick={save}>Check in</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Visiting student" className="sm:col-span-2">
          <Select value={f.studentId} onChange={(e) => setF({ ...f, studentId: e.target.value })}>
            <option value="">Select student</option>
            {students.map((s) => <option key={s.id} value={s.id}>{s.name} — {locationOf(data, s)?.label}</option>)}
          </Select>
        </Field>
        <Field label="Visitor name"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. Manoj Gupta" /></Field>
        <Field label="Phone"><Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="98930 12345" /></Field>
        <Field label="Relationship">
          <Select value={f.relation} onChange={(e) => setF({ ...f, relation: e.target.value })}>
            {['Parent', 'Mother', 'Father', 'Sibling', 'Relative', 'Friend', 'Other'].map((r) => <option key={r}>{r}</option>)}
          </Select>
        </Field>
        <Field label="Purpose"><Input value={f.purpose} onChange={(e) => setF({ ...f, purpose: e.target.value })} /></Field>
      </div>
    </Modal>
  )
}
