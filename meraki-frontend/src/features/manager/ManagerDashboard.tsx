import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BedDouble, Boxes, CalendarDays, CreditCard, DoorOpen, IndianRupee, Megaphone, MessageSquareWarning, Plus, UserPlus, UserRound, Wrench } from 'lucide-react';
import { services } from '@/services';
import { useQuery } from '@/hooks/useQuery';
import { useCurrentUser } from '@/app/providers/SessionProvider';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardHeader, KpiCard, QuickAction } from '@/components/ui/Card';
import { ButtonLink } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { ErrorState, PageSkeleton, Skeleton } from '@/components/ui/States';
import { ActivityFeed } from '@/components/domain/ActivityFeed';
import { RecordPaymentModal } from '@/components/domain/RecordPaymentModal';
import { greeting, todayISO } from '@/lib/clock';
import { formatClock, formatDate, formatDateLong, formatINR } from '@/lib/format';

export function ManagerDashboard() {
  const user = useCurrentUser();
  const [payOpen, setPayOpen] = useState(false);
  const o = useQuery(() => services.analytics.managerOverview(), []);
  const visitors = useQuery(() => services.visitors.list({ date: todayISO() }), []);
  const leaves = useQuery(() => services.leave.list({ status: 'pending' }), []);
  const complaints = useQuery(() => services.complaints.list(), []);
  const activity = useQuery(() => services.activity.list({ limit: 7 }), []);
  if (o.error) return <ErrorState message={o.error} onRetry={o.reload} />;
  if (!o.data) return <PageSkeleton />;
  const d = o.data;
  const s = d.property.stats;
  const active = (complaints.data ?? []).filter((c) => c.status === 'open' || c.status === 'in_progress').slice(0, 4);
  const todayVisitors = (visitors.data ?? []).filter((v) => v.status !== 'rejected' && v.status !== 'cancelled');

  return (
    <>
      <PageHeader docTitle="Manager dashboard" title={`${greeting()}, ${user.name.split(' ')[0]}`} subtitle={<>{d.property.name} · {formatDateLong(todayISO())}</>}
        actions={<ButtonLink to="/manager/students" variant="secondary" icon={<UserPlus className="size-4" aria-hidden />} state={{ openWizard: true }}>Add student</ButtonLink>} />

      <section aria-label="Key figures" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Occupancy" value={`${s.occupancyPct}%`} hint={`${s.occupiedBeds}/${s.beds} beds · ${s.availableBeds} free`} icon={<BedDouble className="size-5" />} progress={s.occupancyPct} to="/manager/rooms" />
        <KpiCard label="October collection" value={formatINR(d.collection.collected)} hint={`${d.collection.collectionPct}% of ${formatINR(d.collection.expected)}`} icon={<IndianRupee className="size-5" />} tone="moss" to="/manager/payments" />
        <KpiCard label="Dues outstanding" value={formatINR(d.collection.overdue + d.collection.pending)} hint={`${d.collection.overdueCount} overdue · ${d.collection.pendingCount} upcoming`} icon={<CreditCard className="size-5" />} tone={d.collection.overdueCount ? 'brick' : 'slate'} to="/manager/payments" />
        <KpiCard label="Open complaints" value={d.openComplaints} hint={d.urgentComplaints ? `${d.urgentComplaints} urgent` : 'None urgent'} icon={<MessageSquareWarning className="size-5" />} tone={d.urgentComplaints ? 'brick' : 'amber'} to="/manager/complaints" />
      </section>
      <section aria-label="Today" className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { l: 'Leave to decide', v: d.pendingLeaves, to: '/manager/leave', i: DoorOpen },
          { l: 'Visitors today', v: d.visitorsToday, to: '/manager/visitors', i: UserRound },
          { l: 'Open maintenance', v: d.openMaintenance, to: '/manager/maintenance', i: Wrench },
          { l: 'Low-stock items', v: d.lowStock, to: '/manager/inventory', i: Boxes },
        ].map(({ l, v, to, i: Icon }) => (
          <Link key={l} to={to} className="surface flex items-center gap-3 p-4 hover:border-line-strong">
            <Icon className="size-5 text-clay-600" aria-hidden /><span className="flex-1 text-sm text-bark">{l}</span><span className="font-display text-xl font-semibold tabular-nums">{v}</span>
          </Link>
        ))}
      </section>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <Card className="p-5">
          <CardHeader title="Leave awaiting you" action={<ButtonLink to="/manager/leave" size="sm" variant="ghost">All <ArrowRight className="size-4" aria-hidden /></ButtonLink>} />
          <ul className="mt-3 divide-y divide-line/70">
            {!leaves.data ? <Skeleton className="h-24" /> : leaves.data.length === 0 ? <li className="py-6 text-center text-sm text-dust">No pending requests.</li> : leaves.data.slice(0, 4).map((l) => (
              <li key={l.id} className="py-2.5 text-sm"><p className="font-medium">{l.studentName} <span className="font-normal text-dust">· Rm {l.roomNumber}</span></p><p className="text-xs text-dust">{formatDate(l.from)} – {formatDate(l.to)} · {l.destination}</p></li>
            ))}
          </ul>
        </Card>
        <Card className="p-5">
          <CardHeader title="Visitors today" action={<ButtonLink to="/manager/visitors" size="sm" variant="ghost">Log <ArrowRight className="size-4" aria-hidden /></ButtonLink>} />
          <ul className="mt-3 divide-y divide-line/70">
            {todayVisitors.length === 0 ? <li className="py-6 text-center text-sm text-dust">No visitors expected today.</li> : todayVisitors.slice(0, 4).map((v) => (
              <li key={v.id} className="flex items-center justify-between gap-2 py-2.5 text-sm">
                <div className="min-w-0"><p className="truncate font-medium">{v.visitorName}</p><p className="text-xs text-dust">for {v.studentName} · {formatClock(v.visitTime)}</p></div>
                <StatusBadge kind="visitor" value={v.status} />
              </li>
            ))}
          </ul>
        </Card>
        <Card className="p-5">
          <CardHeader title="Active complaints" action={<ButtonLink to="/manager/complaints" size="sm" variant="ghost">Queue <ArrowRight className="size-4" aria-hidden /></ButtonLink>} />
          <ul className="mt-3 divide-y divide-line/70">
            {active.length === 0 ? <li className="py-6 text-center text-sm text-dust">Nothing open. Nice.</li> : active.map((c) => (
              <li key={c.id}><Link to={`/manager/complaints?id=${c.id}`} className="flex items-center justify-between gap-2 py-2.5 text-sm hover:text-clay-700">
                <div className="min-w-0"><p className="truncate font-medium">{c.title}</p><p className="text-xs text-dust">{c.ticketNo} · Rm {c.roomNumber}</p></div>
                <StatusBadge kind="priority" value={c.priority} />
              </Link></li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-5">
        <Card className="p-5 lg:col-span-2">
          <CardHeader title="Quick actions" />
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3">
            <QuickAction icon={<CreditCard className="size-5" />} label="Record payment" onClick={() => setPayOpen(true)} />
            <QuickAction icon={<BedDouble className="size-5" />} label="Rooms & beds" to="/manager/rooms" />
            <QuickAction icon={<Plus className="size-5" />} label="Maintenance ticket" to="/manager/maintenance?new=1" />
            <QuickAction icon={<Megaphone className="size-5" />} label="Post a notice" to="/manager/announcements?new=1" />
            <QuickAction icon={<UserRound className="size-5" />} label="Walk-in visitor" to="/manager/visitors?walkin=1" />
            <QuickAction icon={<CalendarDays className="size-5" />} label="Plan event" to="/manager/events" />
          </div>
        </Card>
        <Card className="p-5 lg:col-span-3">
          <CardHeader title="Recent activity" action={<ButtonLink to="/manager/activity" size="sm" variant="ghost">Full log <ArrowRight className="size-4" aria-hidden /></ButtonLink>} />
          <div className="mt-4">{activity.data ? <ActivityFeed items={activity.data} compact /> : <Skeleton className="h-48" />}</div>
        </Card>
      </div>
      <RecordPaymentModal open={payOpen} onClose={() => setPayOpen(false)} />
    </>
  );
}
