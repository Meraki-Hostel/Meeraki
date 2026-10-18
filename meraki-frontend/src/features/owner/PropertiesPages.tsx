import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LayoutGrid, List, MapPin, MoreHorizontal, Plus } from 'lucide-react';
import { services } from '@/services';
import type { PropertyWithStats } from '@/services/interfaces';
import type { PropertyStatus, PropertyType } from '@/types/domain';
import { useQuery } from '@/hooks/useQuery';
import { useMutation } from '@/hooks/useMutation';
import { useDebounced } from '@/hooks/misc';
import { useConfirm } from '@/app/providers/ConfirmProvider';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, ProgressBar } from '@/components/ui/Card';
import { ButtonLink, IconButton } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Dropdown } from '@/components/ui/Dropdown';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { FilterBar, FilterSelect, SearchInput } from '@/components/ui/FilterBar';
import { SegmentedControl } from '@/components/ui/Tabs';
import { StatusBadge, statusOptions } from '@/components/ui/StatusBadge';
import { EmptyState, QueryBoundary, Skeleton } from '@/components/ui/States';
import { PropertyImage } from '@/components/brand/PropertyImage';
import { formatINR, sentenceCase } from '@/lib/format';
import { PropertyForm } from './PropertyForm';

export function PropertyActions({ p, onEdit }: { p: PropertyWithStats; onEdit: () => void }) {
  const confirm = useConfirm();
  const navigate = useNavigate();
  const set = useMutation((s: PropertyStatus) => services.properties.setStatus(p.id, s), { success: (r) => `${r.name} is now ${sentenceCase(r.status).toLowerCase()}.` });
  const change = async (s: PropertyStatus) => {
    if (s === 'inactive' && !(await confirm({ title: `Mark ${p.name} inactive?`, message: `${p.stats.students} residents are still assigned here. Inactive properties stay visible in reports but are flagged as not operating.`, confirmLabel: 'Mark inactive', tone: 'danger' }))) return;
    void set.run(s);
  };
  return (
    <Dropdown label={`Actions for ${p.name}`} items={[
      { label: 'View details', onSelect: () => navigate(`/owner/properties/${p.id}`) },
      { label: 'Edit details', onSelect: onEdit },
      'separator',
      ...(['active', 'onboarding', 'inactive'] as PropertyStatus[]).filter((s) => s !== p.status).map((s) => ({ label: `Mark ${sentenceCase(s).toLowerCase()}`, danger: s === 'inactive', onSelect: () => void change(s) })),
    ]} trigger={({ toggle, open, id }) => <IconButton label={`Actions for ${p.name}`} size="sm" onClick={(e) => { e.preventDefault(); toggle(); }} aria-haspopup="menu" aria-expanded={open} aria-controls={open ? id : undefined}><MoreHorizontal className="size-4" /></IconButton>} />
  );
}

export function EditPropertyModal({ property, onClose }: { property: PropertyWithStats | null; onClose: () => void }) {
  const m = useMutation((i: Parameters<typeof services.properties.update>[1]) => services.properties.update(property!.id, i), { success: 'Property details saved.', onSuccess: onClose });
  return (
    <Modal open={!!property} onClose={onClose} title={`Edit ${property?.name ?? 'property'}`} size="xl">
      {property && <PropertyForm initial={property} submitLabel="Save changes" pending={m.pending} serverErrors={m.fieldErrors} onCancel={onClose} onSubmit={(i) => void m.run(i)} />}
    </Modal>
  );
}

