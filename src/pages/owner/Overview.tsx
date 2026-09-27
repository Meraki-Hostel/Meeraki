import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, BedDouble, Building2, MessageSquareWarning, Receipt, Star, TrendingUp, Users, Wallet } from 'lucide-react'
import { OWNER_NAME, useStore } from '../../store/AppStore'
import { propertyStats } from '../../store/selectors'
import { monthlySeries } from '../../lib/analytics'
import { DEMO_TODAY, cn, compactINR, firstName, formatDateLong, formatINR, greeting, pct } from '../../lib/utils'
import { Card, CardHeader, KpiCard, ProgressBar, Table, Td, Th, Tr } from '../../components/ui'
import { PlanBadge } from './Plans'
import { LineTrend, SERIES } from '../../components/charts/Charts'
import { ActivityFeed } from '../../components/domain/ActivityFeed'
import { buildNotifications } from '../../components/layout/notifications'

export default function OwnerOverview() {
  const { data, session } = useStore()
  const navigate = useNavigate()
  const all = propertyStats(data, 'all')
  const series = monthlySeries(data, 'all', '6m')
  const prev = series[series.length - 2]!
  const attention = buildNotifications(data, session, 'owner').slice(0, 6)
  const activity = data.activity.filter((a) => ['payment', 'expense', 'student', 'emergency', 'maintenance'].includes(a.kind)).slice(0, 7)
  const pName = (id: string) => data.properties.find((p) => p.id === id)?.name ?? ''

  return (
    <div className="space-y-6">
      <div>
        <span className="text-[13px] font-medium text-slate-500">{formatDateLong(DEMO_TODAY)}</span>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{greeting()}, {firstName(OWNER_NAME)}</h1>
        <p className="text-sm text-slate-500">Portfolio overview · {data.properties.length} properties · September 2026</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Occupancy" value={pct(all.occupancy)} icon={BedDouble} tone="brand" sub={`${all.occupied.toLocaleString('en-IN')} of ${all.totalBeds.toLocaleString('en-IN')} beds`} trend={{ value: `${((all.occupancy - prev.occupancy) * 100).toFixed(1)} pts`, up: all.occupancy >= prev.occupancy }} to="/owner/properties" />
        <KpiCard label="Revenue (Sep)" value={compactINR(all.collectedThisMonth)} icon={TrendingUp} tone="green" sub={formatINR(all.collectedThisMonth)} to="/owner/finance" />
        <KpiCard label="Expenses (Sep)" value={compactINR(all.expensesThisMonth)} icon={Receipt} tone="neutral" sub={`Net ${compactINR(all.collectedThisMonth - all.expensesThisMonth)}`} to="/owner/finance" />
        <KpiCard label="Pending payments" value={compactINR(all.outstanding)} icon={Wallet} tone="red" sub={`${all.overdueCount} overdue invoices`} to="/owner/finance" />
        <KpiCard label="Properties" value={data.properties.length} icon={Building2} sub={`${[...new Set(data.properties.map((p) => p.city))].length} cities`} to="/owner/properties" />
        <KpiCard label="Residents" value={all.activeStudents.toLocaleString('en-IN')} icon={Users} sub={`${all.awaitingBed} awaiting bed`} to="/owner/students" />
        <KpiCard label="Open complaints" value={all.openComplaints} icon={MessageSquareWarning} tone="amber" sub={`${all.newComplaints} not started`} to="/owner/complaints" />
        <KpiCard label="Satisfaction" value={`${all.satisfaction.toFixed(1)} / 5`} icon={Star} sub="September feedback" to="/owner/analytics" />
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Revenue vs expenses" subtitle="Last 6 months · all properties" action={<Link to="/owner/analytics" className="text-[13px] font-medium text-brand-700">Analytics</Link>} />
          <div className="px-3 pb-4 sm:px-5">
            <LineTrend data={series.map((m) => ({ label: m.label, revenue: m.revenue, expenses: m.expenses }))} xKey="label" series={[{ key: 'revenue', label: 'Revenue', color: SERIES[0]! }, { key: 'expenses', label: 'Expenses', color: SERIES[1]! }]} format={compactINR} height={250} />
          </div>
        </Card>
        <Card>
          <CardHeader title="Needs attention" />
          <ul className="divide-y divide-slate-100 border-t border-slate-100">
            {attention.map((n) => (
              <li key={n.key}>
                <button onClick={() => navigate(n.link)} className="flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-slate-50">
                  <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-full', n.tone)}><n.icon size={15} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-medium text-slate-800">{n.title}</span>
                    {n.body && <span className="block truncate text-xs text-slate-500">{n.body}</span>}
                  </span>
                </button>
              </li>
            ))}
            {!attention.length && <li className="px-5 py-8 text-center text-[13px] text-slate-500">All properties are running smoothly.</li>}
          </ul>
        </Card>
      </div>

      <Card>
        <CardHeader title="Property performance" subtitle="Click a property to open its dashboard" />
        <div className="hidden md:block">
          <Table>
            <thead><tr><Th>Property</Th><Th>Beds</Th><Th>Occupancy</Th><Th className="text-right">Revenue (Sep)</Th><Th className="text-right">Expenses</Th><Th className="text-right">Pending</Th><Th className="text-right">Complaints</Th><Th>Plan</Th><Th /></tr></thead>
            <tbody>
              {data.properties.map((p, n) => {
                const s = propertyStats(data, p.id)
                return (
                  <Tr key={p.id} onClick={() => navigate(`/owner/properties/${p.id}`)}>
                    <Td>
                      <div className="flex items-center gap-2.5">
                        <span className="size-2.5 rounded-full" style={{ background: SERIES[n] }} />
                        <div><div className="font-medium text-slate-900">{p.name}</div><div className="text-xs text-slate-500">{p.area}, {p.city}</div></div>
                      </div>
                    </Td>
                    <Td className="tabular">{s.totalBeds}</Td>
                    <Td className="w-44"><div className="flex items-center gap-2"><ProgressBar value={s.occupancy} tone={s.occupancy < 0.84 ? 'amber' : 'brand'} className="w-20" /><span className="text-[13px] font-medium tabular">{pct(s.occupancy)}</span></div></Td>
                    <Td className="text-right font-medium tabular">{compactINR(s.collectedThisMonth)}</Td>
                    <Td className="text-right tabular text-slate-500">{compactINR(s.expensesThisMonth)}</Td>
                    <Td className={cn('text-right tabular', s.outstanding ? 'text-rose-600' : 'text-slate-400')}>{compactINR(s.outstanding)}</Td>
                    <Td className="text-right tabular">{s.openComplaints}</Td>
                    <Td><PlanBadge plan={p.plan} /></Td>
                    <Td><ArrowRight size={15} className="text-slate-300" /></Td>
                  </Tr>
                )
              })}
            </tbody>
          </Table>
        </div>
        <ul className="divide-y divide-slate-100 border-t border-slate-100 md:hidden">
          {data.properties.map((p) => {
            const s = propertyStats(data, p.id)
            return (
              <li key={p.id} onClick={() => navigate(`/owner/properties/${p.id}`)} className="px-4 py-3">
                <div className="flex items-center justify-between"><span className="font-medium text-slate-900">{p.name}</span><span className="text-sm font-semibold tabular">{pct(s.occupancy)}</span></div>
                <div className="mt-1 text-xs text-slate-500">{s.totalBeds} beds · {compactINR(s.collectedThisMonth)} revenue · {s.openComplaints} complaints</div>
                <ProgressBar value={s.occupancy} className="mt-2" />
              </li>
            )
          })}
        </ul>
      </Card>

      <Card>
        <CardHeader title="Business activity" subtitle="Payments, admissions, expenses and emergencies across properties" />
        <div className="px-5 pb-2"><ActivityFeed items={activity} dense showProperty propertyName={pName} /></div>
      </Card>
    </div>
  )
}
