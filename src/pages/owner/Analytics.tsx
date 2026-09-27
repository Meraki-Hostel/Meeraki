import { useState } from 'react'
import { useStore } from '../../store/AppStore'
import { THIS_MONTH, propertyStats } from '../../store/selectors'
import { FEEDBACK_CATEGORIES } from '../../lib/types'
import { FEEDBACK_LABELS, COMPLAINT_CATEGORIES } from '../../lib/meta'
import { RANGES, dailySeries, monthlySeries, type Range } from '../../lib/analytics'
import { compactINR, pct } from '../../lib/utils'
import { Card, CardHeader, PageHeader, Segmented, Select, Table, Td, Th, Tr } from '../../components/ui'
import { Bars, LineTrend, SERIES } from '../../components/charts/Charts'

export default function OwnerAnalytics() {
  const { data } = useStore()
  const [range, setRange] = useState<Range>('6m')
  const [pid, setPid] = useState<string>('all')
  const daily = range === '7d' || range === '30d'
  const props = data.properties
  const scopeProps = pid === 'all' ? props : props.filter((p) => p.id === pid)

  // Occupancy per property (colour follows the property, fixed order)
  const perProp = props.map((p) => (daily ? dailySeries(data, p.id, range === '7d' ? 7 : 30) : monthlySeries(data, p.id, range as '6m' | 'ytd')))
  const occData = perProp[0]!.map((pt, n) => {
    const row: Record<string, string | number> = { label: pt.label }
    props.forEach((p, k) => { if (pid === 'all' || p.id === pid) row[p.id] = +(perProp[k]![n]!.occupancy * 100).toFixed(1) })
    return row
  })
  const occSeries = props.map((p, k) => ({ key: p.id, label: p.name, color: SERIES[k]! })).filter((s) => pid === 'all' || s.key === pid)

  const money = daily ? dailySeries(data, pid, range === '7d' ? 7 : 30) : monthlySeries(data, pid, range as '6m' | 'ytd')
  const moneyData = money.map((m) => ({ label: m.label, revenue: m.revenue, expenses: m.expenses }))

  const outstanding = props.map((p) => ({ name: p.name, amount: propertyStats(data, p.id).outstanding }))
  const maintenance = props.map((p) => ({ name: p.name, amount: propertyStats(data, p.id).maintenanceCostThisMonth }))
  const complaints = data.complaints.filter((c) => pid === 'all' || c.propertyId === pid)
  const catData = COMPLAINT_CATEGORIES.map((c) => ({ category: c, open: complaints.filter((x) => x.category === c && x.status !== 'resolved').length, resolved: complaints.filter((x) => x.category === c && x.status === 'resolved').length })).filter((r) => r.open + r.resolved)
  const fb = data.feedback.filter((f) => f.month === THIS_MONTH && (pid === 'all' || f.propertyId === pid))
  const fbData = FEEDBACK_CATEGORIES.map((c) => ({ category: FEEDBACK_LABELS[c]!, score: fb.length ? +(fb.reduce((a, f) => a + f.ratings[c], 0) / fb.length).toFixed(2) : 0 }))

  return (
    <div>
      <PageHeader
        title="Analytics"
        description="Portfolio trends and property comparison"
        actions={
          <>
            <Select value={pid} onChange={(e) => setPid(e.target.value)} className="h-9 w-48">
              <option value="all">All properties</option>
              {props.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
            <Segmented size="sm" items={RANGES} value={range} onChange={setRange} />
          </>
        }
      />
      {daily && <p className="-mt-3 mb-4 text-xs text-slate-500">Daily view: collections come from recorded transactions; occupancy history is modelled for the prototype.</p>}

      <div className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader title="Occupancy trend" subtitle="% of beds occupied" />
          <div className="px-3 pb-4 sm:px-5"><LineTrend data={occData} xKey="label" series={occSeries} format={(v) => `${Math.round(v)}%`} yDomain={[50, 100]} height={250} /></div>
        </Card>
        <Card>
          <CardHeader title={daily ? 'Daily collections & expenses' : 'Revenue & expenses'} subtitle={pid === 'all' ? 'All properties' : scopeProps[0]?.name} />
          <div className="px-3 pb-4 sm:px-5">
            {daily ? (
              <Bars data={moneyData} xKey="label" series={[{ key: 'revenue', label: 'Collections', color: SERIES[0]! }, { key: 'expenses', label: 'Expenses', color: SERIES[1]! }]} format={compactINR} height={250} />
            ) : (
              <LineTrend data={moneyData} xKey="label" series={[{ key: 'revenue', label: 'Revenue', color: SERIES[0]! }, { key: 'expenses', label: 'Expenses', color: SERIES[1]! }]} format={compactINR} height={250} />
            )}
          </div>
        </Card>
        <Card>
          <CardHeader title="Outstanding payments" subtitle="Past-due rent by property" />
          <div className="px-3 pb-4 sm:px-5"><Bars data={outstanding} xKey="name" series={[{ key: 'amount', label: 'Outstanding', color: SERIES[0]! }]} horizontal labelWidth={150} format={compactINR} height={220} /></div>
        </Card>
        <Card>
          <CardHeader title="Maintenance costs" subtitle="September, by property" />
          <div className="px-3 pb-4 sm:px-5"><Bars data={maintenance} xKey="name" series={[{ key: 'amount', label: 'Maintenance', color: SERIES[1]! }]} horizontal labelWidth={150} format={compactINR} height={220} /></div>
        </Card>
        <Card>
          <CardHeader title="Complaint categories" subtitle="Open vs resolved" />
          <div className="px-3 pb-4 sm:px-5"><Bars data={catData} xKey="category" series={[{ key: 'open', label: 'Open', color: SERIES[1]! }, { key: 'resolved', label: 'Resolved', color: SERIES[0]! }]} stacked format={(v) => String(v)} height={240} /></div>
        </Card>
        <Card>
          <CardHeader title="Student feedback" subtitle={`September · ${fb.length} responses · out of 5`} />
          <div className="px-3 pb-4 sm:px-5"><Bars data={fbData} xKey="category" series={[{ key: 'score', label: 'Average', color: SERIES[2]! }]} format={(v) => v.toFixed(1)} max={5} height={240} /></div>
        </Card>
      </div>

      <Card className="mt-5">
        <CardHeader title="Property comparison" subtitle="September 2026" />
        <Table>
          <thead><tr><Th>Property</Th><Th className="text-right">Beds</Th><Th className="text-right">Occupancy</Th><Th className="text-right">Revenue</Th><Th className="text-right">Expenses</Th><Th className="text-right">Net margin</Th><Th className="text-right">Pending</Th><Th className="text-right">Open complaints</Th><Th className="text-right">Satisfaction</Th></tr></thead>
          <tbody>
            {props.map((p, k) => {
              const s = propertyStats(data, p.id)
              const margin = s.collectedThisMonth ? (s.collectedThisMonth - s.expensesThisMonth) / s.collectedThisMonth : 0
              return (
                <Tr key={p.id}>
                  <Td><span className="flex items-center gap-2"><span className="size-2.5 rounded-full" style={{ background: SERIES[k] }} /><span className="font-medium text-slate-900">{p.name}</span></span></Td>
                  <Td className="text-right tabular">{s.totalBeds}</Td>
                  <Td className="text-right tabular">{pct(s.occupancy)}</Td>
                  <Td className="text-right tabular">{compactINR(s.collectedThisMonth)}</Td>
                  <Td className="text-right tabular">{compactINR(s.expensesThisMonth)}</Td>
                  <Td className="text-right tabular">{pct(margin)}</Td>
                  <Td className="text-right text-rose-600 tabular">{compactINR(s.outstanding)}</Td>
                  <Td className="text-right tabular">{s.openComplaints}</Td>
                  <Td className="text-right tabular">{s.satisfaction.toFixed(2)}</Td>
                </Tr>
              )
            })}
          </tbody>
        </Table>
      </Card>
    </div>
  )
}