export function PropertiesPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [type, setType] = useState('');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [editing, setEditing] = useState<PropertyWithStats | null>(null);
  const ds = useDebounced(search);
  const navigate = useNavigate();
  const q = useQuery(() => services.properties.list({ search: ds, status: (status || undefined) as PropertyStatus | undefined, type: (type || undefined) as PropertyType | undefined }), [ds, status, type]);

  const columns: Column<PropertyWithStats>[] = useMemo(() => [
    { key: 'name', header: 'Property', cell: (p) => <div className="flex items-center gap-3"><PropertyImage variant={p.imageVariant} name={p.name} className="size-10 rounded-lg" /><div><p className="font-medium">{p.name}</p><p className="text-xs text-dust">{p.locality}</p></div></div>, sortValue: (p) => p.name },
    { key: 'status', header: 'Status', cell: (p) => <StatusBadge kind="property" value={p.status} />, sortValue: (p) => p.status },
    { key: 'type', header: 'Type', cell: (p) => sentenceCase(p.type), hideBelow: 'md' },
    { key: 'occ', header: 'Occupancy', cell: (p) => <div className="flex min-w-[120px] items-center gap-2"><ProgressBar value={p.stats.occupancyPct} label="Occupancy" /><span className="text-xs tabular-nums">{p.stats.occupancyPct}%</span></div>, sortValue: (p) => p.stats.occupancyPct },
    { key: 'beds', header: 'Beds', align: 'right', cell: (p) => `${p.stats.occupiedBeds}/${p.stats.beds}`, sortValue: (p) => p.stats.beds, hideBelow: 'sm' },
    { key: 'rent', header: 'Collected (Oct)', align: 'right', cell: (p) => formatINR(p.stats.collectedRent), sortValue: (p) => p.stats.collectedRent, hideBelow: 'lg' },
    { key: 'mgr', header: 'Manager', cell: (p) => p.stats.managerName ?? <span className="text-mute">Unassigned</span>, hideBelow: 'lg' },
    { key: 'act', header: 'Actions', align: 'right', cell: (p) => <span onClick={(e) => e.stopPropagation()}><PropertyActions p={p} onEdit={() => setEditing(p)} /></span> },
  ], []);

  return (
    <>
      <PageHeader title="Properties" subtitle="Your hostels, their occupancy and how rent collection is tracking."
        actions={<ButtonLink to="/owner/properties/new" icon={<Plus className="size-4" aria-hidden />}>Add property</ButtonLink>} />
      <FilterBar className="mb-5" actions={<SegmentedControl label="Layout" value={view} onChange={setView} options={[{ value: 'grid', label: 'Grid', icon: <LayoutGrid className="size-4" aria-hidden /> }, { value: 'list', label: 'List', icon: <List className="size-4" aria-hidden /> }]} />}>
        <SearchInput value={search} onChange={setSearch} placeholder="Name, locality or code" label="Search properties" />
        <FilterSelect label="Statuses" value={status} onChange={setStatus} options={statusOptions('property')} />
        <FilterSelect label="Types" value={type} onChange={setType} options={[{ value: 'boys', label: 'Boys' }, { value: 'girls', label: 'Girls' }, { value: 'coed', label: 'Co-ed' }]} />
      </FilterBar>
      <QueryBoundary query={q} skeleton={<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-72" />)}</div>}>
        {(list) => list.length === 0 ? (
          <Card><EmptyState title="No properties match" message="Clear filters, or add your next property." action={<ButtonLink to="/owner/properties/new" size="sm">Add property</ButtonLink>} /></Card>
        ) : view === 'list' ? (
          <Card className="p-4"><DataTable caption="Properties" columns={columns} rows={list} rowKey={(p) => p.id} onRowClick={(p) => navigate(`/owner/properties/${p.id}`)} rowLabel={(p) => `Open ${p.name}`} /></Card>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {list.map((p) => (
              <li key={p.id} className="surface relative overflow-hidden">
                <Link to={`/owner/properties/${p.id}`} className="block" aria-label={`Open ${p.name}`}>
                  <PropertyImage variant={p.imageVariant} name={p.name} className="h-36 w-full" />
                </Link>
                <div className="absolute right-3 top-3 rounded-xl bg-cream/90"><PropertyActions p={p} onEdit={() => setEditing(p)} /></div>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h2 className="truncate text-lg font-semibold"><Link to={`/owner/properties/${p.id}`} className="hover:underline">{p.name}</Link></h2>
                      <p className="flex items-center gap-1 text-xs text-dust"><MapPin className="size-3" aria-hidden />{p.locality}, {p.city} · {sentenceCase(p.type)}</p>
                    </div>
                    <StatusBadge kind="property" value={p.status} />
                  </div>
                  <div className="mt-4 flex items-center gap-2"><ProgressBar value={p.stats.occupancyPct} label={`${p.name} occupancy`} /><span className="text-xs tabular-nums text-bark">{p.stats.occupancyPct}%</span></div>
                  <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
                    {[['Beds', `${p.stats.occupiedBeds}/${p.stats.beds}`], ['Collected', formatINR(p.stats.collectedRent)], ['Open issues', String(p.stats.openComplaints)]].map(([l, v]) => (
                      <div key={l} className="rounded-xl bg-sand/50 px-1 py-2"><dt className="text-[11px] text-dust">{l}</dt><dd className="text-sm font-semibold tabular-nums">{v}</dd></div>
                    ))}
                  </dl>
                  <p className="mt-3 text-xs text-dust">Manager: <span className="text-bark">{p.stats.managerName ?? 'Not assigned'}</span></p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </QueryBoundary>
      <EditPropertyModal property={editing} onClose={() => setEditing(null)} />
    </>
  );
}

export function PropertyNewPage() {
  const navigate = useNavigate();
  const m = useMutation(services.properties.create, { success: (p) => `${p.name} added to your portfolio.`, onSuccess: (p) => navigate(`/owner/properties/${p.id}`) });
  return (
    <>
      <PageHeader title="Add property" subtitle="Create the property now; rooms and beds can be added by its manager." breadcrumbs={[{ label: 'Properties', to: '/owner/properties' }, { label: 'Add property' }]} />
      <Card className="max-w-3xl p-5 sm:p-7">
        <PropertyForm submitLabel="Create property" pending={m.pending} serverErrors={m.fieldErrors} onCancel={() => navigate('/owner/properties')} onSubmit={(i) => void m.run(i)} />
      </Card>
    </>
  );
}

