import { useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import { services } from '@/services';
import type { ComplaintView } from '@/services/interfaces';
import type { ComplaintCategory, ComplaintStatus, Priority } from '@/types/domain';
import { useQuery } from '@/hooks/useQuery';
import { useDebounced, useQueryParam } from '@/hooks/misc';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { FilterBar, FilterSelect, SearchInput } from '@/components/ui/FilterBar';
import { StatusBadge, statusOptions } from '@/components/ui/StatusBadge';
import { ComplaintDrawer } from '@/components/domain/ComplaintDrawer';
import { exportCSV } from '@/lib/export';
import { formatDate, sentenceCase } from '@/lib/format';
import { EmptyState } from '@/components/ui/States';

const CATEGORIES: ComplaintCategory[] = ['electrical', 'plumbing', 'cleaning', 'internet', 'food', 'furniture', 'security', 'other'];

export function ComplaintsBoard({ scope }: { scope: 'owner' | 'manager' }) {
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [category, setCategory] = useState('');
  const [property, setProperty] = useState('');
  const [search, setSearch] = useState('');
  const ds = useDebounced(search);
  const [openId, setOpenId] = useQueryParam('id');

  const list = useQuery(() => services.complaints.list({ status: (status || undefined) as ComplaintStatus | undefined, priority: (priority || undefined) as Priority | undefined, category: (category || undefined) as ComplaintCategory | undefined, propertyId: property || undefined }), [status, priority, category, property]);
  const props = useQuery(() => (scope === 'owner' ? services.properties.list() : Promise.resolve([])), [scope]);
  const staff = useQuery(() => services.staff.list(), []);
  const all = useQuery(() => services.complaints.list(), []);

  const rows = useMemo(() => {
    const q = ds.trim().toLowerCase();
    return (list.data ?? []).filter((c) => !q || `${c.ticketNo} ${c.title} ${c.studentName} ${c.roomNumber ?? ''}`.toLowerCase().includes(q));
  }, [list.data, ds]);

  const counts = useMemo(() => {
    const a = all.data ?? [];
    return { open: a.filter((c) => c.status === 'open').length, progress: a.filter((c) => c.status === 'in_progress').length, urgent: a.filter((c) => c.priority === 'urgent' && (c.status === 'open' || c.status === 'in_progress')).length, resolved: a.filter((c) => c.status === 'resolved' || c.status === 'closed').length };
  }, [all.data]);

  const columns: Column<ComplaintView>[] = [
    { key: 'ticket', header: 'Ticket', cell: (c) => <span className="font-medium text-clay-700">{c.ticketNo}</span>, sortValue: (c) => c.ticketNo },
    { key: 'title', header: 'Issue', cell: (c) => <div className="min-w-[200px]"><p className="font-medium">{c.title}</p><p className="text-xs text-dust">{sentenceCase(c.category)}</p></div>, sortValue: (c) => c.title },
    { key: 'resident', header: 'Resident', cell: (c) => <div><p>{c.studentName}</p><p className="text-xs text-dust">{scope === 'owner' ? c.propertyName : c.roomNumber ? `Room ${c.roomNumber}` : '—'}</p></div>, sortValue: (c) => c.studentName },
    { key: 'priority', header: 'Priority', cell: (c) => <StatusBadge kind="priority" value={c.priority} />, sortValue: (c) => ['low', 'medium', 'high', 'urgent'].indexOf(c.priority) },
    { key: 'status', header: 'Status', cell: (c) => <StatusBadge kind="complaint" value={c.status} />, sortValue: (c) => c.status },
    { key: 'assignee', header: 'Assignee', cell: (c) => c.assigneeName ?? <span className="text-mute">Unassigned</span>, hideBelow: 'md' },
    { key: 'updated', header: 'Updated', cell: (c) => formatDate(c.updatedAt), sortValue: (c) => c.updatedAt, hideBelow: 'lg' },
  ];

  const doExport = () => exportCSV(`complaints-${scope}`, rows, [
    { header: 'Ticket', value: (c) => c.ticketNo }, { header: 'Title', value: (c) => c.title }, { header: 'Category', value: (c) => c.category },
    { header: 'Property', value: (c) => c.propertyName }, { header: 'Room', value: (c) => c.roomNumber }, { header: 'Resident', value: (c) => c.studentName },
    { header: 'Priority', value: (c) => c.priority }, { header: 'Status', value: (c) => c.status }, { header: 'Assignee', value: (c) => c.assigneeName }, { header: 'Raised', value: (c) => c.createdAt },
  ]);

  const tiles: Array<[string, number, string, string]> = [['Open', counts.open, 'open', ''], ['In progress', counts.progress, 'in_progress', ''], ['Urgent & active', counts.urgent, '', 'urgent'], ['Resolved / closed', counts.resolved, 'resolved', '']];

  return (
    <>
      <PageHeader title="Complaints" subtitle={scope === 'owner' ? 'Every complaint across your portfolio. Open one to triage or follow up.' : 'Triage resident issues, assign staff and keep residents updated.'}
        actions={<Button variant="secondary" icon={<Download className="size-4" />} onClick={doExport} disabled={!rows.length}>Export CSV</Button>} />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map(([label, n, st, pr]) => (
          <button key={label} type="button" onClick={() => { setStatus(st); setPriority(pr); }} className="surface p-4 text-left transition-colors hover:border-line-strong" aria-label={`Filter: ${label} (${n})`}>
            <p className="text-[13px] text-bark">{label}</p>
            <p className="mt-1 font-display text-2xl font-semibold tabular-nums">{n}</p>
          </button>
        ))}
      </div>
      <Card className="p-4 sm:p-5">
        <FilterBar className="mb-4">
          <SearchInput value={search} onChange={setSearch} placeholder="Ticket, issue, resident…" label="Search complaints" />
          {scope === 'owner' && <FilterSelect label="Properties" value={property} onChange={setProperty} options={(props.data ?? []).map((p) => ({ value: p.id, label: p.name }))} />}
          <FilterSelect label="Statuses" value={status} onChange={setStatus} options={statusOptions('complaint')} />
          <FilterSelect label="Priorities" value={priority} onChange={setPriority} options={statusOptions('priority')} />
          <FilterSelect label="Categories" value={category} onChange={setCategory} options={CATEGORIES.map((c) => ({ value: c, label: sentenceCase(c) }))} />
        </FilterBar>
        <DataTable caption="Complaints" columns={columns} rows={list.data ? rows : undefined} loading={list.loading} error={list.error} onRetry={list.reload}
          rowKey={(c) => c.id} onRowClick={(c) => setOpenId(c.id)} rowLabel={(c) => `Open ${c.ticketNo}: ${c.title}`} initialSort={{ key: 'updated', dir: 'desc' }}
          empty={<EmptyState title="No complaints match" message="Try clearing a filter. New complaints from residents appear here instantly." />} />
      </Card>
      <ComplaintDrawer complaintId={openId} onClose={() => setOpenId(null)} staff={staff.data ?? []} />
    </>
  );
}
