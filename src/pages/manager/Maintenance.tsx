import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, Hammer, Link2, Play, Plus, UserRound } from 'lucide-react'
import { useManagerProperty, useStore } from '../../store/AppStore'
import { idx, propertyStats } from '../../store/selectors'
import type { MaintenanceStatus, MaintenanceTask } from '../../lib/types'
import { cn, formatDate, formatINR, timeAgo } from '../../lib/utils'
import { Avatar, Button, Card, EmptyState, Field, Input, KpiCard, Modal, PageHeader, PriorityBadge, useToast } from '../../components/ui'
import { MaintenanceTaskModal } from '../../components/domain/ComplaintCard'

const COLUMNS: { status: MaintenanceStatus; label: string; dot: string }[] = [
  { status: 'open', label: 'Open', dot: 'bg-rose-500' },
  { status: 'in-progress', label: 'In progress', dot: 'bg-amber-500' },
  { status: 'done', label: 'Done', dot: 'bg-emerald-500' },
]

export default function MaintenancePage() {
  const { data, updateMaintenance } = useStore()
  const property = useManagerProperty()
  const toast = useToast()
  const [creating, setCreating] = useState(false)
  const [completing, setCompleting] = useState<MaintenanceTask | null>(null)
  const i = idx(data)
  const tasks = data.maintenance.filter((m) => m.propertyId === property.id)
  const st = propertyStats(data, property.id)
  const staff = data.staff.filter((s) => s.propertyId === property.id && s.role !== 'Manager')
  const pendingCost = tasks.filter((t) => t.status !== 'done').reduce((a, t) => a + t.cost, 0)

  return (
    <div>
      <PageHeader title="Maintenance" description="Repairs and upkeep — linked to complaints and expenses" actions={<Button variant="primary" icon={Plus} onClick={() => setCreating(true)}>New task</Button>} />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Open tasks" value={tasks.filter((t) => t.status === 'open').length} tone="red" icon={Hammer} />
        <KpiCard label="In progress" value={tasks.filter((t) => t.status === 'in-progress').length} tone="amber" />
        <KpiCard label="Spent this month" value={formatINR(st.maintenanceCostThisMonth)} tone="green" sub="Booked as expenses" />
        <KpiCard label="Estimated (pending)" value={formatINR(pendingCost)} sub="Open + in progress" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {COLUMNS.map((col) => {
          const list = tasks.filter((t) => t.status === col.status).sort((a, b) => (col.status === 'done' ? (b.completedAt ?? '').localeCompare(a.completedAt ?? '') : b.createdAt.localeCompare(a.createdAt)))
          return (
            <div key={col.status} className="rounded-2xl bg-slate-100/70 p-3">
              <div className="mb-3 flex items-center gap-2 px-1">
                <span className={cn('size-2 rounded-full', col.dot)} />
                <span className="text-sm font-semibold text-slate-800">{col.label}</span>
                <span className="text-xs text-slate-500 tabular">{list.length}</span>
              </div>
              <div className="space-y-2.5">
                {list.length === 0 && <EmptyState compact icon={Hammer} title="Nothing here" className="rounded-xl bg-white" />}
                {list.map((t) => {
                  const assignee = staff.find((s) => s.id === t.assignedTo)
                  const complaint = data.complaints.find((c) => c.id === t.complaintId)
                  return (
                    <Card key={t.id} className="p-3.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-slate-900">{t.title}</div>
                          <div className="text-xs text-slate-500">{t.roomId ? `Room ${i.room.get(t.roomId)?.number}` : 'Common area'} · {t.status === 'done' && t.completedAt ? `done ${formatDate(t.completedAt)}` : timeAgo(t.createdAt)}</div>
                        </div>
                        <span className="text-sm font-semibold text-slate-900 tabular">{formatINR(t.cost)}</span>
                      </div>
                      {complaint && (
                        <Link to={`/manager/complaints?open=${complaint.id}`} className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline">
                          <Link2 size={12} /> Complaint #{complaint.number}
                        </Link>
                      )}
                      <div className="mt-3 flex items-center gap-2">
                        <PriorityBadge priority={t.priority} />
                        {t.status === 'done' ? (
                          <span className="ml-auto flex items-center gap-1.5 text-xs text-slate-500">{assignee && <Avatar name={assignee.name} size="xs" />}{assignee?.name ?? 'Unassigned'}</span>
                        ) : (
                          <select
                            value={t.assignedTo ?? ''}
                            onChange={(e) => { updateMaintenance(t.id, { assignedTo: e.target.value || null }); toast.success('Task reassigned') }}
                            className="ml-auto h-7 max-w-36 truncate rounded-md border border-slate-200 bg-white px-1.5 text-xs text-slate-700"
                            aria-label="Assign staff"
                          >
                            <option value="">Unassigned</option>
                            {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                          </select>
                        )}
                      </div>
                      {t.status !== 'done' && (
                        <div className="mt-3 flex gap-2 border-t border-slate-100 pt-3">
                          {!t.assignedTo && <span className="flex items-center gap-1 text-xs text-slate-400"><UserRound size={13} />Assign someone</span>}
                          {t.status === 'open' ? (
                            <Button size="xs" variant="subtle" icon={Play} className="ml-auto" onClick={() => { updateMaintenance(t.id, { status: 'in-progress' }); toast.success('Work started', { description: complaint ? `Complaint #${complaint.number} moved to In Progress` : undefined }) }}>Start</Button>
                          ) : (
                            <Button size="xs" variant="success" icon={CheckCircle2} className="ml-auto" onClick={() => setCompleting(t)}>Complete</Button>
                          )}
                        </div>
                      )}
                    </Card>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
      {creating && <MaintenanceTaskModal onClose={() => setCreating(false)} propertyId={property.id} />}
      {completing && <CompleteModal task={completing} onClose={() => setCompleting(null)} />}
    </div>
  )
}

function CompleteModal({ task, onClose }: { task: MaintenanceTask; onClose: () => void }) {
  const { data, updateMaintenance } = useStore()
  const toast = useToast()
  const [cost, setCost] = useState(String(task.cost || ''))
  const complaint = data.complaints.find((c) => c.id === task.complaintId)
  return (
    <Modal open onClose={onClose} size="sm" title={`Complete “${task.title}”`} footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="success" icon={CheckCircle2} onClick={() => { updateMaintenance(task.id, { cost: Number(cost) || 0, status: 'done' }); toast.success('Task completed', { description: `${formatINR(Number(cost) || 0)} added to expenses${complaint ? ` · complaint #${complaint.number} resolved` : ''}` }); onClose() }}>Mark complete</Button></>}>
      <div className="space-y-4">
        <Field label="Final cost" hint="Recorded as a Maintenance expense for this month"><Input prefix="₹" type="number" autoFocus value={cost} onChange={(e) => setCost(e.target.value)} /></Field>
        {complaint && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-[13px] text-emerald-800">Linked complaint #{complaint.number} “{complaint.title}” will be marked resolved and the student notified.</p>}
      </div>
    </Modal>
  )
}

