import { useMemo, useState } from 'react';
import { BellRing, Download, Receipt } from 'lucide-react';
import { services } from '@/services';
import type { ChargeView, PaymentView } from '@/services/interfaces';
import type { ChargeStatus, PaymentMethod } from '@/types/domain';
import { useQuery } from '@/hooks/useQuery';
import { useMutation } from '@/hooks/useMutation';
import { useDebounced, useQueryParam } from '@/hooks/misc';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button, IconButton } from '@/components/ui/Button';
import { FilterBar, FilterSelect, SearchInput } from '@/components/ui/FilterBar';
import { Tabs, TabPanel } from '@/components/ui/Tabs';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { StatusBadge, statusOptions } from '@/components/ui/StatusBadge';
import { ReceiptModal } from '@/components/domain/ReceiptModal';
import { exportCSV } from '@/lib/export';
import { currentPeriod } from '@/lib/clock';
import { formatDate, formatINR, formatPeriod } from '@/lib/format';
import { cn } from '@/lib/cn';

const PERIODS = ['2026-10', '2026-09', '2026-08'];
export const METHOD_LABEL: Record<PaymentMethod, string> = { upi: 'UPI', cash: 'Cash', bank_transfer: 'Bank transfer', card: 'Card' };

/** Collection summary tiles shared by Owner Finance and Manager Payments. */
export function CollectionTiles({ propertyId, period }: { propertyId?: string; period: string }) {
  const s = useQuery(() => services.payments.summary({ propertyId, period }), [propertyId, period]);
  const d = s.data;
  const tiles: Array<[string, number | undefined, string, string]> = [
    ['Expected', d?.expected, '', `${period === 'all' ? 'All periods' : formatPeriod(period)}`],
    ['Collected', d?.collected, 'text-moss', d ? `${d.collectionPct}% of expected` : ''],
    ['Due, not yet late', d?.pending, '', d ? `${d.pendingCount} residents` : ''],
    ['Overdue', d?.overdue, 'text-brick', d ? `${d.overdueCount} residents` : ''],
  ];
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {tiles.map(([l, v, c, h]) => (
        <Card key={l} className="p-4 sm:p-5">
          <p className="text-[13px] text-bark">{l}</p>
          <p className={cn('mt-1 font-display text-[22px] font-semibold tabular-nums sm:text-[26px]', c)}>{v === undefined ? '…' : formatINR(v)}</p>
          <p className="mt-0.5 text-xs text-dust">{h}</p>
        </Card>
      ))}
    </div>
  );
}

export function chargeColumns(showProperty: boolean, onRemind?: (c: ChargeView) => void): Column<ChargeView>[] {
  return [
    { key: 'student', header: 'Resident', cell: (c) => <div><p className="font-medium">{c.studentName}</p><p className="text-xs text-dust">{c.studentCode}{c.roomNumber ? ` · Rm ${c.roomNumber}` : ''}</p></div>, sortValue: (c) => c.studentName },
    ...(showProperty ? [{ key: 'prop', header: 'Property', cell: (c: ChargeView) => c.propertyName, sortValue: (c: ChargeView) => c.propertyName, hideBelow: 'md' as const }] : []),
    { key: 'period', header: 'Period', cell: (c) => formatPeriod(c.period), sortValue: (c) => c.period, hideBelow: 'sm' },
    { key: 'due', header: 'Due date', cell: (c) => formatDate(c.dueDate), sortValue: (c) => c.dueDate },
    { key: 'amount', header: 'Rent', align: 'right', cell: (c) => formatINR(c.amount), sortValue: (c) => c.amount, hideBelow: 'lg' },
    { key: 'paid', header: 'Paid', align: 'right', cell: (c) => formatINR(c.paid), sortValue: (c) => c.paid },
    { key: 'bal', header: 'Balance', align: 'right', cell: (c) => <span className={c.balance ? 'font-semibold' : 'text-dust'}>{formatINR(c.balance)}</span>, sortValue: (c) => c.balance },
    { key: 'status', header: 'Status', cell: (c) => <StatusBadge kind="charge" value={c.status} />, sortValue: (c) => ['overdue', 'partial', 'pending', 'paid'].indexOf(c.status) },
    ...(onRemind ? [{ key: 'act', header: 'Remind', align: 'right' as const, cell: (c: ChargeView) => <IconButton size="sm" label={c.balance ? `Send reminder to ${c.studentName}` : 'Already paid'} disabled={!c.balance} onClick={(e) => { e.stopPropagation(); onRemind(c); }}><BellRing className="size-4" /></IconButton> }] : []),
  ];
}

export function paymentColumns(showProperty: boolean, onReceipt: (p: PaymentView) => void): Column<PaymentView>[] {
  return [
    { key: 'receipt', header: 'Receipt', cell: (p) => <span className="font-medium text-clay-700">{p.receiptNo}</span>, sortValue: (p) => p.receiptNo },
    { key: 'student', header: 'Resident', cell: (p) => <div><p>{p.studentName}</p><p className="text-xs text-dust">{p.studentCode}</p></div>, sortValue: (p) => p.studentName },
    ...(showProperty ? [{ key: 'prop', header: 'Property', cell: (p: PaymentView) => p.propertyName, sortValue: (p: PaymentView) => p.propertyName, hideBelow: 'md' as const }] : []),
    { key: 'date', header: 'Paid on', cell: (p) => formatDate(p.paidOn), sortValue: (p) => p.paidOn },
    { key: 'for', header: 'For', cell: (p) => formatPeriod(p.period), hideBelow: 'lg' },
    { key: 'method', header: 'Method', cell: (p) => METHOD_LABEL[p.method], sortValue: (p) => p.method, hideBelow: 'sm' },
    { key: 'amount', header: 'Amount', align: 'right', cell: (p) => <span className="font-semibold">{formatINR(p.amount)}</span>, sortValue: (p) => p.amount },
    { key: 'view', header: 'View', align: 'right', cell: (p) => <IconButton size="sm" label={`View receipt ${p.receiptNo}`} onClick={(e) => { e.stopPropagation(); onReceipt(p); }}><Receipt className="size-4" /></IconButton> },
  ];
}

