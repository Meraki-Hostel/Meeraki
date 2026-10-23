import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BedDouble, CalendarCheck, CalendarDays, ChevronRight, IndianRupee, Megaphone, MessageSquareWarning, Pin, Siren, Star, UserCheck } from 'lucide-react'
import { useCurrentStudent, useStore } from '../../store/AppStore'
import { THIS_MONTH, dueLabel, dueStatus, idx, locationOf } from '../../store/selectors'
import type { Announcement, Due } from '../../lib/types'
import { DEMO_TODAY, cn, firstName, formatDate, formatINR, formatTime, greeting, timeAgo, weekday } from '../../lib/utils'
import { Badge, Button, Card, StatusBadge } from '../../components/ui'
import { useModals } from '../../components/domain/ModalsProvider'
import { PayRentModal } from './Rent'
import { ANN_TONE } from '../manager/Announcements'

export function useStudentAnnouncements() {
  const { data } = useStore()
  const s = useCurrentStudent()
  const loc = locationOf(data, s)
  return data.announcements
    .filter((a) => a.propertyId === s.propertyId)
    .filter((a: Announcement) => a.audience === 'all' || (a.audience === 'floor' && loc && String(loc.room.floor) === a.audienceValue) || (a.audience === 'room' && loc?.room.id === a.audienceValue))
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.createdAt.localeCompare(a.createdAt))
}

