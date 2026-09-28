import { Link, useNavigate } from 'react-router-dom'
import {
  AlertTriangle, ArrowRight, BedDouble, CalendarCheck, Check, ChevronRight, IndianRupee, Megaphone, MessageSquareWarning,
  Package, Phone, Plus, UserCheck, UserPlus, Users, Wallet, X,
} from 'lucide-react'
import { useManagerProperty, useStore } from '../../store/AppStore'
import { idx, locationOf, propertyStats } from '../../store/selectors'
import { DEMO_TODAY, cn, compactINR, firstName, formatDateLong, formatINR, formatTime, greeting, pct, timeAgo, weekday } from '../../lib/utils'
import { Avatar, Button, Card, CardHeader, KpiCard, ProgressBar, StatusBadge, useConfirm, useToast } from '../../components/ui'
import { ActivityFeed } from '../../components/domain/ActivityFeed'
import { useModals } from '../../components/domain/ModalsProvider'

export default function ManagerDashboard() {
  const { data, decideLeave, acknowledgeEmergency } = useStore()
  const property = useManagerProperty()
  const modals = useModals()
  const navigate = useNavigate()
  const toast = useToast()
  const confirm = useConfirm()
  const st = propertyStats(data, property.id)
  const i = idx(data)
  const alerts = data.alerts.filter((a) => a.propertyId === property.id && a.status === 'active')
  const activity = data.activity.filter((a) => a.propertyId === property.id).slice(0, 8)
  const pendingLeaves = data.leaves.filter((l) => l.propertyId === property.id && l.status === 'pending').slice(0, 4)
  const todaysVisitors = data.visitors.filter((v) => v.propertyId === property.id && v.expectedAt.slice(0, 10) === DEMO_TODAY && v.status !== 'rejected').sort((a, b) => a.expectedAt.localeCompare(b.expectedAt))

  const QUICK = [
    { label: 'Add Student', icon: UserPlus, onClick: () => modals.open({ type: 'addStudent' }), primary: true },
    { label: 'Record Payment', icon: IndianRupee, onClick: () => modals.open({ type: 'recordPayment' }) },
    { label: 'Assign Bed', icon: BedDouble, onClick: () => modals.open({ type: 'assignBed' }) },
    { label: 'Create Complaint', icon: MessageSquareWarning, onClick: () => modals.open({ type: 'complaint' }) },
    { label: 'Approve Leave', icon: CalendarCheck, onClick: () => navigate('/manager/leave') },
    { label: 'Announcement', icon: Megaphone, onClick: () => modals.open({ type: 'announcement' }) },
  ]

  const tasks = [
    { label: 'New complaints to assign', count: st.newComplaints, icon: MessageSquareWarning, to: '/manager/complaints?status=open', tone: 'text-amber-600 bg-amber-50' },
    { label: 'Pending leave requests', count: st.pendingLeaves, icon: CalendarCheck, to: '/manager/leave', tone: 'text-violet-600 bg-violet-50' },
    { label: 'Overdue payments', count: st.overdueCount, icon: Wallet, to: '/manager/payments?tab=overdue', tone: 'text-rose-600 bg-rose-50', sub: formatINR(st.outstanding) },
    { label: 'Visitor requests to approve', count: st.pendingVisitors, icon: UserCheck, to: '/manager/visitors?tab=pending', tone: 'text-sky-600 bg-sky-50' },
    { label: 'Students awaiting a bed', count: st.awaitingBed, icon: BedDouble, to: '/manager/students?status=unassigned', tone: 'text-brand-600 bg-brand-50' },
    { label: 'Inventory items low in stock', count: st.lowStock, icon: Package, to: '/manager/inventory?filter=low', tone: 'text-orange-600 bg-orange-50' },
  ]

  // Occupancy by floor across buildings
  const floors = property.buildings.flatMap((b) => {
    const rooms = data.rooms.filter((r) => r.propertyId === property.id && r.building === b)
    return Array.from(new Set(rooms.map((r) => r.floor))).sort().map((f) => {
      const beds = rooms.filter((r) => r.floor === f).flatMap((r) => i.bedsByRoom.get(r.id) ?? [])
      const occ = beds.filter((x) => x.status === 'occupied').length
      return { key: `${b}-${f}`, label: `${property.buildings.length > 1 ? `${b.replace('Block ', '')} · ` : ''}Floor ${f}`, occ, total: beds.length }
    })
  })

  return (
    <div className="space-y-6">
      {alerts.map((a) => {
        const s = i.student.get(a.studentId)
        const loc = locationOf(data, s)
        return (
          <div key={a.id} className="flex flex-col gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 sm:flex-row sm:items-center">
            <span className="flex size-10 shrink-0 animate-pulse items-center justify-center rounded-full bg-rose-600 text-white">
              <AlertTriangle size={20} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-rose-900">Emergency alert from {s?.name} · Room {loc?.label ?? '—'}</div>
              <div className="text-[13px] text-rose-800/80">
                {timeAgo(a.at)}
                {a.note && ` · “${a.note}”`} · Guardian {s?.guardianName}
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" icon={Phone} onClick={() => toast.info(`Calling ${s?.name}…`, { description: `+91 ${s?.phone} (simulated call)` })}>
                Call
              </Button>
              <Button size="sm" variant="danger" icon={Check} onClick={() => { acknowledgeEmergency(a.id); toast.success('Alert acknowledged', { description: `${s?.name} has been notified that help is on the way.` }) }}>
                Acknowledge
              </Button>
            </div>
          </div>
        )
      })}

      <div className="flex flex-col gap-1">
        <span className="text-[13px] font-medium text-slate-500 lg:hidden">
          {weekday(DEMO_TODAY)}, {formatDateLong(DEMO_TODAY)}
        </span>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          {greeting()}, {firstName(property.managerName)}
        </h1>
        <p className="text-sm text-slate-500">
          Here’s what’s happening at <span className="font-medium text-slate-700">{property.name}</span> today.
        </p>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-6">
        {QUICK.map((q) => (
          <button
            key={q.label}
            onClick={q.onClick}
            className={cn(
              'group flex items-center gap-2.5 rounded-xl border px-3.5 py-3 text-left text-[13px] font-semibold transition-all',
              q.primary ? 'border-brand-600 bg-brand-600 text-white hover:bg-brand-700' : 'border-slate-200 bg-white text-slate-800 hover:border-slate-300 hover:shadow-sm',
            )}
          >
            <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-lg', q.primary ? 'bg-white/15' : 'bg-slate-100 text-slate-600 group-hover:bg-brand-50 group-hover:text-brand-600')}>
              <q.icon size={16} />
            </span>
            <span className="leading-tight">{q.label}</span>
          </button>
        ))}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <KpiCard label="Total beds" value={st.totalBeds} icon={BedDouble} sub={`${data.rooms.filter((r) => r.propertyId === property.id).length} rooms`} to="/manager/rooms" />
        <KpiCard label="Occupied" value={st.occupied} icon={Users} tone="brand" sub={`${pct(st.occupancy)} occupancy`} to="/manager/students" />
        <KpiCard label="Vacant" value={st.vacant} icon={BedDouble} tone="green" sub={`${st.available} ready · ${st.reserved} reserved`} to="/manager/rooms?status=vacant" />
        <KpiCard label="Pending payments" value={compactINR(st.outstanding)} icon={Wallet} tone="red" sub={`${st.overdueCount} overdue · ${st.partialCount} partial`} to="/manager/payments?tab=overdue" />
        <KpiCard label="Open complaints" value={st.openComplaints} icon={MessageSquareWarning} tone="amber" sub={`${st.newComplaints} not started`} to="/manager/complaints" />
        <KpiCard label="Leave requests" value={st.pendingLeaves} icon={CalendarCheck} tone="neutral" sub={`${st.away} away today`} to="/manager/leave" />
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <div className="space-y-5 xl:col-span-2">
          <Card>
            <CardHeader title="Today’s tasks" subtitle="Everything that needs a decision from you" />
            <div className="grid gap-px overflow-hidden rounded-b-2xl border-t border-slate-100 bg-slate-100 sm:grid-cols-2">
              {tasks.map((t) => (
                <Link key={t.label} to={t.to} className="group flex items-center gap-3 bg-white px-5 py-3.5 hover:bg-slate-50">
                  <span className={cn('flex size-9 items-center justify-center rounded-lg', t.tone)}>
                    <t.icon size={17} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium text-slate-700">{t.label}</span>
                    {t.sub && t.count > 0 && <span className="text-xs text-slate-500">{t.sub}</span>}
                  </span>
                  <span className={cn('text-lg font-semibold tabular', t.count ? 'text-slate-900' : 'text-slate-300')}>{t.count}</span>
                  <ChevronRight size={16} className="text-slate-300 group-hover:text-slate-500" />
                </Link>
              ))}
            </div>
          </Card>

          <div className="grid gap-5 md:grid-cols-2">
            <Card>
              <CardHeader title="Leave approvals" subtitle={`${st.pendingLeaves} waiting`} action={<Link to="/manager/leave" className="text-[13px] font-medium text-brand-700 hover:text-brand-800">View all</Link>} />
              <div className="px-5 pb-4">
                {pendingLeaves.length === 0 && <p className="py-6 text-center text-[13px] text-slate-500">No pending requests. Nice work.</p>}
                <ul className="divide-y divide-slate-100">
                  {pendingLeaves.map((l) => {
                    const s = i.student.get(l.studentId)!
                    return (
                      <li key={l.id} className="flex items-center gap-3 py-2.5">
                        <Avatar name={s.name} size="sm" />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[13px] font-medium text-slate-900">{s.name}</div>
                          <div className="truncate text-xs text-slate-500">
                            {new Date(l.from).getDate()}–{new Date(l.to).getDate()} {new Date(l.to).toLocaleString('en-IN', { month: 'short' })} · {l.reason}
                          </div>
                        </div>
                        <Button size="xs" variant="ghost" icon={X} aria-label="Reject" onClick={async () => {
                          const r = await confirm({ title: `Reject leave for ${s.name}?`, tone: 'danger', confirmLabel: 'Reject', note: { label: 'Reason (shared with student)', placeholder: 'e.g. Exams scheduled this week' } })
                          if (r.ok) { decideLeave(l.id, false, r.note); toast.success('Leave request rejected.') }
                        }} />
                        <Button size="xs" variant="subtle" icon={Check} onClick={() => { decideLeave(l.id, true); toast.success('Leave request approved.', { description: `${s.name} has been notified.` }) }}>
                          Approve
                        </Button>
                      </li>
                    )
                  })}
                </ul>
              </div>
            </Card>

            <Card>
              <CardHeader title="Today’s visitors" subtitle={`${todaysVisitors.length} expected`} action={<Link to="/manager/visitors" className="text-[13px] font-medium text-brand-700 hover:text-brand-800">Open register</Link>} />
              <div className="px-5 pb-4">
                {todaysVisitors.length === 0 && <p className="py-6 text-center text-[13px] text-slate-500">No visitors expected today.</p>}
                <ul className="divide-y divide-slate-100">
                  {todaysVisitors.slice(0, 5).map((v) => {
                    const s = i.student.get(v.studentId)
                    return (
                      <li key={v.id} className="flex items-center gap-3 py-2.5">
                        <span className="w-16 shrink-0 text-xs font-medium text-slate-500 tabular">{formatTime(v.expectedAt)}</span>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[13px] font-medium text-slate-900">{v.name}</div>
                          <div className="truncate text-xs text-slate-500">
                            {v.relation} of {s?.name} · {locationOf(data, s)?.label}
                          </div>
                        </div>
                        <StatusBadge status={v.status} />
                      </li>
                    )
                  })}
                </ul>
              </div>
            </Card>
          </div>

          <Card>
            <CardHeader title="Occupancy by floor" subtitle={`${st.occupied} of ${st.totalBeds} beds occupied`} action={<Button size="sm" variant="ghost" iconRight={ArrowRight} onClick={() => navigate('/manager/rooms')}>Room map</Button>} />
            <div className="grid gap-x-8 gap-y-3 px-5 pb-5 sm:grid-cols-2">
              {floors.map((f) => (
                <div key={f.key}>
                  <div className="mb-1 flex justify-between text-[13px]">
                    <span className="text-slate-600">{f.label}</span>
                    <span className="font-medium text-slate-900 tabular">
                      {f.occ}/{f.total}
                      <span className="ml-1.5 text-xs font-normal text-slate-400">{f.total - f.occ} free</span>
                    </span>
                  </div>
                  <ProgressBar value={f.total ? f.occ / f.total : 0} tone={f.occ / f.total > 0.95 ? 'amber' : 'brand'} />
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader title="October rent collection" subtitle="Due 5 Oct" />
            <div className="px-5 pb-5">
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-semibold tracking-tight text-slate-900">{compactINR(st.collectedCurrent)}</span>
                <span className="text-[13px] text-slate-500">of {compactINR(st.expectedCurrent)}</span>
              </div>
              <ProgressBar value={st.expectedCurrent ? st.collectedCurrent / st.expectedCurrent : 0} tone="green" className="mt-3 h-2" />
              <div className="mt-2 text-xs text-slate-500">{pct(st.expectedCurrent ? st.collectedCurrent / st.expectedCurrent : 0)} collected in advance · {formatINR(st.collectedThisMonth)} received in September</div>
              <Button className="mt-4 w-full" icon={Plus} onClick={() => modals.open({ type: 'recordPayment' })}>
                Record payment
              </Button>
            </div>
          </Card>
          <Card>
            <CardHeader title="Recent activity" action={<Link to="/manager/activity" className="text-[13px] font-medium text-brand-700 hover:text-brand-800">View all</Link>} />
            <div className="px-5 pb-2">
              <ActivityFeed items={activity} dense />
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
