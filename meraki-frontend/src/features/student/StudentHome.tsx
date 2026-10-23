import { Link } from 'react-router-dom';
import { ArrowRight, BedDouble, CalendarDays, DoorOpen, IndianRupee, Megaphone, MessageSquareWarning, Siren, Star, UserRound } from 'lucide-react';
import { services } from '@/services';
import { useQuery } from '@/hooks/useQuery';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardHeader, QuickAction } from '@/components/ui/Card';
import { ButtonLink } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { ErrorState, PageSkeleton } from '@/components/ui/States';
import { greeting, todayISO } from '@/lib/clock';
import { formatClock, formatDate, formatDateLong, formatINR, formatPeriod } from '@/lib/format';

export function StudentHome() {
  const me = useQuery(() => services.students.me(), []);
  const notices = useQuery(() => services.announcements.list(), []);
  const events = useQuery(() => services.events.list({ status: 'scheduled' }), []);
  if (me.error) return <ErrorState message={me.error} onRetry={me.reload} />;
  if (!me.data) return <PageSkeleton />;
  const { student: s, charges, complaints, leaves, visitors } = me.data;
  const due = charges.filter((c) => c.balance > 0).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const next = due[0];
  const openComplaint = complaints.find((c) => c.status === 'open' || c.status === 'in_progress');
  const nextEvents = (events.data ?? []).filter((e) => e.date >= todayISO()).slice(0, 3);
  const unread = (notices.data ?? []).filter((n) => !n.isRead);
  const upcomingVisit = visitors.find((v) => v.visitDate >= todayISO() && (v.status === 'approved' || v.status === 'pending'));
  const pendingLeave = leaves.find((l) => l.status === 'pending');

  return (
    <>
      <PageHeader docTitle="Home" title={`${greeting()}, ${s.name.split(' ')[0]}`} subtitle={`${s.propertyName} · ${formatDateLong(todayISO())}`} />
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-5">
          <div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-full bg-slate-wash text-slate-ink" aria-hidden><BedDouble className="size-5" /></span><div><p className="text-[13px] text-bark">Your room</p><p className="font-display text-2xl font-semibold">{s.roomNumber ? `Room ${s.roomNumber} · Bed ${s.bedLabel}` : 'Bed not allotted'}</p></div></div>
          <p className="mt-3 text-sm text-dust">Monthly rent {formatINR(s.monthlyRent)}. Need a change? <Link to="/student/complaints" className="text-clay-700 underline">Ask the office</Link>.</p>
        </Card>
        <Card className={`p-5 ${next?.status === 'overdue' ? 'border-brick/40' : ''}`}>
          <div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-full bg-amber-wash text-amber" aria-hidden><IndianRupee className="size-5" /></span><div><p className="text-[13px] text-bark">Rent due</p><p className="font-display text-2xl font-semibold tabular-nums">{formatINR(s.balance)}</p></div></div>
          {next ? <p className="mt-3 text-sm text-dust">{formatPeriod(next.period)} · due {formatDate(next.dueDate)} <StatusBadge kind="charge" value={next.status} /></p> : <p className="mt-3 text-sm text-moss">You’re all paid up.</p>}
          {next && <ButtonLink to="/student/rent" size="sm" className="mt-3">Pay now</ButtonLink>}
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-full bg-clay-50 text-clay-700" aria-hidden><MessageSquareWarning className="size-5" /></span><div><p className="text-[13px] text-bark">Open complaint</p><p className="font-sans text-base font-semibold">{openComplaint ? openComplaint.title : 'Nothing open'}</p></div></div>
          {openComplaint ? <div className="mt-3 flex items-center gap-2 text-sm text-dust">{openComplaint.ticketNo} <StatusBadge kind="complaint" value={openComplaint.status} /><Link to={`/student/complaints?id=${openComplaint.id}`} className="ml-auto text-clay-700 hover:underline">Track</Link></div> : <p className="mt-3 text-sm text-dust">Something broken? Raise it and track it here.</p>}
        </Card>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <CardHeader title="Latest notices" subtitle={unread.length ? `${unread.length} unread` : 'All read'} action={<ButtonLink to="/student/notices" size="sm" variant="ghost">All notices <ArrowRight className="size-4" aria-hidden /></ButtonLink>} />
          <ul className="mt-3 divide-y divide-line/70">
            {(notices.data ?? []).slice(0, 4).map((n) => (
              <li key={n.id} className="flex gap-3 py-3">
                <span className={`mt-2 size-2 shrink-0 rounded-full ${n.isRead ? 'bg-line-strong' : 'bg-clay-600'}`} aria-hidden />
                <div className="min-w-0"><p className="text-sm font-medium">{n.title}{!n.isRead && <span className="sr-only"> (unread)</span>}</p><p className="line-clamp-1 text-xs text-dust">{n.body}</p></div>
              </li>
            ))}
            {notices.data?.length === 0 && <li className="py-6 text-center text-sm text-dust">No notices yet.</li>}
          </ul>
        </Card>
        <Card className="p-5">
          <CardHeader title="Coming up" />
          <ul className="mt-3 space-y-4 text-sm">
            {nextEvents.length === 0 ? <li className="flex gap-3"><CalendarDays className="mt-0.5 size-4 text-clay-600" aria-hidden /><span className="text-dust">No events scheduled.</span></li>
              : nextEvents.map((ev) => <li key={ev.id} className="flex gap-3"><CalendarDays className="mt-0.5 size-4 text-clay-600" aria-hidden /><div><p className="font-medium">{ev.title}</p><p className="text-xs text-dust">{formatDate(ev.date)}, {formatClock(ev.startTime)} · {ev.location}</p></div></li>)}
            <li className="flex gap-3"><UserRound className="mt-0.5 size-4 text-clay-600" aria-hidden />{upcomingVisit ? <div><p className="font-medium">{upcomingVisit.visitorName} visiting</p><p className="flex items-center gap-2 text-xs text-dust">{formatDate(upcomingVisit.visitDate)}, {formatClock(upcomingVisit.visitTime)} <StatusBadge kind="visitor" value={upcomingVisit.status} /></p></div> : <span className="text-dust">No visits planned.</span>}</li>
            <li className="flex gap-3"><DoorOpen className="mt-0.5 size-4 text-clay-600" aria-hidden />{pendingLeave ? <div><p className="font-medium">Leave awaiting approval</p><p className="text-xs text-dust">{formatDate(pendingLeave.from)} – {formatDate(pendingLeave.to)}</p></div> : <span className="text-dust">No leave pending.</span>}</li>
          </ul>
        </Card>
      </div>

      <Card className="mt-5 p-5">
        <CardHeader title="Quick actions" />
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <QuickAction icon={<IndianRupee className="size-5" />} label="Pay rent" to="/student/rent" />
          <QuickAction icon={<MessageSquareWarning className="size-5" />} label="Raise complaint" to="/student/complaints?new=1" />
          <QuickAction icon={<DoorOpen className="size-5" />} label="Request leave" to="/student/leave" />
          <QuickAction icon={<UserRound className="size-5" />} label="Add visitor" to="/student/visitors" />
          <QuickAction icon={<Star className="size-5" />} label="Give feedback" to="/student/feedback" />
          <QuickAction icon={<Siren className="size-5" />} label="Emergency" to="/student/emergency" />
        </div>
      </Card>
      <p className="mt-4 flex items-center gap-2 text-xs text-dust"><Megaphone className="size-3.5" aria-hidden />Notifications for approvals, payments and notices appear under the bell icon.</p>
    </>
  );
}
