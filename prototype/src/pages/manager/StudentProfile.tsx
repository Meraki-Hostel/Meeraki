import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowLeftRight, BedDouble, CalendarCheck, FileText, IndianRupee, LogOut, Mail, MessageSquarePlus, MessageSquareWarning, Pencil, Phone, Receipt, UserCheck, UserX } from 'lucide-react'
import { useStore } from '../../store/AppStore'
import { dueLabel, dueStatus, idx, locationOf, studentOutstanding, studentPaymentStatus } from '../../store/selectors'
import { formatDate, formatDateTime, formatINR, formatPhone } from '../../lib/utils'
import { Avatar, Badge, Button, Card, CardHeader, EmptyState, InfoRow, StatusBadge, Tabs, Table, Td, Th, Tr } from '../../components/ui'
import { ActivityFeed } from '../../components/domain/ActivityFeed'
import { useModals } from '../../components/domain/ModalsProvider'
import { DocumentsList } from '../../components/domain/Documents'
import { StudentStatus } from './Students'

type Tab = 'overview' | 'payments' | 'complaints' | 'leave' | 'visitors' | 'documents' | 'activity'

export default function StudentProfile({ owner }: { owner?: boolean }) {
  const { id } = useParams()
  const { data } = useStore()
  const modals = useModals()
  const [tab, setTab] = useState<Tab>('overview')
  const i = idx(data)
  const s = id ? i.student.get(id) : undefined
  const back = owner ? '/owner/students' : '/manager/students'
  if (!s) return <EmptyState icon={UserX} title="Student not found" description="They may have been removed from this demo." action={<Link to={back} className="text-sm font-semibold text-brand-700">Back to students</Link>} />

  const loc = locationOf(data, s)
  const dues = i.duesByStudent.get(s.id) ?? []
  const txns = i.txnsByStudent.get(s.id) ?? []
  const complaints = data.complaints.filter((c) => c.studentId === s.id)
  const leaves = data.leaves.filter((l) => l.studentId === s.id).sort((a, b) => b.from.localeCompare(a.from))
  const visitors = data.visitors.filter((v) => v.studentId === s.id).sort((a, b) => b.expectedAt.localeCompare(a.expectedAt))
  const activity = data.activity.filter((a) => a.studentId === s.id)
  const outstanding = studentOutstanding(data, s.id)
  const property = data.properties.find((p) => p.id === s.propertyId)!
  const active = s.status === 'active'
  const readOnly = owner

  return (
    <div className="space-y-5">
      <Link to={back} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-slate-500 hover:text-slate-800">
        <ArrowLeft size={15} /> Students
      </Link>

      <Card className="p-5">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-4">
            <Avatar name={s.name} size="xl" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-semibold tracking-tight text-slate-900">{s.name}</h1>
                <StudentStatus s={s} />
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-slate-500">
                <span className="inline-flex items-center gap-1.5"><BedDouble size={14} />{loc ? `Room ${loc.room.number} · Bed ${loc.bed.label}` : active ? 'No bed assigned' : `Checked out ${s.checkoutDate ? formatDate(s.checkoutDate) : ''}`}</span>
                <span className="inline-flex items-center gap-1.5"><Phone size={14} />{formatPhone(s.phone)}</span>
                <span className="hidden items-center gap-1.5 sm:inline-flex"><Mail size={14} />{s.email || '—'}</span>
              </div>
              <div className="mt-1 text-[13px] text-slate-500">{s.course} · {s.college}{owner && ` · ${property.name}`}</div>
            </div>
          </div>
          {!readOnly && active && (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" icon={Pencil} onClick={() => modals.open({ type: 'editStudent', studentId: s.id })}>Edit</Button>
              {loc ? (
                <Button size="sm" icon={ArrowLeftRight} onClick={() => modals.open({ type: 'transfer', studentId: s.id })}>Transfer Bed</Button>
              ) : (
                <Button size="sm" icon={BedDouble} onClick={() => modals.open({ type: 'assignBed', studentId: s.id })}>Assign Room</Button>
              )}
              <Button size="sm" variant="primary" icon={IndianRupee} onClick={() => modals.open({ type: 'recordPayment', studentId: s.id })}>Record Payment</Button>
              <Button size="sm" icon={MessageSquarePlus} onClick={() => modals.open({ type: 'complaint', studentId: s.id })}>Add Complaint</Button>
              <Button size="sm" variant="ghost" className="text-rose-600 hover:bg-rose-50 hover:text-rose-700" icon={LogOut} onClick={() => modals.checkout(s.id)}>Checkout</Button>
            </div>
          )}
        </div>
        <div className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-slate-200 bg-slate-200 sm:grid-cols-4">
          <MiniStat label="Monthly rent" value={formatINR(s.monthlyRent)} />
          <MiniStat label="Outstanding" value={formatINR(outstanding)} badge={active ? <StatusBadge status={studentPaymentStatus(data, s.id)} /> : undefined} />
          <MiniStat label="Open complaints" value={String(complaints.filter((c) => c.status !== 'resolved').length)} />
          <MiniStat label="Resident since" value={formatDate(s.joinDate, { year: true })} />
        </div>
      </Card>

      <Tabs<Tab>
        value={tab}
        onChange={setTab}
        items={[
          { value: 'overview', label: 'Overview' },
          { value: 'payments', label: 'Payments', count: txns.length },
          { value: 'complaints', label: 'Complaints', count: complaints.length },
          { value: 'leave', label: 'Leave', count: leaves.length },
          { value: 'visitors', label: 'Visitors', count: visitors.length },
          { value: 'documents', label: 'Documents & Agreement' },
          { value: 'activity', label: 'Activity' },
        ]}
      />

      {tab === 'overview' && (
        <div className="grid gap-5 lg:grid-cols-3">
          <Card>
            <CardHeader title="Personal information" />
            <div className="divide-y divide-slate-100 px-5 pb-3">
              <InfoRow label="Full name" value={s.name} />
              <InfoRow label="Mobile" value={formatPhone(s.phone)} />
              <InfoRow label="Email" value={s.email || '—'} />
              <InfoRow label="ID number" value={s.idNumber} />
              <InfoRow label="Blood group" value={s.bloodGroup} />
              <InfoRow label="Hometown" value={s.hometown} />
            </div>
          </Card>
          <Card>
            <CardHeader title="Guardian & college" />
            <div className="divide-y divide-slate-100 px-5 pb-3">
              <InfoRow label="Guardian" value={s.guardianName || '—'} />
              <InfoRow label="Guardian phone" value={s.guardianPhone ? formatPhone(s.guardianPhone) : '—'} />
              <InfoRow label="College" value={s.college} />
              <InfoRow label="Course" value={s.course} />
            </div>
          </Card>
          <Card>
            <CardHeader title="Room information" action={!readOnly && loc && <Link to={`/manager/rooms?room=${loc.room.id}`} className="text-[13px] font-medium text-brand-700">View room</Link>} />
            {loc ? (
              <div className="divide-y divide-slate-100 px-5 pb-3">
                <InfoRow label="Room" value={`${loc.room.number} (${loc.room.type})`} />
                <InfoRow label="Bed" value={`Bed ${loc.bed.label}`} />
                <InfoRow label="Building" value={`${loc.room.building}, Floor ${loc.room.floor}`} />
                <InfoRow label="Roommates" value={(i.bedsByRoom.get(loc.room.id) ?? []).filter((b) => b.studentId && b.studentId !== s.id).map((b) => i.student.get(b.studentId!)?.name).join(', ') || 'None'} />
                <InfoRow label="Security deposit" value={formatINR(s.deposit)} />
              </div>
            ) : (
              <EmptyState compact icon={BedDouble} title={active ? 'No bed assigned' : 'Checked out'} action={!readOnly && active && <Button size="sm" variant="primary" onClick={() => modals.open({ type: 'assignBed', studentId: s.id })}>Assign bed</Button>} />
            )}
          </Card>
        </div>
      )}

      {tab === 'payments' && (
        <div className="grid gap-5 lg:grid-cols-5">
          <Card className="lg:col-span-2">
            <CardHeader title="Invoices" subtitle={`${formatINR(outstanding)} outstanding`} />
            <ul className="divide-y divide-slate-100 border-t border-slate-100">
              {dues.map((d) => (
                <li key={d.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="flex-1">
                    <div className="text-sm font-medium text-slate-900">{dueLabel(d.cycle)}</div>
                    <div className="text-xs text-slate-500">Due {formatDate(d.dueDate)} · {formatINR(d.paid)} of {formatINR(d.amount)}</div>
                  </div>
                  <StatusBadge status={dueStatus(d)} />
                  {!readOnly && d.paid < d.amount && <Button size="xs" variant="subtle" onClick={() => modals.open({ type: 'recordPayment', studentId: s.id, dueId: d.id })}>Record</Button>}
                </li>
              ))}
              {!dues.length && <EmptyState compact icon={IndianRupee} title="No invoices yet" />}
            </ul>
          </Card>
          <Card className="lg:col-span-3">
            <CardHeader title="Payment history & receipts" />
            {txns.length ? (
              <Table>
                <thead><tr><Th>Receipt</Th><Th>Date</Th><Th>Method</Th><Th className="text-right">Amount</Th><Th /></tr></thead>
                <tbody>
                  {txns.map((t) => (
                    <Tr key={t.id}>
                      <Td className="font-medium text-slate-900">{t.receiptNo}</Td>
                      <Td className="text-[13px]">{formatDate(t.date, { year: true })}</Td>
                      <Td className="text-[13px]">{t.method}</Td>
                      <Td className="text-right font-medium tabular">{formatINR(t.amount)}</Td>
                      <Td className="text-right"><Button size="xs" variant="ghost" icon={Receipt} onClick={() => modals.open({ type: 'receipt', txnId: t.id })}>Receipt</Button></Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            ) : (
              <EmptyState compact icon={Receipt} title="No payments recorded" />
            )}
          </Card>
        </div>
      )}

      {tab === 'complaints' && (
        <Card>
          {complaints.length ? (
            <ul className="divide-y divide-slate-100">
              {complaints.map((c) => (
                <li key={c.id} className="flex items-center gap-3 px-5 py-3.5">
                  <MessageSquareWarning size={17} className="text-slate-400" />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-slate-900">#{c.number} {c.title}</div>
                    <div className="text-xs text-slate-500">{c.category} · {formatDateTime(c.createdAt)}</div>
                  </div>
                  <StatusBadge status={c.status} />
                  {!readOnly && <Link to={`/manager/complaints?open=${c.id}`} className="text-[13px] font-medium text-brand-700">Open</Link>}
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={MessageSquareWarning} title="No complaints" description="This student hasn’t raised any complaints." />
          )}
        </Card>
      )}

      {tab === 'leave' && (
        <Card>
          {leaves.length ? (
            <ul className="divide-y divide-slate-100">
              {leaves.map((l) => (
                <li key={l.id} className="flex items-center gap-3 px-5 py-3.5">
                  <CalendarCheck size={17} className="text-slate-400" />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-slate-900">{l.type}: {formatDate(l.from)} → {formatDate(l.to)}</div>
                    <div className="text-xs text-slate-500">{l.reason}{l.decisionNote && ` · Note: ${l.decisionNote}`}</div>
                  </div>
                  <StatusBadge status={l.status} />
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={CalendarCheck} title="No leave history" />
          )}
        </Card>
      )}

      {tab === 'visitors' && (
        <Card>
          {visitors.length ? (
            <ul className="divide-y divide-slate-100">
              {visitors.map((v) => (
                <li key={v.id} className="flex items-center gap-3 px-5 py-3.5">
                  <UserCheck size={17} className="text-slate-400" />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-slate-900">{v.name} <Badge tone="slate" className="ml-1">{v.relation}</Badge></div>
                    <div className="text-xs text-slate-500">{formatDateTime(v.expectedAt)} · {v.purpose}</div>
                  </div>
                  <StatusBadge status={v.status} />
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={UserCheck} title="No visitors yet" />
          )}
        </Card>
      )}

      {tab === 'documents' && <DocumentsList student={s} canUpload={!readOnly} />}

      {tab === 'activity' && (
        <Card className="p-5">
          {activity.length ? <ActivityFeed items={activity} /> : <EmptyState compact icon={FileText} title="No activity recorded" />}
        </Card>
      )}
    </div>
  )
}

function MiniStat({ label, value, badge }: { label: string; value: string; badge?: React.ReactNode }) {
  return (
    <div className="bg-white px-4 py-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-0.5 flex items-center gap-2">
        <span className="text-base font-semibold text-slate-900 tabular">{value}</span>
        {badge}
      </div>
    </div>
  )
}
