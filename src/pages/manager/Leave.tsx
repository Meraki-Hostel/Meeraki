import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarCheck, Check, Clock, Moon, X } from 'lucide-react'
import { useManagerProperty, useStore } from '../../store/AppStore'
import { idx, locationOf } from '../../store/selectors'
import type { LeaveRequest } from '../../lib/types'
import { DEMO_TODAY, daysBetween, formatDate, formatTime, timeAgo, weekday } from '../../lib/utils'
import { Avatar, Badge, Button, Card, EmptyState, PageHeader, SearchInput, StatusBadge, Tabs, useConfirm, useToast } from '../../components/ui'

type Tab = 'pending' | 'away' | 'approved' | 'rejected'

export function isCurrentlyAway(l: LeaveRequest) {
  return l.status === 'approved' && l.from.slice(0, 10) <= DEMO_TODAY && l.to.slice(0, 10) >= DEMO_TODAY
}

export default function LeavePage() {
  const { data, decideLeave } = useStore()
  const property = useManagerProperty()
  const toast = useToast()
  const confirm = useConfirm()
  const [tab, setTab] = useState<Tab>('pending')
  const [q, setQ] = useState('')
  const i = idx(data)
  const all = data.leaves.filter((l) => l.propertyId === property.id).filter((l) => !q || i.student.get(l.studentId)?.name.toLowerCase().includes(q.toLowerCase()))
  const lists: Record<Tab, LeaveRequest[]> = {
    pending: all.filter((l) => l.status === 'pending').sort((a, b) => a.from.localeCompare(b.from)),
    away: all.filter(isCurrentlyAway),
    approved: all.filter((l) => l.status === 'approved').sort((a, b) => b.from.localeCompare(a.from)),
    rejected: all.filter((l) => l.status === 'rejected').sort((a, b) => b.from.localeCompare(a.from)),
  }
  const rows = lists[tab]

  const approve = (l: LeaveRequest) => {
    decideLeave(l.id, true)
    toast.success('Leave request approved.', { description: `${i.student.get(l.studentId)?.name} will see this in the student app.` })
  }
  const reject = async (l: LeaveRequest) => {
    const s = i.student.get(l.studentId)
    const r = await confirm({ title: `Reject leave request from ${s?.name}?`, description: `${formatDate(l.from)} → ${formatDate(l.to)} · ${l.reason}`, tone: 'danger', confirmLabel: 'Reject request', note: { label: 'Reason (shared with the student)', placeholder: 'e.g. Exams scheduled this week' } })
    if (!r.ok) return
    decideLeave(l.id, false, r.note)
    toast.success('Leave request rejected.')
  }

  return (
    <div>
      <PageHeader title="Leave Requests" description="Approve leave and outings, and see who is away" />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <Tabs<Tab>
          className="flex-1"
          value={tab}
          onChange={setTab}
          items={[
            { value: 'pending', label: 'Pending', count: lists.pending.length },
            { value: 'away', label: 'Currently away', count: lists.away.length },
            { value: 'approved', label: 'Approved', count: lists.approved.length },
            { value: 'rejected', label: 'Rejected', count: lists.rejected.length },
          ]}
        />
        <SearchInput value={q} onChange={setQ} placeholder="Search student" className="sm:w-56" />
      </div>

      {rows.length === 0 ? (
        <Card>
          <EmptyState icon={CalendarCheck} title={tab === 'pending' ? 'No pending requests' : tab === 'away' ? 'Everyone is in the hostel' : 'Nothing here yet'} description={tab === 'pending' ? 'New leave and outing requests from students will appear here.' : undefined} />
        </Card>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {rows.map((l) => {
            const s = i.student.get(l.studentId)!
            const loc = locationOf(data, s)
            const nights = Math.max(0, daysBetween(l.from, l.to))
            return (
              <Card key={l.id} className="p-4">
                <div className="flex items-start gap-3">
                  <Avatar name={s.name} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link to={`/manager/students/${s.id}`} className="font-semibold text-slate-900 hover:text-brand-700">{s.name}</Link>
                      <Badge tone={l.type === 'Outing' ? 'blue' : 'violet'}>{l.type === 'Outing' ? <Clock size={11} /> : <Moon size={11} />}{l.type}</Badge>
                    </div>
                    <div className="text-[13px] text-slate-500">Room {loc?.room.number ?? '—'} · {s.guardianName} (guardian)</div>
                  </div>
                  {tab !== 'pending' && <StatusBadge status={isCurrentlyAway(l) ? 'away' : l.status} />}
                </div>
                <div className="mt-3 flex items-center gap-3 rounded-xl bg-slate-50 px-3.5 py-2.5 text-[13px]">
                  <div>
                    <div className="font-semibold text-slate-900">{formatDate(l.from)} {l.type === 'Outing' && formatTime(l.from)}</div>
                    <div className="text-xs text-slate-500">{weekday(l.from)}</div>
                  </div>
                  <span className="text-slate-300">→</span>
                  <div>
                    <div className="font-semibold text-slate-900">{formatDate(l.to)} {l.type === 'Outing' && formatTime(l.to)}</div>
                    <div className="text-xs text-slate-500">{weekday(l.to)}</div>
                  </div>
                  <span className="ml-auto text-xs text-slate-500">{l.type === 'Outing' ? 'Same day' : `${nights} night${nights === 1 ? '' : 's'}`}</span>
                </div>
                <p className="mt-3 text-[13px] text-slate-700"><span className="text-slate-400">Reason: </span>{l.reason}</p>
                {l.decisionNote && <p className="mt-1 text-[13px] text-slate-500">Note: {l.decisionNote}</p>}
                <div className="mt-3 flex items-center justify-between gap-2">
                  <span className="text-xs text-slate-400">Requested {timeAgo(l.createdAt)}</span>
                  {l.status === 'pending' && (
                    <div className="flex gap-2">
                      <Button size="sm" icon={X} onClick={() => reject(l)}>Reject</Button>
                      <Button size="sm" variant="success" icon={Check} onClick={() => approve(l)}>Approve</Button>
                    </div>
                  )}
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
