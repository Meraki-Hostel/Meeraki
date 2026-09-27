import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Building2, CalendarDays, ExternalLink, Hammer, IdCard, MessageSquareWarning, Package } from 'lucide-react'
import { useStore } from '../../store/AppStore'
import { idx, inventoryStatus, propertyStats } from '../../store/selectors'
import { monthlySeries } from '../../lib/analytics'
import { COMPLAINT_CATEGORIES } from '../../lib/meta'
import { DEMO_TODAY, compactINR, formatDate, formatINR, formatPhone, pct } from '../../lib/utils'
import { Button, Card, CardHeader, EmptyState, KpiCard, StatusBadge } from '../../components/ui'
import { Bars, LineTrend, MeterList, SERIES } from '../../components/charts/Charts'
import { FeedbackAnalytics } from '../../components/domain/FeedbackAnalytics'
import { PlanBadge } from './Plans'

export default function PropertyDetail() {
  const { id } = useParams()
  const { data, setManagerProperty } = useStore()
  const navigate = useNavigate()
  const p = data.properties.find((x) => x.id === id)
  if (!p) return <EmptyState icon={Building2} title="Property not found" action={<Link to="/owner/properties" className="text-sm font-semibold text-brand-700">All properties</Link>} />
  const s = propertyStats(data, p.id)
  const i = idx(data)
  const series = monthlySeries(data, p.id, '6m')
  const complaints = data.complaints.filter((c) => c.propertyId === p.id)
  const byCat = COMPLAINT_CATEGORIES.map((c) => ({ category: c, open: complaints.filter((x) => x.category === c && x.status !== 'resolved').length, resolved: complaints.filter((x) => x.category === c && x.status === 'resolved').length })).filter((r) => r.open + r.resolved > 0)
  const staff = data.staff.filter((x) => x.propertyId === p.id)
  const lowStock = data.inventory.filter((x) => x.propertyId === p.id && inventoryStatus(x.stock, x.min) !== 'ok')
  const maint = data.maintenance.filter((m) => m.propertyId === p.id && m.status !== 'done')
  const events = data.events.filter((e) => e.propertyId === p.id && e.date >= DEMO_TODAY).sort((a, b) => a.date.localeCompare(b.date))
  const floors = p.buildings.flatMap((b) => {
    const rooms = data.rooms.filter((r) => r.propertyId === p.id && r.building === b)
    return [...new Set(rooms.map((r) => r.floor))].sort().map((f) => {
      const beds = rooms.filter((r) => r.floor === f).flatMap((r) => i.bedsByRoom.get(r.id) ?? [])
      return { label: `${p.buildings.length > 1 ? `${b} · ` : ''}Floor ${f}`, value: beds.filter((x) => x.status === 'occupied').length, total: beds.length }
    })
  })
  const maxFloor = Math.max(1, ...floors.map((f) => f.total))

  return (
    <div className="space-y-6">
      <Link to="/owner/properties" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-slate-500 hover:text-slate-800"><ArrowLeft size={15} /> Properties</Link>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2"><h1 className="text-2xl font-semibold tracking-tight text-slate-900">{p.name}</h1><PlanBadge plan={p.plan} /></div>
          <p className="mt-1 text-sm text-slate-500">{p.address}</p>
          <p className="text-[13px] text-slate-500">Manager: <b className="font-medium text-slate-700">{p.managerName}</b> · {formatPhone(p.managerPhone)} · since {p.established}</p>
        </div>
        <Button icon={ExternalLink} onClick={() => { setManagerProperty(p.id); navigate('/manager') }}>Open manager view</Button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <KpiCard label="Students" value={s.activeStudents} sub={`${s.awaitingBed} awaiting bed`} />
        <KpiCard label="Occupancy" value={pct(s.occupancy)} tone="brand" sub={`${s.occupied}/${s.totalBeds} beds`} />
        <KpiCard label="Revenue (Sep)" value={compactINR(s.collectedThisMonth)} tone="green" />
        <KpiCard label="Expenses (Sep)" value={compactINR(s.expensesThisMonth)} sub={`Maintenance ${compactINR(s.maintenanceCostThisMonth)}`} />
        <KpiCard label="Pending" value={compactINR(s.outstanding)} tone="red" sub={`${s.overdueCount} overdue`} />
        <KpiCard label="Complaints" value={s.openComplaints} tone="amber" sub="Unresolved" />
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Revenue vs expenses" subtitle="Last 6 months" />
          <div className="px-3 pb-4 sm:px-5">
            <LineTrend data={series.map((m) => ({ label: m.label, revenue: m.revenue, expenses: m.expenses }))} xKey="label" series={[{ key: 'revenue', label: 'Revenue', color: SERIES[0]! }, { key: 'expenses', label: 'Expenses', color: SERIES[1]! }]} format={compactINR} height={230} />
          </div>
        </Card>
        <Card>
          <CardHeader title="Occupancy by floor" subtitle={`${s.available} ready · ${s.reserved} reserved · ${s.maintenance} maintenance`} />
          <div className="scrollbar-thin max-h-72 overflow-y-auto px-5 pb-5">
            <MeterList rows={floors.map((f) => ({ label: f.label, value: f.value, hint: `/ ${f.total}` }))} max={maxFloor} format={(v) => String(v)} />
          </div>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
        <Card>
          <CardHeader title="Complaints by category" icon={<MessageSquareWarning size={16} className="text-slate-400" />} />
          <div className="px-3 pb-4 sm:px-5">
            {byCat.length ? (
              <Bars data={byCat} xKey="category" series={[{ key: 'open', label: 'Open', color: SERIES[1]! }, { key: 'resolved', label: 'Resolved', color: SERIES[0]! }]} stacked horizontal labelWidth={80} format={(v) => String(v)} height={Math.max(160, byCat.length * 34)} />
            ) : (
              <EmptyState compact icon={MessageSquareWarning} title="No complaints" />
            )}
          </div>
        </Card>
        <Card>
          <CardHeader title="Staff today" subtitle={`${s.staffPresent} of ${s.staffTotal} present`} icon={<IdCard size={16} className="text-slate-400" />} />
          <ul className="divide-y divide-slate-100 border-t border-slate-100">
            {staff.map((x) => (
              <li key={x.id} className="flex items-center justify-between px-5 py-2.5 text-[13px]">
                <span><span className="font-medium text-slate-800">{x.name}</span> <span className="text-slate-400">· {x.role}</span></span>
                <StatusBadge status={x.attendance} />
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <CardHeader title="Maintenance & inventory" icon={<Hammer size={16} className="text-slate-400" />} />
          <div className="px-5 pb-4">
            <div className="mb-2 text-xs font-semibold tracking-wide text-slate-400 uppercase">Open tasks · {formatINR(maint.reduce((a, m) => a + m.cost, 0))} estimated</div>
            <ul className="mb-4 space-y-1.5">
              {maint.map((m) => <li key={m.id} className="flex justify-between gap-2 text-[13px]"><span className="truncate text-slate-700">{m.title}</span><StatusBadge status={m.status} /></li>)}
              {!maint.length && <li className="text-[13px] text-slate-500">No open tasks</li>}
            </ul>
            <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-slate-400 uppercase"><Package size={12} />Low stock</div>
            <ul className="space-y-1.5">
              {lowStock.map((it) => <li key={it.id} className="flex justify-between text-[13px]"><span className="text-slate-700">{it.name}</span><span className="font-medium text-amber-700 tabular">{it.stock} / min {it.min}</span></li>)}
              {!lowStock.length && <li className="text-[13px] text-slate-500">All items above minimum</li>}
            </ul>
          </div>
        </Card>
      </div>

      <div>
        <h2 className="mb-3 text-[15px] font-semibold text-slate-900">Student feedback</h2>
        <FeedbackAnalytics propertyId={p.id} compact />
      </div>

      <Card>
        <CardHeader title="Upcoming events" icon={<CalendarDays size={16} className="text-slate-400" />} />
        <ul className="divide-y divide-slate-100 border-t border-slate-100">
          {events.map((e) => (
            <li key={e.id} className="flex items-center justify-between gap-3 px-5 py-3 text-[13px]">
              <span><span className="font-medium text-slate-800">{e.name}</span><span className="text-slate-400"> · {formatDate(e.date)} · {e.participants} participants</span></span>
              <span className="flex items-center gap-2"><span className="text-slate-600 tabular">{formatINR(e.budget)}</span><StatusBadge status={e.status} /></span>
            </li>
          ))}
          {!events.length && <li className="px-5 py-6 text-center text-[13px] text-slate-500">No upcoming events</li>}
        </ul>
      </Card>
    </div>
  )
}
