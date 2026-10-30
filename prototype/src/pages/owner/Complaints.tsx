import { useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { useStore } from '../../store/AppStore'
import type { ComplaintStatus } from '../../lib/types'
import { Card, EmptyState, KpiCard, PageHeader, Select, Tabs } from '../../components/ui'
import { ComplaintCard, ComplaintDrawer } from '../../components/domain/ComplaintCard'

type Tab = 'unresolved' | ComplaintStatus

export default function OwnerComplaints() {
  const { data } = useStore()
  const [pid, setPid] = useState('all')
  const [tab, setTab] = useState<Tab>('unresolved')
  const [priority, setPriority] = useState('all')
  const [openId, setOpenId] = useState<string | null>(null)
  const scoped = data.complaints.filter((c) => (pid === 'all' || c.propertyId === pid) && (priority === 'all' || c.priority === priority))
  const rows = scoped
    .filter((c) => (tab === 'unresolved' ? c.status !== 'resolved' : c.status === tab))
    .sort((a, b) => ({ high: 0, medium: 1, low: 2 })[a.priority] - ({ high: 0, medium: 1, low: 2 })[b.priority] || b.createdAt.localeCompare(a.createdAt))
  const resolved = scoped.filter((c) => c.status === 'resolved')
  const avgHours = resolved.length ? resolved.reduce((a, c) => a + (new Date(c.updatedAt).getTime() - new Date(c.createdAt).getTime()) / 3600e3, 0) / resolved.length : 0
  const opened = openId ? data.complaints.find((c) => c.id === openId) : null

  return (
    <div>
      <PageHeader title="Complaints" description="Portfolio view — managers handle day-to-day resolution" actions={
        <Select value={pid} onChange={(e) => setPid(e.target.value)} className="h-9 w-52">
          <option value="all">All properties</option>
          {data.properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </Select>
      } />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Unresolved" value={scoped.filter((c) => c.status !== 'resolved').length} tone="amber" />
        <KpiCard label="High priority open" value={scoped.filter((c) => c.status !== 'resolved' && c.priority === 'high').length} tone="red" />
        <KpiCard label="Resolved (30 days)" value={resolved.length} tone="green" />
        <KpiCard label="Avg. resolution time" value={`${avgHours < 48 ? `${Math.round(avgHours)} h` : `${(avgHours / 24).toFixed(1)} days`}`} />
      </div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <Tabs<Tab> className="flex-1" value={tab} onChange={setTab} items={[
          { value: 'unresolved', label: 'Unresolved', count: scoped.filter((c) => c.status !== 'resolved').length },
          { value: 'open', label: 'Open', count: scoped.filter((c) => c.status === 'open').length },
          { value: 'in-progress', label: 'In Progress', count: scoped.filter((c) => c.status === 'in-progress').length },
          { value: 'resolved', label: 'Resolved', count: resolved.length },
        ]} />
        <Select value={priority} onChange={(e) => setPriority(e.target.value)} className="h-9 w-40">
          <option value="all">Any priority</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
        </Select>
      </div>
      {rows.length === 0 ? (
        <Card><EmptyState icon={CheckCircle2} title="No complaints found." description="Everything looks good." /></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {rows.map((c) => <ComplaintCard key={c.id} complaint={c} readOnly showProperty={pid === 'all'} onOpen={() => setOpenId(c.id)} />)}
        </div>
      )}
      {opened && <ComplaintDrawer complaint={opened} readOnly onClose={() => setOpenId(null)} />}
    </div>
  )
}
