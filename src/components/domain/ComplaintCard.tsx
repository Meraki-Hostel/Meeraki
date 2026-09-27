import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Camera, CheckCircle2, ChevronDown, Hammer, ImageIcon, Play, UserRound, Wrench } from 'lucide-react'
import { useStore } from '../../store/AppStore'
import { idx } from '../../store/selectors'
import type { Complaint } from '../../lib/types'
import { CATEGORY_META } from '../../lib/meta'
import { cn, formatDateTime, formatINR, timeAgo } from '../../lib/utils'
import { Avatar, Badge, Button, Card, Drawer, Field, Input, Menu, Modal, PriorityBadge, Select, StatusBadge, useConfirm, useToast } from '../ui'

export function useComplaintActions() {
  const { assignComplaint, setComplaintStatus, data } = useStore()
  const toast = useToast()
  const confirm = useConfirm()
  return {
    assign: (c: Complaint, staffId: string) => {
      assignComplaint(c.id, staffId)
      toast.success('Complaint assigned', { description: `${data.staff.find((s) => s.id === staffId)?.name} will handle #${c.number}` })
    },
    start: (c: Complaint) => {
      setComplaintStatus(c.id, 'in-progress')
      toast.success('Work started', { description: `#${c.number} is now In Progress — the student can see this.` })
    },
    resolve: async (c: Complaint) => {
      const r = await confirm({ title: `Mark #${c.number} as resolved?`, description: `“${c.title}” will show as Resolved in the student app.`, confirmLabel: 'Mark resolved', tone: 'success', note: { label: 'Resolution note (optional)', placeholder: 'e.g. Replaced fan capacitor' } })
      if (!r.ok) return
      setComplaintStatus(c.id, 'resolved', r.note)
      toast.success('Complaint marked as resolved.')
    },
    reopen: (c: Complaint) => {
      setComplaintStatus(c.id, 'open', 'Reopened')
      toast.info('Complaint reopened')
    },
  }
}

export function ComplaintCard({ complaint: c, onOpen, readOnly, showProperty }: { complaint: Complaint; onOpen: () => void; readOnly?: boolean; showProperty?: boolean }) {
  const { data } = useStore()
  const i = idx(data)
  const act = useComplaintActions()
  const M = CATEGORY_META[c.category]
  const s = c.studentId ? i.student.get(c.studentId) : null
  const staff = c.assignedTo ? data.staff.find((x) => x.id === c.assignedTo) : null
  const propStaff = data.staff.filter((x) => x.propertyId === c.propertyId && x.role !== 'Manager')
  return (
    <Card className="flex flex-col p-4 transition-colors hover:border-slate-300">
      <button onClick={onOpen} className="text-left">
        <div className="flex items-start gap-3">
          <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-lg', M.tone)}>
            <M.icon size={17} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span>#{c.number}</span>
              <span>·</span>
              <span>{c.category}</span>
              {c.hasImage && <Camera size={12} />}
            </div>
            <div className="mt-0.5 truncate text-[15px] font-semibold text-slate-900">{c.title}</div>
            <div className="mt-0.5 text-[13px] text-slate-500">
              {c.roomId ? `Room ${i.room.get(c.roomId)?.number}` : 'Common area'}
              {showProperty && ` · ${data.properties.find((p) => p.id === c.propertyId)?.name}`}
            </div>
          </div>
          <StatusBadge status={c.status} />
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-2 text-[13px]">
          <div>
            <dt className="text-xs text-slate-400">Submitted by</dt>
            <dd className="truncate font-medium text-slate-700">{s?.name ?? 'Manager'}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-400">Priority</dt>
            <dd><PriorityBadge priority={c.priority} /></dd>
          </div>
        </dl>
      </button>
      <div className="mt-3 flex items-center gap-2 border-t border-slate-100 pt-3">
        <span className="flex min-w-0 flex-1 items-center gap-1.5 text-xs text-slate-500">
          {staff ? <><Avatar name={staff.name} size="xs" /><span className="truncate">{staff.name}</span></> : <><UserRound size={14} />Unassigned</>}
          <span className="text-slate-300">·</span>
          <span className="shrink-0">{timeAgo(c.createdAt)}</span>
        </span>
        {!readOnly && c.status !== 'resolved' && (
          <>
            <Menu
              width="w-56"
              items={propStaff.map((st) => ({ label: `${st.name} · ${st.role}`, onClick: () => act.assign(c, st.id) }))}
              trigger={() => <Button size="xs" variant="ghost" iconRight={ChevronDown}>Assign</Button>}
            />
            {c.status === 'open' ? (
              <Button size="xs" variant="subtle" icon={Play} onClick={() => act.start(c)}>Start</Button>
            ) : (
              <Button size="xs" variant="success" icon={CheckCircle2} onClick={() => act.resolve(c)}>Resolve</Button>
            )}
          </>
        )}
      </div>
    </Card>
  )
}

