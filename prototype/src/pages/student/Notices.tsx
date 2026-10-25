import { useSearchParams } from 'react-router-dom'
import { CalendarDays, Check, MapPin, Megaphone, Pin, Users } from 'lucide-react'
import { useCurrentStudent, useStore } from '../../store/AppStore'
import { DEMO_TODAY, formatDate, formatDateTime, timeAgo, weekday } from '../../lib/utils'
import { Badge, Button, Card, EmptyState, PageHeader, StatusBadge, Tabs, useToast } from '../../components/ui'
import { ANN_TONE } from '../manager/Announcements'
import { useStudentAnnouncements } from './Home'

export default function StudentNotices() {
  const { data, toggleRsvp } = useStore()
  const s = useCurrentStudent()
  const toast = useToast()
  const [params, setParams] = useSearchParams()
  const tab = (params.get('tab') as 'notices' | 'events') ?? 'notices'
  const notices = useStudentAnnouncements()
  const events = data.events.filter((e) => e.propertyId === s.propertyId)
  const upcoming = events.filter((e) => e.date >= DEMO_TODAY).sort((a, b) => a.date.localeCompare(b.date))
  const past = events.filter((e) => e.date < DEMO_TODAY).sort((a, b) => b.date.localeCompare(a.date))

  return (
    <div>
      <PageHeader title="Notices & Events" description="Announcements from the hostel and what’s coming up" />
      <Tabs className="mb-4" value={tab} onChange={(t) => setParams({ tab: t }, { replace: true })} items={[{ value: 'notices', label: 'Announcements', count: notices.length }, { value: 'events', label: 'Events', count: upcoming.length }]} />
      {tab === 'notices' ? (
        notices.length ? (
          <div className="space-y-3">
            {notices.map((a) => (
              <Card key={a.id} className={a.pinned ? 'border-brand-200 p-4' : 'p-4'}>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={ANN_TONE[a.category]}>{a.category}</Badge>
                  {a.pinned && <Badge tone="brand"><Pin size={11} />Pinned</Badge>}
                  {a.audience !== 'all' && <Badge tone="slate">{a.audience === 'floor' ? `Floor ${a.audienceValue}` : 'Your room'}</Badge>}
                  <span className="ml-auto text-xs text-slate-400" title={formatDateTime(a.createdAt)}>{timeAgo(a.createdAt)}</span>
                </div>
                <h3 className="mt-2 font-semibold text-slate-900">{a.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">{a.message}</p>
                <p className="mt-2 text-xs text-slate-400">— {a.author}</p>
              </Card>
            ))}
          </div>
        ) : (
          <Card><EmptyState icon={Megaphone} title="No announcements" description="Notices from the hostel office will show up here." /></Card>
        )
      ) : (
        <div className="space-y-5">
          {upcoming.length === 0 && <Card><EmptyState icon={CalendarDays} title="No upcoming events" /></Card>}
          <div className="grid gap-3 sm:grid-cols-2">
            {upcoming.map((e) => {
              const going = e.rsvps.includes(s.id)
              const d = new Date(`${e.date}T00:00:00`)
              return (
                <Card key={e.id} className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex w-12 shrink-0 flex-col items-center rounded-xl border border-slate-200 py-1.5">
                      <span className="text-[10px] font-semibold text-rose-600 uppercase">{d.toLocaleString('en-IN', { month: 'short' })}</span>
                      <span className="text-lg leading-none font-semibold text-slate-900">{d.getDate()}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-slate-900">{e.name}</div>
                      <div className="text-[13px] text-slate-500">{weekday(e.date)} · <MapPin size={12} className="inline" /> {e.location}</div>
                    </div>
                  </div>
                  <p className="mt-3 text-[13px] text-slate-600">{e.description}</p>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-xs text-slate-500"><Users size={13} />{e.participants} going</span>
                    <Button size="sm" variant={going ? 'success' : 'secondary'} icon={going ? Check : undefined} onClick={() => { toggleRsvp(e.id, s.id); toast.success(going ? 'RSVP removed' : `You’re going to ${e.name}!`) }}>{going ? 'Going' : 'I’m interested'}</Button>
                  </div>
                </Card>
              )
            })}
          </div>
          {past.length > 0 && (
            <Card>
              <div className="px-4 pt-4 pb-1 text-[13px] font-semibold text-slate-500">Past events</div>
              <ul className="divide-y divide-slate-100">
                {past.map((e) => <li key={e.id} className="flex items-center justify-between px-4 py-3 text-sm"><span className="font-medium text-slate-800">{e.name}</span><span className="flex items-center gap-2 text-xs text-slate-500">{formatDate(e.date)}<StatusBadge status={e.status} /></span></li>)}
              </ul>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
