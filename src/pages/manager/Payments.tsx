import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { BellRing, CalendarClock, History, IndianRupee, Plus, Receipt, TrendingUp, Wallet } from 'lucide-react'
import { useManagerProperty, useStore } from '../../store/AppStore'
import { CURRENT_CYCLE, dueLabel, dueStatus, idx, locationOf, propertyStats } from '../../store/selectors'
import type { Due, PaymentStatus } from '../../lib/types'
import { compactINR, cycleLabel, formatDate, formatINR, pct } from '../../lib/utils'
import { Avatar, Button, Card, Drawer, EmptyState, KpiCard, PageHeader, Pagination, ProgressBar, SearchInput, Select, StatusBadge, Table, Tabs, Td, Th, Tr, useToast } from '../../components/ui'
import { useModals } from '../../components/domain/ModalsProvider'

type Tab = 'all' | PaymentStatus
const ORDER: Record<PaymentStatus, number> = { overdue: 0, partial: 1, pending: 2, paid: 3 }
const PAGE = 20

export default function PaymentsPage() {
  const { data } = useStore()
  const property = useManagerProperty()
  const modals = useModals()
  const toast = useToast()
  const [params, setParams] = useSearchParams()
  const tab = (params.get('tab') as Tab) ?? 'all'
  const [q, setQ] = useState(params.get('q') ?? '')
  const [cycle, setCycle] = useState('all')
  const [page, setPage] = useState(1)
  const [historyFor, setHistoryFor] = useState<string | null>(null)
  const i = idx(data)
  const st = propertyStats(data, property.id)

  const dues = useMemo(() => data.dues.filter((d) => d.propertyId === property.id), [data.dues, property.id])
  const cycles = Array.from(new Set(dues.map((d) => d.cycle))).sort().reverse()
  const scoped = dues.filter((d) => cycle === 'all' || d.cycle === cycle).filter((d) => {
    const t = q.trim().toLowerCase()
    if (!t) return true
    const s = i.student.get(d.studentId)
    return s?.name.toLowerCase().includes(t) || locationOf(data, s)?.label.toLowerCase().includes(t)
  })
  const count = (s: PaymentStatus) => scoped.filter((d) => dueStatus(d) === s).length
  const rows = scoped
    .filter((d) => tab === 'all' || dueStatus(d) === tab)
    .sort((a, b) => ORDER[dueStatus(a)] - ORDER[dueStatus(b)] || b.cycle.localeCompare(a.cycle) || (i.student.get(a.studentId)?.name ?? '').localeCompare(i.student.get(b.studentId)?.name ?? ''))
  const paged = rows.slice((page - 1) * PAGE, page * PAGE)

  const setTab = (t: Tab) => {
    params.set('tab', t)
    setParams(params, { replace: true })
    setPage(1)
  }
  const latestTxn = (d: Due) => (i.txnsByDue.get(d.id) ?? []).slice().sort((a, b) => b.date.localeCompare(a.date))[0]
  const remind = (d: Due) => toast.success('Reminder sent', { description: `SMS & app reminder sent to ${i.student.get(d.studentId)?.name} (simulated)` })

  const actions = (d: Due) => {
    const status = dueStatus(d)
    const t = latestTxn(d)
    return (
      <div className="flex justify-end gap-1">
        {status !== 'paid' && <Button size="xs" variant="subtle" onClick={() => modals.open({ type: 'recordPayment', studentId: d.studentId, dueId: d.id })}>Record</Button>}
        {status === 'overdue' && <Button size="xs" variant="ghost" icon={BellRing} onClick={() => remind(d)} aria-label="Send reminder" title="Send reminder" />}
        {t && <Button size="xs" variant="ghost" icon={Receipt} onClick={() => modals.open({ type: 'receipt', txnId: t.id })} aria-label="Receipt" title="Generate receipt" />}
        <Button size="xs" variant="ghost" icon={History} onClick={() => setHistoryFor(d.studentId)} aria-label="History" title="Payment history" />
      </div>
    )
  }

  return (
    <div>
      <PageHeader title="Payments" description={`Rent & deposits · ${property.name}`} actions={<Button variant="primary" icon={Plus} onClick={() => modals.open({ type: 'recordPayment' })}>Record Payment</Button>} />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Collected in September" value={compactINR(st.collectedThisMonth)} icon={TrendingUp} tone="green" sub="All payments received" />
        <KpiCard label={`${cycleLabel(CURRENT_CYCLE)} cycle`} value={pct(st.expectedCurrent ? st.collectedCurrent / st.expectedCurrent : 0)} icon={CalendarClock} tone="brand" sub={<span className="flex w-full items-center gap-2"><ProgressBar value={st.expectedCurrent ? st.collectedCurrent / st.expectedCurrent : 0} className="w-16" />{compactINR(st.collectedCurrent)} / {compactINR(st.expectedCurrent)}</span>} />
        <KpiCard label="Pending (past due)" value={formatINR(st.outstanding)} icon={Wallet} tone="red" sub={`${st.overdueCount} overdue students`} onClick={() => setTab('overdue')} />
        <KpiCard label="Partial payments" value={st.partialCount} icon={IndianRupee} tone="amber" sub="Balance remaining" onClick={() => setTab('partial')} />
      </div>

      <Card>
        <div className="px-4 pt-2">
          <Tabs<Tab>
            value={tab}
            onChange={setTab}
            items={[
              { value: 'all', label: 'All', count: scoped.length },
              { value: 'paid', label: 'Paid', count: count('paid') },
              { value: 'pending', label: 'Pending', count: count('pending') },
              { value: 'partial', label: 'Partial', count: count('partial') },
              { value: 'overdue', label: 'Overdue', count: count('overdue') },
            ]}
          />
        </div>
        <div className="flex flex-col gap-2 border-b border-slate-100 p-4 sm:flex-row">
          <SearchInput value={q} onChange={(v) => { setQ(v); setPage(1) }} placeholder="Search student or room" className="sm:w-72" />
          <Select value={cycle} onChange={(e) => { setCycle(e.target.value); setPage(1) }} className="h-9 sm:w-48">
            <option value="all">All billing cycles</option>
            {cycles.map((c) => <option key={c} value={c}>{c === 'deposit' ? 'Security deposits' : cycleLabel(c, true)}</option>)}
          </Select>
        </div>

        {rows.length === 0 ? (
          <EmptyState icon={Wallet} title={tab === 'overdue' ? 'No overdue payments' : 'Nothing here'} description={tab === 'overdue' ? 'Everyone is up to date. Everything looks good.' : 'No invoices match these filters.'} action={tab !== 'all' && <Button size="sm" onClick={() => setTab('all')}>View all payments</Button>} />
        ) : (
          <>
            <div className="hidden md:block">
              <Table>
                <thead>
                  <tr><Th>Student</Th><Th>Room</Th><Th>For</Th><Th className="text-right">Amount</Th><Th className="text-right">Paid</Th><Th>Due date</Th><Th>Status</Th><Th className="text-right">Actions</Th></tr>
                </thead>
                <tbody>
                  {paged.map((d) => {
                    const s = i.student.get(d.studentId)
                    return (
                      <Tr key={d.id}>
                        <Td><div className="flex items-center gap-2.5"><Avatar name={s?.name ?? '?'} size="xs" /><span className="font-medium text-slate-900">{s?.name}</span></div></Td>
                        <Td className="text-[13px]">{locationOf(data, s)?.label ?? '—'}</Td>
                        <Td className="text-[13px] whitespace-nowrap">{dueLabel(d.cycle)}</Td>
                        <Td className="text-right tabular">{formatINR(d.amount)}</Td>
                        <Td className="text-right text-slate-500 tabular">{formatINR(d.paid)}</Td>
                        <Td className="text-[13px] whitespace-nowrap">{formatDate(d.dueDate)}</Td>
                        <Td><StatusBadge status={dueStatus(d)} /></Td>
                        <Td>{actions(d)}</Td>
                      </Tr>
                    )
                  })}
                </tbody>
              </Table>
            </div>
            <ul className="divide-y divide-slate-100 md:hidden">
              {paged.map((d) => {
                const s = i.student.get(d.studentId)
                return (
                  <li key={d.id} className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-slate-900">{s?.name}</div>
                        <div className="text-xs text-slate-500">{locationOf(data, s)?.label ?? '—'} · {dueLabel(d.cycle)} · due {formatDate(d.dueDate)}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold tabular">{formatINR(d.amount - d.paid || d.amount)}</div>
                        <StatusBadge status={dueStatus(d)} />
                      </div>
                    </div>
                    <div className="mt-2">{actions(d)}</div>
                  </li>
                )
              })}
            </ul>
            <Pagination page={page} pageSize={PAGE} total={rows.length} onPage={setPage} />
          </>
        )}
      </Card>

      {historyFor && <HistoryDrawer studentId={historyFor} onClose={() => setHistoryFor(null)} />}
    </div>
  )
}