export function ComplaintDrawer({ complaint: c, onClose, readOnly }: { complaint: Complaint; onClose: () => void; readOnly?: boolean }) {
  const { data } = useStore()
  const act = useComplaintActions()
  const i = idx(data)
  const [taskOpen, setTaskOpen] = useState(false)
  const M = CATEGORY_META[c.category]
  const s = c.studentId ? i.student.get(c.studentId) : null
  const staff = c.assignedTo ? data.staff.find((x) => x.id === c.assignedTo) : null
  const tasks = data.maintenance.filter((m) => m.complaintId === c.id)
  const propStaff = data.staff.filter((x) => x.propertyId === c.propertyId && x.role !== 'Manager')
  return (
    <Drawer
      open
      onClose={onClose}
      title={<span className="flex items-center gap-2">#{c.number} {c.title}</span>}
      description={<span className="flex flex-wrap items-center gap-2"><StatusBadge status={c.status} /><PriorityBadge priority={c.priority} /><Badge tone="slate"><M.icon size={12} />{c.category}</Badge></span>}
      footer={
        !readOnly && (
          <>
            {c.status === 'resolved' ? (
              <Button onClick={() => act.reopen(c)}>Reopen</Button>
            ) : (
              <>
                <Button icon={Wrench} onClick={() => setTaskOpen(true)}>Create maintenance task</Button>
                {c.status === 'open' && <Button variant="subtle" icon={Play} onClick={() => act.start(c)}>Start work</Button>}
                <Button variant="success" icon={CheckCircle2} onClick={() => act.resolve(c)}>Resolve</Button>
              </>
            )}
          </>
        )
      }
    >
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-3 text-[13px]">
          <Info label="Room" value={c.roomId ? `Room ${i.room.get(c.roomId)?.number}` : 'Common area'} />
          <Info label="Submitted by" value={s ? <Link to={`/manager/students/${s.id}`} className="text-brand-700 hover:underline">{s.name}</Link> : 'Manager'} />
          <Info label="Submitted" value={formatDateTime(c.createdAt)} />
          <Info label="Assigned to" value={readOnly || c.status === 'resolved' ? staff?.name ?? 'Unassigned' : (
            <Select value={c.assignedTo ?? ''} onChange={(e) => e.target.value && act.assign(c, e.target.value)} className="h-8 text-[13px]">
              <option value="">Unassigned</option>
              {propStaff.map((st) => <option key={st.id} value={st.id}>{st.name} · {st.role}</option>)}
            </Select>
          )} />
        </div>
        <div>
          <div className="mb-1.5 text-xs font-semibold tracking-wide text-slate-400 uppercase">Description</div>
          <p className="text-sm leading-relaxed text-slate-700">{c.description || 'No description provided.'}</p>
        </div>
        {c.hasImage && (
          <div className="flex aspect-[16/9] items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 text-[13px] text-slate-500">
            <ImageIcon size={18} className="mr-2" /> Photo attached by student (mock preview)
          </div>
        )}
        {tasks.length > 0 && (
          <div>
            <div className="mb-1.5 text-xs font-semibold tracking-wide text-slate-400 uppercase">Linked maintenance</div>
            {tasks.map((m) => (
              <Link key={m.id} to="/manager/maintenance" className="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-2.5 hover:bg-slate-50">
                <Hammer size={16} className="text-slate-400" />
                <span className="flex-1 text-sm font-medium text-slate-800">{m.title}</span>
                <span className="text-[13px] text-slate-500 tabular">{formatINR(m.cost)}</span>
                <StatusBadge status={m.status} />
              </Link>
            ))}
          </div>
        )}
        <div>
          <div className="mb-2 text-xs font-semibold tracking-wide text-slate-400 uppercase">Timeline</div>
          <ol className="space-y-3 border-l border-slate-200 pl-4">
            {c.history.map((h, n) => (
              <li key={n} className="relative">
                <span className={cn('absolute top-1.5 -left-[21px] size-2.5 rounded-full ring-4 ring-white', h.status === 'resolved' ? 'bg-emerald-500' : h.status === 'in-progress' ? 'bg-amber-500' : h.status === 'created' ? 'bg-rose-500' : 'bg-slate-400')} />
                <div className="text-[13px] font-medium text-slate-800">{h.note}</div>
                <div className="text-xs text-slate-400">{formatDateTime(h.at)} · {h.by}</div>
              </li>
            ))}
          </ol>
        </div>
      </div>
      {taskOpen && <MaintenanceTaskModal onClose={() => setTaskOpen(false)} propertyId={c.propertyId} complaintId={c.id} roomId={c.roomId} defaultTitle={c.title} defaultAssignee={c.assignedTo} priority={c.priority} />}
    </Drawer>
  )
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-slate-400">{label}</div>
      <div className="mt-0.5 font-medium text-slate-800">{value}</div>
    </div>
  )
}

