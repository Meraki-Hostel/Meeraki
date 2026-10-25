import { useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { services } from '@/services';
import type { MaintenanceInput, MaintenanceView } from '@/services/interfaces';
import type { MaintenanceCategory, MaintenanceStatus, Priority } from '@/types/domain';
import { useQuery } from '@/hooks/useQuery';
import { useMutation } from '@/hooks/useMutation';
import { useDebounced, useQueryParam } from '@/hooks/misc';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, DescriptionList } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/Field';
import { Drawer, Modal } from '@/components/ui/Modal';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { FilterBar, FilterSelect, SearchInput } from '@/components/ui/FilterBar';
import { StatusBadge, statusOptions } from '@/components/ui/StatusBadge';
import { formatDate, formatDateTime, formatINR, sentenceCase } from '@/lib/format';
import { cn } from '@/lib/cn';

const CATS: MaintenanceCategory[] = ['electrical', 'plumbing', 'carpentry', 'painting', 'appliance', 'civil', 'pest_control'];
const FLOW: MaintenanceStatus[] = ['open', 'assigned', 'in_progress', 'on_hold', 'completed'];

function NewTicketModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const staff = useQuery(() => (open ? services.staff.list({ status: 'active' }) : Promise.resolve([])), [open]);
  const blank = { title: '', description: '', category: 'electrical' as MaintenanceCategory, location: '', priority: 'medium' as Priority, assigneeStaffId: '', vendor: '', estimatedCost: '0' };
  const [f, setF] = useState(blank);
  useEffect(() => { if (open) setF(blank); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const m = useMutation((i: MaintenanceInput) => services.maintenance.create(i), { success: 'Ticket created.', onSuccess: onClose });
  const e = m.fieldErrors;
  return (
    <Modal open={open} onClose={onClose} size="lg" title="New maintenance ticket"
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={m.pending} onClick={() => void m.run({ ...f, estimatedCost: Number(f.estimatedCost), assigneeStaffId: f.assigneeStaffId || undefined })}>Create ticket</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input className="sm:col-span-2" label="What needs fixing?" required value={f.title} onChange={(ev) => setF({ ...f, title: ev.target.value })} error={e.title} placeholder="e.g. Replace tube light, 2nd floor corridor" />
        <Select label="Category" value={f.category} onChange={(ev) => setF({ ...f, category: ev.target.value as MaintenanceCategory })} options={CATS.map((c) => ({ value: c, label: sentenceCase(c) }))} />
        <Input label="Location" required value={f.location} onChange={(ev) => setF({ ...f, location: ev.target.value })} error={e.location} placeholder="Room 204, Terrace…" />
        <Select label="Priority" value={f.priority} onChange={(ev) => setF({ ...f, priority: ev.target.value as Priority })} options={statusOptions('priority')} />
        <Select label="Assign to staff" value={f.assigneeStaffId} onChange={(ev) => setF({ ...f, assigneeStaffId: ev.target.value })} placeholder="Unassigned" options={(staff.data ?? []).map((s) => ({ value: s.id, label: `${s.name} (${sentenceCase(s.role)})` }))} />
        <Input label="Vendor" value={f.vendor} onChange={(ev) => setF({ ...f, vendor: ev.target.value })} placeholder="Optional" />
        <Input label="Estimated cost (₹)" type="number" min={0} value={f.estimatedCost} onChange={(ev) => setF({ ...f, estimatedCost: ev.target.value })} error={e.estimatedCost} />
        <Textarea className="sm:col-span-2" rows={3} label="Details" value={f.description} onChange={(ev) => setF({ ...f, description: ev.target.value })} />
      </div>
    </Modal>
  );
}

function TicketDrawer({ t, onClose }: { t: MaintenanceView | null; onClose: () => void }) {
  const staff = useQuery(() => (t ? services.staff.list({ status: 'active' }) : Promise.resolve([])), [t?.id]);
  const [f, setF] = useState({ status: 'open' as MaintenanceStatus, priority: 'medium' as Priority, assigneeStaffId: '', vendor: '', estimatedCost: '', actualCost: '' });
  useEffect(() => { if (t) setF({ status: t.status, priority: t.priority, assigneeStaffId: t.assigneeStaffId ?? '', vendor: t.vendor ?? '', estimatedCost: String(t.estimatedCost), actualCost: t.actualCost !== undefined ? String(t.actualCost) : '' }); }, [t?.id, t?.updatedAt]); // eslint-disable-line react-hooks/exhaustive-deps
  const m = useMutation(() => services.maintenance.update(t!.id, { status: f.status, priority: f.priority, assigneeStaffId: f.assigneeStaffId || null, vendor: f.vendor, estimatedCost: Number(f.estimatedCost), actualCost: f.actualCost === '' ? undefined : Number(f.actualCost) }), { success: 'Ticket updated.' });
  if (!t) return null;
  const e = m.fieldErrors;
  return (
    <Drawer open onClose={onClose} title={t.title} description={<span className="flex items-center gap-2">{t.ticketNo} <StatusBadge kind="maintenance" value={t.status} /> <StatusBadge kind="priority" value={t.priority} /></span>}
      footer={<Button loading={m.pending} onClick={() => void m.run()}>Save changes</Button>}>
      <div className="space-y-6">
        <DescriptionList items={[{ label: 'Location', value: t.location }, { label: 'Category', value: sentenceCase(t.category) }, { label: 'Created', value: formatDateTime(t.createdAt) }, { label: 'Last update', value: formatDateTime(t.updatedAt) }]} />
        {t.description && <p className="text-sm text-bark">{t.description}</p>}
        <section aria-labelledby="flow-h">
          <h3 id="flow-h" className="mb-2 text-base font-semibold">Status</h3>
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Ticket status">
            {FLOW.map((s) => (
              <button key={s} type="button" role="radio" aria-checked={f.status === s} onClick={() => setF({ ...f, status: s })}
                className={cn('rounded-full border px-3 py-1 text-xs font-medium', f.status === s ? 'border-clay-500 bg-clay-50 text-clay-800' : 'border-line text-bark hover:border-line-strong')}>{sentenceCase(s)}</button>
            ))}
          </div>
        </section>
        <div className="grid gap-4 sm:grid-cols-2">
          <Select label="Priority" value={f.priority} onChange={(ev) => setF({ ...f, priority: ev.target.value as Priority })} options={statusOptions('priority')} />
          <Select label="Assignee" value={f.assigneeStaffId} onChange={(ev) => setF({ ...f, assigneeStaffId: ev.target.value })} placeholder="Unassigned" options={(staff.data ?? []).map((s) => ({ value: s.id, label: s.name }))} />
          <Input className="sm:col-span-2" label="Vendor" value={f.vendor} onChange={(ev) => setF({ ...f, vendor: ev.target.value })} />
          <Input label="Estimated cost (₹)" type="number" min={0} value={f.estimatedCost} onChange={(ev) => setF({ ...f, estimatedCost: ev.target.value })} error={e.estimatedCost} />
          <Input label="Actual cost (₹)" type="number" min={0} value={f.actualCost} onChange={(ev) => setF({ ...f, actualCost: ev.target.value })} error={e.actualCost} hint="Required to complete" />
        </div>
      </div>
    </Drawer>
  );
}

export function MaintenancePage() {
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [search, setSearch] = useState('');
  const [newParam, setNewParam] = useQueryParam('new');
  const [openId, setOpenId] = useState<string | null>(null);
  const ds = useDebounced(search).toLowerCase();
  const q = useQuery(() => services.maintenance.list({ status: (status || undefined) as MaintenanceStatus | undefined, priority: (priority || undefined) as Priority | undefined }), [status, priority]);
  const allQ = useQuery(() => services.maintenance.list(), []);
  const rows = useMemo(() => (q.data ?? []).filter((t) => !ds || `${t.ticketNo} ${t.title} ${t.location} ${t.vendor ?? ''}`.toLowerCase().includes(ds)), [q.data, ds]);
  const all = allQ.data ?? [];
  const spend = all.reduce((a, t) => a + (t.actualCost ?? 0), 0);
  const committed = all.filter((t) => t.status !== 'completed').reduce((a, t) => a + t.estimatedCost, 0);
  const cols: Column<MaintenanceView>[] = [
    { key: 'no', header: 'Ticket', cell: (t) => <span className="font-medium text-clay-700">{t.ticketNo}</span>, sortValue: (t) => t.ticketNo },
    { key: 'title', header: 'Issue', cell: (t) => <div className="min-w-[200px]"><p className="font-medium">{t.title}</p><p className="text-xs text-dust">{t.location} · {sentenceCase(t.category)}</p></div>, sortValue: (t) => t.title },
    { key: 'pr', header: 'Priority', cell: (t) => <StatusBadge kind="priority" value={t.priority} />, sortValue: (t) => ['low', 'medium', 'high', 'urgent'].indexOf(t.priority) },
    { key: 'st', header: 'Status', cell: (t) => <StatusBadge kind="maintenance" value={t.status} />, sortValue: (t) => FLOW.indexOf(t.status) },
    { key: 'who', header: 'Assignee · vendor', cell: (t) => <div className="text-sm">{t.assigneeName ?? <span className="text-mute">Unassigned</span>}{t.vendor && <p className="text-xs text-dust">{t.vendor}</p>}</div>, hideBelow: 'md' },
    { key: 'cost', header: 'Cost', align: 'right', cell: (t) => t.actualCost !== undefined ? formatINR(t.actualCost) : <span className="text-dust">est. {formatINR(t.estimatedCost)}</span>, sortValue: (t) => t.actualCost ?? t.estimatedCost },
    { key: 'upd', header: 'Updated', cell: (t) => formatDate(t.updatedAt), sortValue: (t) => t.updatedAt, hideBelow: 'lg' },
  ];
  const opened = (q.data ?? []).find((t) => t.id === openId) ?? all.find((t) => t.id === openId) ?? null;
  return (
    <>
      <PageHeader title="Maintenance" subtitle="Tickets for repairs and upkeep — from open to completed, with costs." actions={<Button icon={<Plus className="size-4" />} onClick={() => setNewParam('1')}>New ticket</Button>} />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[['Open & assigned', String(all.filter((t) => t.status === 'open' || t.status === 'assigned').length)], ['In progress / on hold', String(all.filter((t) => t.status === 'in_progress' || t.status === 'on_hold').length)], ['Committed (estimates)', formatINR(committed)], ['Spent to date', formatINR(spend)]].map(([l, v]) => (
          <Card key={l} className="p-4"><p className="text-[13px] text-bark">{l}</p><p className="mt-1 font-display text-2xl font-semibold tabular-nums">{v}</p></Card>
        ))}
      </div>
      <Card className="p-4 sm:p-5">
        <FilterBar className="mb-4">
          <SearchInput value={search} onChange={setSearch} placeholder="Ticket, issue, location or vendor" label="Search tickets" />
          <FilterSelect label="Statuses" value={status} onChange={setStatus} options={statusOptions('maintenance')} />
          <FilterSelect label="Priorities" value={priority} onChange={setPriority} options={statusOptions('priority')} />
        </FilterBar>
        <DataTable caption="Maintenance tickets" columns={cols} rows={q.data ? rows : undefined} loading={q.loading} error={q.error} rowKey={(t) => t.id} onRowClick={(t) => setOpenId(t.id)} rowLabel={(t) => `Open ${t.ticketNo}`} initialSort={{ key: 'upd', dir: 'desc' }} />
      </Card>
      <NewTicketModal open={newParam === '1'} onClose={() => setNewParam(null)} />
      <TicketDrawer t={opened} onClose={() => setOpenId(null)} />
    </>
  );
}