function HistoryDrawer({ studentId, onClose }: { studentId: string; onClose: () => void }) {
  const { data } = useStore()
  const modals = useModals()
  const i = idx(data)
  const s = i.student.get(studentId)!
  const dues = i.duesByStudent.get(studentId) ?? []
  const txns = i.txnsByStudent.get(studentId) ?? []
  return (
    <Drawer open onClose={onClose} title={`${s.name} · Payment history`} description={`Room ${locationOf(data, s)?.label ?? '—'} · Rent ${formatINR(s.monthlyRent)}/month`}
      footer={<Button variant="primary" icon={Plus} onClick={() => modals.open({ type: 'recordPayment', studentId })}>Record payment</Button>}>
      <div className="mb-2 text-xs font-semibold tracking-wide text-slate-400 uppercase">Invoices</div>
      <ul className="mb-6 divide-y divide-slate-100 rounded-xl border border-slate-200">
        {dues.map((d) => (
          <li key={d.id} className="flex items-center justify-between px-4 py-2.5">
            <div>
              <div className="text-sm font-medium text-slate-900">{dueLabel(d.cycle)}</div>
              <div className="text-xs text-slate-500">{formatINR(d.paid)} of {formatINR(d.amount)} · due {formatDate(d.dueDate)}</div>
            </div>
            <StatusBadge status={dueStatus(d)} />
          </li>
        ))}
      </ul>
      <div className="mb-2 text-xs font-semibold tracking-wide text-slate-400 uppercase">Transactions</div>
      {txns.length ? (
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
          {txns.map((t) => (
            <li key={t.id} className="flex items-center gap-3 px-4 py-2.5">
              <div className="flex-1">
                <div className="text-sm font-medium text-slate-900">{formatINR(t.amount)} · {t.method}</div>
                <div className="text-xs text-slate-500">{t.receiptNo} · {formatDate(t.date, { year: true })} · by {t.recordedBy}</div>
              </div>
              <Button size="xs" variant="ghost" icon={Receipt} onClick={() => modals.open({ type: 'receipt', txnId: t.id })}>Receipt</Button>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState compact icon={Receipt} title="No transactions yet" />
      )}
    </Drawer>
  )
}
