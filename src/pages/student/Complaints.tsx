import { useState } from 'react'
import { Camera, CheckCircle2, MessageSquareWarning, Plus } from 'lucide-react'
import { useCurrentStudent, useStore } from '../../store/AppStore'
import { idx } from '../../store/selectors'
import type { ComplaintStatus } from '../../lib/types'
import { CATEGORY_META } from '../../lib/meta'
import { cn, formatDateTime, timeAgo } from '../../lib/utils'
import { Button, Card, EmptyState, PageHeader, StatusBadge, Tabs } from '../../components/ui'
import { useModals } from '../../components/domain/ModalsProvider'
import { ComplaintProgress } from './Home'

export default function StudentComplaints() {
  const { data } = useStore()
  const s = useCurrentStudent()
  const modals = useModals()
  const [tab, setTab] = useState<'active' | 'resolved'>('active')
  const [expanded, setExpanded] = useState<string | null>(null)
  const i = idx(data)
  const all = data.complaints.filter((c) => c.studentId === s.id)
  const rows = all.filter((c) => (tab === 'active' ? c.status !== 'resolved' : c.status === 'resolved'))
  const raise = () => modals.open({ type: 'complaint', studentId: s.id, studentMode: true })

  return (
    <div>
      <PageHeader title="Complaints" description="Report an issue and track it until it’s fixed" actions={<Button variant="primary" icon={Plus} onClick={raise}>Raise complaint</Button>} />
      <Tabs className="mb-4" value={tab} onChange={setTab} items={[{ value: 'active', label: 'Active', count: all.filter((c) => c.status !== 'resolved').length }, { value: 'resolved', label: 'Resolved', count: all.filter((c) => c.status === 'resolved').length }]} />
      {rows.length === 0 ? (
        <Card>
          <EmptyState icon={tab === 'active' ? CheckCircle2 : MessageSquareWarning} title={tab === 'active' ? 'No active complaints' : 'No resolved complaints yet'} description={tab === 'active' ? 'Everything looks good. If something breaks, let the hostel team know.' : undefined} action={tab === 'active' && <Button size="sm" variant="primary" onClick={raise}>Raise complaint</Button>} />
        </Card>
      ) : (
        <div className="space-y-3">
          {rows.map((c) => {
            const M = CATEGORY_META[c.category]
            const staff = data.staff.find((x) => x.id === c.assignedTo)
            const open = expanded === c.id
            return (
              <Card key={c.id} className="p-4">
                <button className="w-full text-left" onClick={() => setExpanded(open ? null : c.id)}>
                  <div className="flex items-start gap-3">
                    <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-xl', M.tone)}><M.icon size={18} /></span>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-slate-900">{c.title}</div>
                      <div className="text-[13px] text-slate-500">{c.roomId ? `Room ${i.room.get(c.roomId)?.number}` : 'Common area'} · {c.category} · #{c.number}{c.hasImage && <Camera size={12} className="ml-1 inline" />}</div>
                    </div>
                    <StatusBadge status={c.status} />
                  </div>
                  <ComplaintProgress status={c.status as ComplaintStatus} />
                  <div className="mt-2 text-xs text-slate-500">
                    {staff ? `Assigned to ${staff.name} (${staff.role})` : 'Waiting to be assigned'} · updated {timeAgo(c.updatedAt)}
                  </div>
                </button>
                {open && (
                  <div className="mt-4 border-t border-slate-100 pt-4">
                    {c.description && <p className="mb-4 text-sm text-slate-700">{c.description}</p>}
                    <ol className="space-y-3 border-l border-slate-200 pl-4">
                      {c.history.map((h, n) => (
                        <li key={n} className="relative">
                          <span className={cn('absolute top-1.5 -left-[21px] size-2.5 rounded-full ring-4 ring-white', h.status === 'resolved' ? 'bg-emerald-500' : h.status === 'in-progress' ? 'bg-amber-500' : 'bg-slate-400')} />
                          <div className="text-[13px] font-medium text-slate-800">{h.note}</div>
                          <div className="text-xs text-slate-400">{formatDateTime(h.at)}</div>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
