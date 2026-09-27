import { useState } from 'react'
import { Briefcase, IdCard } from 'lucide-react'
import { useStore } from '../../store/AppStore'
import { formatINR, formatPhone, pct, timeAgo } from '../../lib/utils'
import { Avatar, Card, CardHeader, EmptyState, KpiCard, PageHeader, ProgressBar, Select, StatusBadge, Table, Td, Th, Tr } from '../../components/ui'

export default function OwnerStaff() {
  const { data } = useStore()
  const [pid, setPid] = useState('all')
  const staff = data.staff.filter((s) => pid === 'all' || s.propertyId === pid)
  const present = staff.filter((s) => s.attendance === 'present').length
  const payroll = staff.reduce((a, s) => a + s.salary, 0)
  const reqs = data.requirements.filter((r) => pid === 'all' || r.propertyId === pid)
  const pName = (id: string) => data.properties.find((p) => p.id === id)?.name

  return (
    <div>
      <PageHeader title="Staff" description="Headcount, attendance and hiring across properties" actions={
        <Select value={pid} onChange={(e) => setPid(e.target.value)} className="h-9 w-52">
          <option value="all">All properties</option>
          {data.properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </Select>
      } />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Headcount" value={staff.length} icon={IdCard} />
        <KpiCard label="Present today" value={pct(staff.length ? present / staff.length : 0, 0)} tone="green" sub={`${present} of ${staff.length}`} />
        <KpiCard label="Monthly payroll" value={formatINR(payroll)} />
        <KpiCard label="Open positions" value={reqs.reduce((a, r) => a + r.openings, 0)} tone="brand" icon={Briefcase} />
      </div>
      <div className="grid gap-5 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Team" />
          <Table>
            <thead><tr><Th>Name</Th>{pid === 'all' && <Th>Property</Th>}<Th>Role</Th><Th>Shift</Th><Th className="text-right">Salary</Th><Th>Today</Th></tr></thead>
            <tbody>
              {staff.map((s) => (
                <Tr key={s.id}>
                  <Td><div className="flex items-center gap-2.5"><Avatar name={s.name} size="xs" /><div><div className="font-medium text-slate-900">{s.name}</div><div className="text-xs text-slate-500 tabular">{formatPhone(s.phone)}</div></div></div></Td>
                  {pid === 'all' && <Td className="text-[13px] whitespace-nowrap">{pName(s.propertyId)}</Td>}
                  <Td className="text-[13px]">{s.role}</Td>
                  <Td className="text-[13px]">{s.shift}</Td>
                  <Td className="text-right tabular">{formatINR(s.salary)}</Td>
                  <Td><StatusBadge status={s.attendance} /></Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </Card>
        <div className="space-y-5">
          <Card>
            <CardHeader title="Attendance by property" />
            <div className="space-y-3 px-5 pb-5">
              {data.properties.map((p) => {
                const list = data.staff.filter((s) => s.propertyId === p.id)
                const pr = list.filter((s) => s.attendance === 'present').length
                return (
                  <div key={p.id}>
                    <div className="mb-1 flex justify-between text-[13px]"><span className="text-slate-600">{p.name}</span><span className="font-medium tabular">{pr}/{list.length}</span></div>
                    <ProgressBar value={list.length ? pr / list.length : 0} tone="green" />
                  </div>
                )
              })}
            </div>
          </Card>
          <Card>
            <CardHeader title="Hiring requirements" subtitle="Posted by managers" />
            {reqs.length ? (
              <ul className="divide-y divide-slate-100 border-t border-slate-100">
                {reqs.map((r) => <li key={r.id} className="px-5 py-3"><div className="text-sm font-medium text-slate-900">{r.title} × {r.openings}</div><div className="text-xs text-slate-500">{pName(r.propertyId)} · {timeAgo(r.createdAt)}</div></li>)}
              </ul>
            ) : <EmptyState compact icon={Briefcase} title="No open positions" />}
          </Card>
        </div>
      </div>
    </div>
  )
}