export function MaintenanceTaskModal({ onClose, propertyId, complaintId = null, roomId = null, defaultTitle = '', defaultAssignee = null, priority = 'medium' }: { onClose: () => void; propertyId: string; complaintId?: string | null; roomId?: string | null; defaultTitle?: string; defaultAssignee?: string | null; priority?: Complaint['priority'] }) {
  const { data, addMaintenance } = useStore()
  const toast = useToast()
  const [f, setF] = useState({ title: defaultTitle, roomId: roomId ?? '', assignedTo: defaultAssignee ?? '', priority, cost: '' })
  const staff = data.staff.filter((s) => s.propertyId === propertyId && s.role !== 'Manager')
  const rooms = data.rooms.filter((r) => r.propertyId === propertyId)
  const save = () => {
    if (!f.title.trim()) return toast.error('Add a task title.')
    addMaintenance({ propertyId, title: f.title.trim(), roomId: f.roomId || null, complaintId, assignedTo: f.assignedTo || null, priority: f.priority, cost: Number(f.cost) || 0 })
    toast.success('Maintenance task created', { description: complaintId ? 'Linked to the complaint' : undefined })
    onClose()
  }
  return (
    <Modal open onClose={onClose} title="New maintenance task" footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" onClick={save}>Create task</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Task" className="sm:col-span-2"><Input autoFocus value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="e.g. Fan replacement" /></Field>
        <Field label="Room">
          <Select value={f.roomId} onChange={(e) => setF({ ...f, roomId: e.target.value })}>
            <option value="">Common area</option>
            {rooms.map((r) => <option key={r.id} value={r.id}>Room {r.number}</option>)}
          </Select>
        </Field>
        <Field label="Assign to">
          <Select value={f.assignedTo} onChange={(e) => setF({ ...f, assignedTo: e.target.value })}>
            <option value="">Unassigned</option>
            {staff.map((s) => <option key={s.id} value={s.id}>{s.name} · {s.role}</option>)}
          </Select>
        </Field>
        <Field label="Priority">
          <Select value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value as Complaint['priority'] })}>
            <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
          </Select>
        </Field>
        <Field label="Estimated cost" hint="Booked as an expense when completed"><Input prefix="₹" type="number" value={f.cost} onChange={(e) => setF({ ...f, cost: e.target.value })} placeholder="1200" /></Field>
      </div>
    </Modal>
  )
}
