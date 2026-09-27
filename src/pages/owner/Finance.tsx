import { useState } from 'react'
import { Plus, Receipt, TrendingUp, Wallet, Wrench, Scale } from 'lucide-react'
import { useStore } from '../../store/AppStore'
import { THIS_MONTH, propertyStats } from '../../store/selectors'
import type { Expense } from '../../lib/types'
import { monthlySeries } from '../../lib/analytics'
import { DEMO_TODAY, compactINR, formatDate, formatINR, pct, sleep } from '../../lib/utils'
import { Button, Card, CardHeader, EmptyState, Field, Input, KpiCard, Modal, PageHeader, Pagination, Select, Table, Td, Th, Tr, useToast } from '../../components/ui'
import { Bars, SERIES } from '../../components/charts/Charts'

const CATEGORIES: Expense['category'][] = ['Salaries', 'Electricity', 'Water', 'Groceries', 'Maintenance', 'Internet', 'Supplies', 'Events', 'Other']
const PAGE = 12

export default function OwnerFinance() {
  const { data } = useStore()
  const [pid, setPid] = useState<string>('all')
  const [adding, setAdding] = useState(false)
  const [page, setPage] = useState(1)
  const s = propertyStats(data, pid)
  const series = monthlySeries(data, pid, '6m')
  const expenses = data.expenses.filter((e) => (pid === 'all' || e.propertyId === pid) && e.date.slice(0, 7) === THIS_MONTH).sort((a, b) => b.date.localeCompare(a.date))
  const byCat = CATEGORIES.map((c) => ({ category: c, amount: expenses.filter((e) => e.category === c).reduce((a, e) => a + e.amount, 0) })).filter((r) => r.amount > 0).sort((a, b) => b.amount - a.amount)
  const net = s.collectedThisMonth - s.expensesThisMonth
  const pName = (id: string) => data.properties.find((p) => p.id === id)?.name ?? ''

  return (
    <div>
      <PageHeader
        title="Finance"
        description="Revenue, expenses and outstanding rent · September 2026"
        actions={
          <>
            <Select value={pid} onChange={(e) => { setPid(e.target.value); setPage(1) }} className="h-9 w-52">
              <option value="all">All properties</option>
              {data.properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
            <Button variant="primary" icon={Plus} onClick={() => setAdding(true)}>Add expense</Button>
          </>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <KpiCard label="Revenue" value={compactINR(s.collectedThisMonth)} icon={TrendingUp} tone="green" sub="Collected in Sep" />
        <KpiCard label="Expenses" value={compactINR(s.expensesThisMonth)} icon={Receipt} sub={`${pct(s.collectedThisMonth ? s.expensesThisMonth / s.collectedThisMonth : 0)} of revenue`} />
        <KpiCard label="Maintenance" value={compactINR(s.maintenanceCostThisMonth)} icon={Wrench} tone="amber" sub="Included in expenses" />
        <KpiCard label="Pending" value={compactINR(s.outstanding)} icon={Wallet} tone="red" sub={`${s.overdueCount} overdue invoices`} />
        <KpiCard label="Net" value={compactINR(net)} icon={Scale} tone={net >= 0 ? 'brand' : 'red'} sub={`${pct(s.collectedThisMonth ? net / s.collectedThisMonth : 0)} margin`} className="col-span-2 lg:col-span-1" />
      </div>

      <div className="mb-5 grid gap-5 xl:grid-cols-5">
        <Card className="xl:col-span-3">
          <CardHeader title="Monthly revenue vs expenses" subtitle="Last 6 months — September is live" />
          <div className="px-3 pb-4 sm:px-5">
            <Bars data={series.map((m) => ({ month: m.label, revenue: m.revenue, expenses: m.expenses }))} xKey="month" series={[{ key: 'revenue', label: 'Revenue', color: SERIES[0]! }, { key: 'expenses', label: 'Expenses', color: SERIES[1]! }]} format={compactINR} height={250} />
          </div>
        </Card>
        <Card className="xl:col-span-2">
          <CardHeader title="Expenses by category" subtitle="September" />
          <div className="px-3 pb-4 sm:px-5">
            {byCat.length ? <Bars data={byCat} xKey="category" series={[{ key: 'amount', label: 'Amount', color: SERIES[1]! }]} horizontal labelWidth={88} format={compactINR} height={Math.max(180, byCat.length * 32)} /> : <EmptyState compact icon={Receipt} title="No expenses" />}
          </div>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-5">
        <Card className="xl:col-span-3">
          <CardHeader title="Expense ledger" subtitle={`${expenses.length} entries this month`} />
          {expenses.length ? (
            <>
              <Table>
                <thead><tr><Th>Date</Th><Th>Category</Th><Th>Description</Th>{pid === 'all' && <Th>Property</Th>}<Th className="text-right">Amount</Th></tr></thead>
                <tbody>
                  {expenses.slice((page - 1) * PAGE, page * PAGE).map((e) => (
                    <Tr key={e.id}>
                      <Td className="text-[13px] whitespace-nowrap">{formatDate(e.date)}</Td>
                      <Td className="text-[13px]">{e.category}</Td>
                      <Td className="max-w-64 truncate text-[13px]">{e.description}</Td>
                      {pid === 'all' && <Td className="text-[13px] whitespace-nowrap">{pName(e.propertyId)}</Td>}
                      <Td className="text-right font-medium tabular">{formatINR(e.amount)}</Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
              <Pagination page={page} pageSize={PAGE} total={expenses.length} onPage={setPage} />
            </>
          ) : (
            <EmptyState icon={Receipt} title="No expenses recorded" action={<Button size="sm" onClick={() => setAdding(true)}>Add expense</Button>} />
          )}
        </Card>
        <Card className="xl:col-span-2">
          <CardHeader title="Outstanding by property" subtitle="Past-due rent" />
          <ul className="divide-y divide-slate-100 border-t border-slate-100">
            {data.properties.map((p) => {
              const ps = propertyStats(data, p.id)
              return (
                <li key={p.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <div className="text-sm font-medium text-slate-900">{p.name}</div>
                    <div className="text-xs text-slate-500">{ps.overdueCount} overdue · {ps.partialCount} partial</div>
                  </div>
                  <span className="text-sm font-semibold text-rose-600 tabular">{formatINR(ps.outstanding)}</span>
                </li>
              )
            })}
          </ul>
        </Card>
      </div>
      {adding && <ExpenseModal onClose={() => setAdding(false)} defaultProperty={pid === 'all' ? data.properties[0]!.id : pid} />}
    </div>
  )
}

function ExpenseModal({ onClose, defaultProperty }: { onClose: () => void; defaultProperty: string }) {
  const { data, addExpense } = useStore()
  const toast = useToast()
  const [f, setF] = useState({ category: 'Maintenance' as Expense['category'], amount: '', propertyId: defaultProperty, description: '', date: DEMO_TODAY })
  const [saving, setSaving] = useState(false)
  const save = async () => {
    const amount = Number(f.amount)
    if (!amount || amount <= 0) return toast.error('Enter an amount.')
    setSaving(true)
    await sleep(400)
    addExpense({ category: f.category, amount, propertyId: f.propertyId, description: f.description.trim(), date: f.date })
    setSaving(false)
    toast.success('Expense added', { description: `${formatINR(amount)} · ${f.category} · ${data.properties.find((p) => p.id === f.propertyId)?.name}` })
    onClose()
  }
  return (
    <Modal open onClose={onClose} title="Add expense" footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" loading={saving} onClick={save}>Save expense</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Category"><Select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value as Expense['category'] })}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</Select></Field>
        <Field label="Amount"><Input autoFocus prefix="₹" type="number" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} placeholder="5000" /></Field>
        <Field label="Property"><Select value={f.propertyId} onChange={(e) => setF({ ...f, propertyId: e.target.value })}>{data.properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></Field>
        <Field label="Date"><Input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
        <Field label="Description" className="sm:col-span-2"><Input value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="e.g. Generator diesel refill" /></Field>
      </div>
    </Modal>
  )
}