export function FinancePage() {
  const [tab, setTab] = useState<'dues' | 'transactions'>('dues');
  const [period, setPeriod] = useState(currentPeriod());
  const [property, setProperty] = useState('');
  const [status, setStatus] = useState('');
  const [method, setMethod] = useState('');
  const [search, setSearch] = useState('');
  const [receiptId, setReceiptId] = useQueryParam('receipt');
  const ds = useDebounced(search).toLowerCase();
  const props = useQuery(() => services.properties.list(), []);
  const charges = useQuery(() => services.payments.listCharges({ period: period === 'all' ? undefined : period, propertyId: property || undefined, status: (status || undefined) as ChargeStatus | undefined }), [period, property, status]);
  const payments = useQuery(() => services.payments.listPayments({ propertyId: property || undefined, method: (method || undefined) as PaymentMethod | undefined, from: period === 'all' ? undefined : `${period}-01`, to: period === 'all' ? undefined : `${period}-31` }), [property, method, period]);
  const remind = useMutation((ids: string[]) => services.payments.sendReminders(ids), { success: (n) => `Reminder sent to ${n} resident${n === 1 ? '' : 's'} (in-app only in demo mode).` });

  const chargeRows = useMemo(() => (charges.data ?? []).filter((c) => !ds || `${c.studentName} ${c.studentCode}`.toLowerCase().includes(ds)), [charges.data, ds]);
  const payRows = useMemo(() => (payments.data ?? []).filter((p) => !ds || `${p.studentName} ${p.receiptNo} ${p.reference}`.toLowerCase().includes(ds)), [payments.data, ds]);

  const doExport = () => tab === 'dues'
    ? exportCSV(`rent-ledger-${period}`, chargeRows, [{ header: 'Resident', value: (c) => c.studentName }, { header: 'Code', value: (c) => c.studentCode }, { header: 'Property', value: (c) => c.propertyName }, { header: 'Period', value: (c) => c.period }, { header: 'Due date', value: (c) => c.dueDate }, { header: 'Amount', value: (c) => c.amount }, { header: 'Paid', value: (c) => c.paid }, { header: 'Balance', value: (c) => c.balance }, { header: 'Status', value: (c) => c.status }])
    : exportCSV(`transactions-${period}`, payRows, [{ header: 'Receipt', value: (p) => p.receiptNo }, { header: 'Resident', value: (p) => p.studentName }, { header: 'Property', value: (p) => p.propertyName }, { header: 'Paid on', value: (p) => p.paidOn }, { header: 'Period', value: (p) => p.period }, { header: 'Method', value: (p) => p.method }, { header: 'Reference', value: (p) => p.reference }, { header: 'Amount', value: (p) => p.amount }]);

  return (
    <>
      <PageHeader title="Finance" subtitle="Rent dues and transactions across every property."
        actions={<Button variant="secondary" icon={<Download className="size-4" />} onClick={doExport}>Export {tab === 'dues' ? 'ledger' : 'transactions'}</Button>} />
      <CollectionTiles propertyId={property || undefined} period={period} />
      <Card className="mt-5 p-4 sm:p-5">
        <Tabs label="Finance views" value={tab} onChange={setTab} items={[{ value: 'dues', label: 'Rent ledger', count: charges.data?.length }, { value: 'transactions', label: 'Transactions', count: payments.data?.length }]} />
        <TabPanel>
          <FilterBar className="mb-4">
            <SearchInput value={search} onChange={setSearch} placeholder={tab === 'dues' ? 'Resident name or code' : 'Resident, receipt or UTR'} label="Search finance records" />
            <FilterSelect label="Periods" value={period === 'all' ? '' : period} onChange={(v) => setPeriod(v || 'all')} options={PERIODS.map((p) => ({ value: p, label: formatPeriod(p) }))} />
            <FilterSelect label="Properties" value={property} onChange={setProperty} options={(props.data ?? []).map((p) => ({ value: p.id, label: p.name }))} />
            {tab === 'dues' ? <FilterSelect label="Statuses" value={status} onChange={setStatus} options={statusOptions('charge')} />
              : <FilterSelect label="Methods" value={method} onChange={setMethod} options={Object.entries(METHOD_LABEL).map(([value, label]) => ({ value, label }))} />}
          </FilterBar>
          {tab === 'dues'
            ? <DataTable caption="Rent ledger" columns={chargeColumns(true, (c) => void remind.run([c.id]))} rows={charges.data ? chargeRows : undefined} loading={charges.loading} error={charges.error} rowKey={(c) => c.id} pageSize={12} initialSort={{ key: 'status', dir: 'asc' }} />
            : <DataTable caption="Transactions" columns={paymentColumns(true, (p) => setReceiptId(p.id))} rows={payments.data ? payRows : undefined} loading={payments.loading} error={payments.error} rowKey={(p) => p.id} pageSize={12} onRowClick={(p) => setReceiptId(p.id)} rowLabel={(p) => `View receipt ${p.receiptNo}`} />}
        </TabPanel>
      </Card>
      <ReceiptModal paymentId={receiptId} onClose={() => setReceiptId(null)} />
    </>
  );
}
