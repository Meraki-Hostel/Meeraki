import { useMemo, useState } from 'react';
import { BellRing, CreditCard, Download } from 'lucide-react';
import { services } from '@/services';
import type { ChargeStatus, PaymentMethod } from '@/types/domain';
import { useQuery } from '@/hooks/useQuery';
import { useMutation } from '@/hooks/useMutation';
import { useDebounced, useQueryParam } from '@/hooks/misc';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { FilterBar, FilterSelect, SearchInput } from '@/components/ui/FilterBar';
import { Tabs, TabPanel } from '@/components/ui/Tabs';
import { DataTable } from '@/components/ui/DataTable';
import { statusOptions } from '@/components/ui/StatusBadge';
import { RecordPaymentModal } from '@/components/domain/RecordPaymentModal';
import { ReceiptModal } from '@/components/domain/ReceiptModal';
import { CollectionTiles, METHOD_LABEL, chargeColumns, paymentColumns } from '@/features/owner/FinancePage';
import { exportCSV } from '@/lib/export';
import { currentPeriod } from '@/lib/clock';
import { formatPeriod } from '@/lib/format';

export function PaymentsPage() {
  const [tab, setTab] = useState<'dues' | 'transactions'>('dues');
  const [period, setPeriod] = useState(currentPeriod());
  const [status, setStatus] = useState('');
  const [method, setMethod] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [recordFor, setRecordFor] = useState<{ chargeId?: string } | null>(null);
  const [receiptId, setReceiptId] = useQueryParam('receipt');
  const ds = useDebounced(search).toLowerCase();
  const charges = useQuery(() => services.payments.listCharges({ period: period === 'all' ? undefined : period, status: (status || undefined) as ChargeStatus | undefined }), [period, status]);
  const payments = useQuery(() => services.payments.listPayments({ method: (method || undefined) as PaymentMethod | undefined, from: from || undefined, to: to || undefined }), [method, from, to]);
  const remind = useMutation((ids: string[]) => services.payments.sendReminders(ids), { success: (n) => `Reminder sent to ${n} resident${n === 1 ? '' : 's'}. In demo mode this is an in-app notification only.`, onSuccess: () => setSelected(new Set()) });
  const chargeRows = useMemo(() => (charges.data ?? []).filter((c) => !ds || `${c.studentName} ${c.studentCode} ${c.roomNumber ?? ''}`.toLowerCase().includes(ds)), [charges.data, ds]);
  const payRows = useMemo(() => (payments.data ?? []).filter((p) => !ds || `${p.studentName} ${p.receiptNo} ${p.reference}`.toLowerCase().includes(ds)), [payments.data, ds]);

  return (
    <>
      <PageHeader title="Payments" subtitle="Record rent, issue receipts and nudge residents with outstanding dues."
        actions={<>
          <Button variant="secondary" icon={<Download className="size-4" />} onClick={() => (tab === 'dues'
            ? exportCSV(`dues-${period}`, chargeRows, [{ header: 'Resident', value: (c) => c.studentName }, { header: 'Room', value: (c) => c.roomNumber }, { header: 'Period', value: (c) => c.period }, { header: 'Due date', value: (c) => c.dueDate }, { header: 'Amount', value: (c) => c.amount }, { header: 'Paid', value: (c) => c.paid }, { header: 'Balance', value: (c) => c.balance }, { header: 'Status', value: (c) => c.status }])
            : exportCSV('payments', payRows, [{ header: 'Receipt', value: (p) => p.receiptNo }, { header: 'Resident', value: (p) => p.studentName }, { header: 'Paid on', value: (p) => p.paidOn }, { header: 'Method', value: (p) => p.method }, { header: 'Reference', value: (p) => p.reference }, { header: 'Amount', value: (p) => p.amount }]))}>Export CSV</Button>
          <Button icon={<CreditCard className="size-4" />} onClick={() => setRecordFor({})}>Record payment</Button>
        </>} />
      <CollectionTiles period={period} />
      <Card className="mt-5 p-4 sm:p-5">
        <Tabs label="Payment views" value={tab} onChange={setTab} items={[{ value: 'dues', label: 'Dues', count: charges.data?.filter((c) => c.balance > 0).length }, { value: 'transactions', label: 'Transactions', count: payments.data?.length }]} />
        <TabPanel>
          {tab === 'dues' ? (
            <>
              <FilterBar className="mb-4" actions={<Button variant="soft" icon={<BellRing className="size-4" />} disabled={!selected.size} loading={remind.pending} onClick={() => void remind.run([...selected])} title={selected.size ? undefined : 'Select dues with a balance first'}>Send reminder{selected.size ? ` (${selected.size})` : ''}</Button>}>
                <SearchInput value={search} onChange={setSearch} placeholder="Resident, ID or room" label="Search dues" />
                <FilterSelect label="Periods" value={period === 'all' ? '' : period} onChange={(v) => setPeriod(v || 'all')} options={['2026-10', '2026-09', '2026-08'].map((p) => ({ value: p, label: formatPeriod(p) }))} />
                <FilterSelect label="Statuses" value={status} onChange={setStatus} options={statusOptions('charge')} />
              </FilterBar>
              <DataTable caption="Rent dues" columns={chargeColumns(false, (c) => void remind.run([c.id]))} rows={charges.data ? chargeRows : undefined} loading={charges.loading} error={charges.error} rowKey={(c) => c.id} pageSize={12}
                selectable selected={selected} onSelectedChange={setSelected} isSelectable={(c) => c.balance > 0} rowLabel={(c) => `${c.studentName} ${c.period}`}
                onRowClick={(c) => c.balance > 0 && setRecordFor({ chargeId: c.id })} initialSort={{ key: 'status', dir: 'asc' }} />
              <p className="mt-2 text-xs text-dust">Click a row with a balance to record a payment against it.</p>
            </>
          ) : (
            <>
              <FilterBar className="mb-4">
                <SearchInput value={search} onChange={setSearch} placeholder="Resident, receipt or UTR" label="Search transactions" />
                <FilterSelect label="Methods" value={method} onChange={setMethod} options={Object.entries(METHOD_LABEL).map(([value, label]) => ({ value, label }))} />
                <Input label="From" hideLabel type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" aria-label="From date" />
                <Input label="To" hideLabel type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" aria-label="To date" />
                {(from || to) && <Button size="sm" variant="ghost" onClick={() => { setFrom(''); setTo(''); }}>Clear dates</Button>}
              </FilterBar>
              <DataTable caption="Transactions" columns={paymentColumns(false, (p) => setReceiptId(p.id))} rows={payments.data ? payRows : undefined} loading={payments.loading} error={payments.error} rowKey={(p) => p.id} pageSize={12} onRowClick={(p) => setReceiptId(p.id)} rowLabel={(p) => `View receipt ${p.receiptNo}`} />
            </>
          )}
        </TabPanel>
      </Card>
      <RecordPaymentModal open={!!recordFor} onClose={() => setRecordFor(null)} chargeId={recordFor?.chargeId} onRecorded={(id) => setReceiptId(id)} />
      <ReceiptModal paymentId={receiptId} onClose={() => setReceiptId(null)} />
    </>
  );
}
