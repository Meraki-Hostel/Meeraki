import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { BedDouble, IndianRupee, MapPin, MessageSquareWarning, Pencil, Phone, Users } from 'lucide-react';
import { services } from '@/services';
import type { StudentListItem } from '@/services/interfaces';
import { useQuery } from '@/hooks/useQuery';
import { useQueryParam } from '@/hooks/misc';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardHeader, DescriptionList, KpiCard, ProgressBar } from '@/components/ui/Card';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Tabs, TabPanel } from '@/components/ui/Tabs';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Badge } from '@/components/ui/Badge';
import { ErrorState, PageSkeleton, Skeleton } from '@/components/ui/States';
import { ActivityFeed } from '@/components/domain/ActivityFeed';
import { PropertyImage } from '@/components/brand/PropertyImage';
import { formatDate, formatINR, formatPeriod, formatPhone, sentenceCase } from '@/lib/format';
import { currentPeriod } from '@/lib/clock';
import { cn } from '@/lib/cn';
import { EditPropertyModal, PropertyActions } from './PropertiesPages';

type Tab = 'overview' | 'rooms' | 'residents' | 'finance' | 'activity';

export function PropertyDetailPage() {
  const { propertyId = '' } = useParams();
  const [tabParam, setTab] = useQueryParam('tab');
  const tab = (tabParam ?? 'overview') as Tab;
  const [editing, setEditing] = useState(false);
  const q = useQuery(() => services.properties.get(propertyId), [propertyId]);
  const rooms = useQuery(() => services.rooms.list({ propertyId }), [propertyId]);
  const students = useQuery(() => services.students.list({ propertyId }), [propertyId]);
  const summary = useQuery(() => services.payments.summary({ propertyId }), [propertyId]);
  const trend = useQuery(() => services.analytics.trends({ propertyId, months: 6 }), [propertyId]);
  const staff = useQuery(() => services.staff.list({ propertyId }), [propertyId]);
  const activity = useQuery(() => services.activity.list({ propertyId, limit: 25 }), [propertyId]);

  if (q.error) return <ErrorState message={q.error} onRetry={q.reload} />;
  if (!q.data) return <PageSkeleton />;
  const p = q.data;
  const s = p.stats;
  const manager = staff.data?.find((x) => x.id === p.managerStaffId);

  const studentCols: Column<StudentListItem>[] = [
    { key: 'name', header: 'Resident', cell: (r) => <div><p className="font-medium">{r.name}</p><p className="text-xs text-dust">{r.studentCode}</p></div>, sortValue: (r) => r.name },
    { key: 'room', header: 'Room · bed', cell: (r) => (r.roomNumber ? `${r.roomNumber} · ${r.bedLabel}` : '—'), sortValue: (r) => r.roomNumber ?? '' },
    { key: 'college', header: 'College', cell: (r) => r.college, hideBelow: 'md' },
    { key: 'status', header: 'Status', cell: (r) => <StatusBadge kind="student" value={r.status} /> },
    { key: 'bal', header: 'Balance', align: 'right', cell: (r) => <span className={r.balance ? 'font-semibold text-brick' : 'text-dust'}>{formatINR(r.balance)}</span>, sortValue: (r) => r.balance },
  ];

  return (
    <>
      <PageHeader title={p.name} docTitle={p.name} breadcrumbs={[{ label: 'Properties', to: '/owner/properties' }, { label: p.name }]}
        subtitle={<span className="inline-flex flex-wrap items-center gap-2"><MapPin className="size-4" aria-hidden />{p.address} · {sentenceCase(p.type)} <StatusBadge kind="property" value={p.status} /></span>}
        actions={<><Button variant="secondary" icon={<Pencil className="size-4" />} onClick={() => setEditing(true)}>Edit</Button><PropertyActions p={p} onEdit={() => setEditing(true)} /></>} />

      <Tabs label="Property sections" value={tab} onChange={(t) => setTab(t === 'overview' ? null : t)} items={[
        { value: 'overview', label: 'Overview' }, { value: 'rooms', label: 'Rooms', count: s.rooms }, { value: 'residents', label: 'Residents', count: s.students },
        { value: 'finance', label: 'Finance' }, { value: 'activity', label: 'Activity' },
      ]} />

      {tab === 'overview' && (
        <TabPanel>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard label="Occupancy" value={`${s.occupancyPct}%`} hint={`${s.occupiedBeds} of ${s.beds} beds`} icon={<BedDouble className="size-5" />} progress={s.occupancyPct} />
            <KpiCard label="Residents" value={s.students} hint={`${s.availableBeds} beds free · ${s.unavailableBeds} blocked`} icon={<Users className="size-5" />} />
            <KpiCard label={`Collected, ${formatPeriod(currentPeriod())}`} value={formatINR(s.collectedRent)} hint={`of ${formatINR(s.expectedRent)} expected`} icon={<IndianRupee className="size-5" />} tone="moss" />
            <KpiCard label="Open complaints" value={s.openComplaints} hint="Open or in progress" icon={<MessageSquareWarning className="size-5" />} tone={s.openComplaints ? 'amber' : 'moss'} to={`/owner/complaints`} />
          </div>
          <div className="mt-5 grid gap-5 lg:grid-cols-3">
            <Card className="overflow-hidden lg:col-span-2">
              <PropertyImage variant={p.imageVariant} name={p.name} className="h-44 w-full" />
              <div className="p-5">
                <DescriptionList cols={3} items={[
                  { label: 'Code', value: p.code }, { label: 'Opened', value: formatDate(p.openedOn) }, { label: 'Base rent', value: `${formatINR(p.baseRent)}/bed` },
                  { label: 'Front desk', value: formatPhone(p.phone) }, { label: 'PIN code', value: p.pincode }, { label: 'City', value: p.city },
                ]} />
                <div className="mt-4 flex flex-wrap gap-1.5">{p.amenities.map((a) => <Badge key={a} tone="neutral" dot={false}>{a}</Badge>)}</div>
              </div>
            </Card>
            <Card className="p-5">
              <CardHeader title="Manager" />
              {manager ? (
                <div className="mt-3 space-y-1 text-sm">
                  <p className="text-base font-semibold">{manager.name}</p>
                  <StatusBadge kind="staff" value={manager.status} />
                  <p className="flex items-center gap-1.5 pt-2 text-bark"><Phone className="size-3.5" aria-hidden />{formatPhone(manager.phone)}</p>
                  <p className="break-all text-bark">{manager.email}</p>
                </div>
              ) : <p className="mt-3 text-sm text-dust">No manager assigned yet.</p>}
              <ButtonLink to="/owner/staff" variant="secondary" size="sm" className="mt-4">Manage staff</ButtonLink>
              <h3 className="mt-6 text-base font-semibold">Team</h3>
              <ul className="mt-2 space-y-1.5 text-sm">
                {(staff.data ?? []).filter((x) => x.id !== p.managerStaffId).map((x) => <li key={x.id} className="flex justify-between gap-2"><span>{x.name}</span><span className="text-dust">{sentenceCase(x.role)}</span></li>)}
                {staff.data && staff.data.length <= 1 && <li className="text-dust">No other staff yet.</li>}
              </ul>
            </Card>
          </div>
        </TabPanel>
      )}

      {tab === 'rooms' && (
        <TabPanel>
          {!rooms.data ? <Skeleton className="h-64" /> : rooms.data.length === 0 ? (
            <Card className="p-8 text-center text-sm text-dust">No rooms yet. The property manager adds rooms from <strong>Rooms &amp; beds</strong>.</Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {rooms.data.map((r) => (
                <Card key={r.id} className="p-4">
                  <div className="flex items-baseline justify-between"><h3 className="text-lg font-semibold">Room {r.number}</h3><span className="text-xs text-dust">Floor {r.floor}</span></div>
                  <p className="text-xs text-dust">{sentenceCase(r.type)} · {formatINR(r.rent)}{r.ac ? ' · AC' : ''}</p>
                  <ul className="mt-3 space-y-1.5">
                    {r.beds.map((b) => (
                      <li key={b.id} className="flex items-center justify-between gap-2 text-sm">
                        <span className="text-bark">Bed {b.label}</span>
                        <span className={cn('truncate text-right', b.status !== 'occupied' && 'text-dust')}>{b.status === 'occupied' ? b.studentName : <StatusBadge kind="bed" value={b.status} />}</span>
                      </li>
                    ))}
                  </ul>
                </Card>
              ))}
            </div>
          )}
        </TabPanel>
      )}

      {tab === 'residents' && (
        <TabPanel><Card className="p-4"><DataTable caption={`Residents of ${p.name}`} columns={studentCols} rows={students.data} loading={students.loading} rowKey={(r) => r.id} /></Card>
          <p className="mt-3 text-xs text-dust">Owners view residents read-only. The property manager handles admissions and transfers.</p></TabPanel>
      )}

      {tab === 'finance' && (
        <TabPanel>
          <div className="grid gap-4 sm:grid-cols-4">
            {summary.data && [['Expected', summary.data.expected, ''], ['Collected', summary.data.collected, 'text-moss'], ['Due, not late', summary.data.pending, ''], ['Overdue', summary.data.overdue, 'text-brick']].map(([l, v, c]) => (
              <Card key={l as string} className="p-4"><p className="text-[13px] text-bark">{l}</p><p className={cn('mt-1 font-display text-2xl font-semibold tabular-nums', c as string)}>{formatINR(v as number)}</p></Card>
            ))}
          </div>
          <Card className="mt-5 p-5">
            <CardHeader title="Collection, last 6 months" />
            <ul className="mt-4 space-y-3">
              {(trend.data ?? []).map((t) => (
                <li key={t.period} className="grid grid-cols-[52px_1fr_auto] items-center gap-3 text-sm">
                  <span className="text-dust">{t.label}</span>
                  <ProgressBar value={t.expected ? (t.collected / t.expected) * 100 : 0} label={`${t.label} collection`} tone="moss" />
                  <span className="tabular-nums">{formatINR(t.collected)} <span className="text-dust">/ {formatINR(t.expected)}</span></span>
                </li>
              ))}
            </ul>
            <Link to="/owner/finance" className="mt-4 inline-block text-sm font-medium text-clay-700 hover:underline">Open full ledger</Link>
          </Card>
        </TabPanel>
      )}

      {tab === 'activity' && <TabPanel><Card className="p-5">{activity.data ? <ActivityFeed items={activity.data} /> : <Skeleton className="h-48" />}</Card></TabPanel>}

      <EditPropertyModal property={editing ? p : null} onClose={() => setEditing(false)} />
    </>
  );
}