export default function StudentHome() {
  const { data } = useStore()
  const s = useCurrentStudent()
  const modals = useModals()
  const navigate = useNavigate()
  // Keep the invoice being paid so the modal survives the state update on success
  const [paying, setPayingDue] = useState<Due | null>(null)
  const i = idx(data)
  const loc = locationOf(data, s)
  const property = data.properties.find((p) => p.id === s.propertyId)!
  const announcements = useStudentAnnouncements()
  // Pinned notice first, then the latest two others
  const pinned = announcements.find((a) => a.pinned)
  const highlights = [...(pinned ? [pinned] : []), ...announcements.filter((a) => a !== pinned).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, pinned ? 1 : 2)]
  const dues = (i.duesByStudent.get(s.id) ?? []).filter((d) => d.paid < d.amount).sort((a, b) => a.dueDate.localeCompare(b.dueDate))
  const nextDue = dues[0]
  const lastPaid = (i.txnsByStudent.get(s.id) ?? [])[0]
  const complaints = data.complaints.filter((c) => c.studentId === s.id)
  const activeComplaint = complaints.find((c) => c.status !== 'resolved') ?? complaints[0]
  const upcomingLeaves = data.leaves.filter((l) => l.studentId === s.id && l.to.slice(0, 10) >= DEMO_TODAY && l.status !== 'rejected').sort((a, b) => a.from.localeCompare(b.from))
  const upcomingVisitors = data.visitors.filter((v) => v.studentId === s.id && v.expectedAt.slice(0, 10) >= DEMO_TODAY && (v.status === 'approved' || v.status === 'pending'))
  const nextEvent = data.events.filter((e) => e.propertyId === s.propertyId && e.date >= DEMO_TODAY && e.status !== 'Cancelled').sort((a, b) => a.date.localeCompare(b.date))[0]
  const feedbackDone = data.feedback.some((f) => f.studentId === s.id && f.month === THIS_MONTH)
  const myAlert = data.alerts.find((a) => a.studentId === s.id && a.status === 'active')

  const QUICK = [
    { label: 'Pay Rent', icon: IndianRupee, onClick: () => (nextDue ? setPayingDue(nextDue) : navigate('/student/rent')), tone: 'bg-emerald-50 text-emerald-600' },
    { label: 'Raise Complaint', icon: MessageSquareWarning, onClick: () => modals.open({ type: 'complaint', studentId: s.id, studentMode: true }), tone: 'bg-amber-50 text-amber-600' },
    { label: 'Apply Leave', icon: CalendarCheck, onClick: () => navigate('/student/leave?new=1'), tone: 'bg-violet-50 text-violet-600' },
    { label: 'Add Visitor', icon: UserCheck, onClick: () => navigate('/student/visitors?new=1'), tone: 'bg-sky-50 text-sky-600' },
  ]

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{greeting()}, {firstName(s.name)}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-[13px] text-slate-600">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 font-medium ring-1 ring-slate-200"><BedDouble size={14} className="text-brand-600" />{loc ? `Room ${loc.room.number} • Bed ${loc.bed.label}` : 'Bed not assigned yet'}</span>
          <span className="text-slate-400">{property.name}</span>
        </div>
      </div>

      {myAlert && (
        <Link to="/student/emergency" className="flex items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3">
          <Siren size={18} className="text-rose-600" />
          <span className="flex-1 text-[13px] font-medium text-rose-800">Emergency alert sent {timeAgo(myAlert.at)} — waiting for management to respond</span>
          <ChevronRight size={16} className="text-rose-400" />
        </Link>
      )}

      {highlights.length > 0 && (
        <Card>
          <div className="flex items-center justify-between px-4 pt-3.5">
            <span className="flex items-center gap-2 text-[13px] font-semibold text-slate-500"><Megaphone size={15} className="text-brand-600" />Announcements</span>
            <Link to="/student/notices" className="text-xs font-medium text-brand-700">See all {announcements.length}</Link>
          </div>
          <ul className="divide-y divide-slate-100">
            {highlights.map((a) => (
              <li key={a.id}>
                <Link to="/student/notices" className="block px-4 py-3 hover:bg-slate-50">
                  <div className="flex items-center gap-2">
                    {a.pinned && <Pin size={12} className="text-brand-500" />}
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-900">{a.title}</span>
                    <Badge tone={ANN_TONE[a.category]}>{a.category}</Badge>
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-[13px] text-slate-600">{a.message}</p>
                  <div className="mt-1 text-xs text-slate-400">{timeAgo(a.createdAt)}</div>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div>
        <h2 className="mb-2.5 text-[13px] font-semibold text-slate-500">Quick actions</h2>
        <div className="grid grid-cols-4 gap-2.5">
          {QUICK.map((q) => (
            <button key={q.label} onClick={q.onClick} className="flex flex-col items-center gap-2 rounded-2xl border border-slate-200/80 bg-white px-1 py-3.5 shadow-card transition-all hover:border-slate-300 active:scale-[0.98]">
              <span className={cn('flex size-10 items-center justify-center rounded-xl', q.tone)}><q.icon size={19} /></span>
              <span className="text-center text-[11.5px] leading-tight font-medium text-slate-700 sm:text-[13px]">{q.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-semibold text-slate-500">Rent status</span>
            {nextDue ? <StatusBadge status={dueStatus(nextDue)} label={dueStatus(nextDue) === 'pending' ? 'Unpaid' : undefined} /> : <StatusBadge status="paid" />}
          </div>
          {nextDue ? (
            <>
              <div className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 tabular">{formatINR(nextDue.amount - nextDue.paid)}</div>
              <div className="text-[13px] text-slate-500">Due on {formatDate(nextDue.dueDate)} · {dueLabel(nextDue.cycle)}</div>
              <Button variant="primary" className="mt-4 w-full" onClick={() => setPayingDue(nextDue)}>Pay now</Button>
            </>
          ) : (
            <>
              <div className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">All paid</div>
              <div className="text-[13px] text-slate-500">{lastPaid ? `Last payment ${formatINR(lastPaid.amount)} on ${formatDate(lastPaid.date)}` : 'No dues right now'}</div>
              <Button className="mt-4 w-full" onClick={() => navigate('/student/rent')}>View receipts</Button>
            </>
          )}
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-semibold text-slate-500">Complaint status</span>
            <Link to="/student/complaints" className="text-xs font-medium text-brand-700">All</Link>
          </div>
          {activeComplaint ? (
            <Link to="/student/complaints" className="mt-2 block">
              <div className="font-semibold text-slate-900">{activeComplaint.title}</div>
              <div className="text-[13px] text-slate-500">{activeComplaint.roomId ? `Room ${i.room.get(activeComplaint.roomId)?.number}` : 'Common area'} · #{activeComplaint.number}</div>
              <div className="mt-3 flex items-center justify-between">
                <StatusBadge status={activeComplaint.status} />
                <span className="text-xs text-slate-400">Updated {timeAgo(activeComplaint.updatedAt)}</span>
              </div>
              <ComplaintProgress status={activeComplaint.status} />
            </Link>
          ) : (
            <div className="mt-2">
              <div className="font-semibold text-slate-900">No complaints</div>
              <div className="text-[13px] text-slate-500">Something not working? Let us know.</div>
              <Button className="mt-4 w-full" onClick={() => modals.open({ type: 'complaint', studentId: s.id, studentMode: true })}>Raise complaint</Button>
            </div>
          )}
        </Card>
      </div>

      <Card>
        <div className="px-4 pt-4 pb-1 text-[13px] font-semibold text-slate-500">Upcoming</div>
        <ul className="divide-y divide-slate-100">
          {upcomingLeaves.map((l) => (
            <UpcomingRow key={l.id} to="/student/leave" icon={CalendarCheck} tone="bg-violet-50 text-violet-600" title={`${l.type} request`} sub={`${weekday(l.from)}, ${formatDate(l.from)} → ${formatDate(l.to)}`} right={<StatusBadge status={l.status} />} />
          ))}
          {upcomingVisitors.map((v) => (
            <UpcomingRow key={v.id} to="/student/visitors" icon={UserCheck} tone="bg-sky-50 text-sky-600" title={`${v.name} visiting`} sub={`${weekday(v.expectedAt)}, ${formatDate(v.expectedAt)} · ${formatTime(v.expectedAt)}`} right={<StatusBadge status={v.status} />} />
          ))}
          {nextEvent && <UpcomingRow to="/student/notices?tab=events" icon={CalendarDays} tone="bg-pink-50 text-pink-600" title={nextEvent.name} sub={`${weekday(nextEvent.date)}, ${formatDate(nextEvent.date)} · ${nextEvent.location}`} right={nextEvent.rsvps.includes(s.id) ? <Badge tone="green">Going</Badge> : <ChevronRight size={16} className="text-slate-300" />} />}
          {!upcomingLeaves.length && !upcomingVisitors.length && !nextEvent && <li className="px-4 py-6 text-center text-[13px] text-slate-500">Nothing planned. Enjoy your week!</li>}
        </ul>
      </Card>

      {!feedbackDone && (
        <Link to="/student/feedback" className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50/70 px-4 py-3.5">
          <Star size={18} className="text-amber-500" />
          <span className="flex-1">
            <span className="block text-sm font-semibold text-slate-900">How was September?</span>
            <span className="text-[13px] text-slate-600">Rate food, cleanliness, WiFi and more — takes 30 seconds.</span>
          </span>
          <ChevronRight size={16} className="text-amber-500" />
        </Link>
      )}

      {paying && <PayRentModal due={paying} onClose={() => setPayingDue(null)} />}
    </div>
  )
}

function UpcomingRow({ to, icon: Icon, tone, title, sub, right }: { to: string; icon: typeof CalendarCheck; tone: string; title: string; sub: string; right: React.ReactNode }) {
  return (
    <li>
      <Link to={to} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50">
        <span className={cn('flex size-9 items-center justify-center rounded-xl', tone)}><Icon size={17} /></span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-slate-900">{title}</span>
          <span className="block truncate text-xs text-slate-500">{sub}</span>
        </span>
        {right}
      </Link>
    </li>
  )
}

export function ComplaintProgress({ status }: { status: 'open' | 'in-progress' | 'resolved' }) {
  const step = status === 'open' ? 0 : status === 'in-progress' ? 1 : 2
  return (
    <div className="mt-3">
      <div className="flex gap-1">
        {[0, 1, 2].map((n) => <span key={n} className={cn('h-1 flex-1 rounded-full', n <= step ? (step === 2 ? 'bg-emerald-500' : 'bg-amber-500') : 'bg-slate-200')} />)}
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-slate-400">
        <span>Open</span><span>In Progress</span><span>Resolved</span>
      </div>
    </div>
  )
}
