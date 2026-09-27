import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CheckCircle2, Plus } from 'lucide-react'
import { useManagerProperty, useStore } from '../../store/AppStore'
import type { ComplaintCategory, ComplaintStatus } from '../../lib/types'
import { COMPLAINT_CATEGORIES, CATEGORY_META } from '../../lib/meta'
import { Button, Card, Chip, EmptyState, PageHeader, SearchInput, Select, Tabs } from '../../components/ui'
import { ComplaintCard, ComplaintDrawer } from '../../components/domain/ComplaintCard'
import { useModals } from '../../components/domain/ModalsProvider'

type Tab = 'all' | ComplaintStatus
const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 }

export default function ComplaintsPage() {
  const { data } = useStore()
  const property = useManagerProperty()
  const modals = useModals()
  const [params, setParams] = useSearchParams()
  const tab = (params.get('status') as Tab) ?? 'all'
  const openId = params.get('open')
  const [category, setCategory] = useState<ComplaintCategory | 'all'>('all')
  const [priority, setPriority] = useState('all')
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<'newest' | 'priority'>('priority')

  const all = data.complaints.filter((c) => c.propertyId === property.id)
  const filtered = all
    .filter((c) => category === 'all' || c.category === category)
    .filter((c) => priority === 'all' || c.priority === priority)
    .filter((c) => {
      const t = q.trim().toLowerCase()
      if (!t) return true
      const s = data.students.find((x) => x.id === c.studentId)
      return c.title.toLowerCase().includes(t) || String(c.number).includes(t) || s?.name.toLowerCase().includes(t) || data.rooms.find((r) => r.id === c.roomId)?.number.includes(t)
    })
  const rows = filtered
    .filter((c) => tab === 'all' || c.status === tab)
    .sort((a, b) => {
      const sa = a.status === 'resolved' ? 1 : 0
      const sb = b.status === 'resolved' ? 1 : 0
      if (sa !== sb) return sa - sb
      if (sort === 'priority' && PRIORITY_ORDER[a.priority] !== PRIORITY_ORDER[b.priority]) return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
      return b.createdAt.localeCompare(a.createdAt)
    })
  const set = (k: string, v: string | null) => {
    if (v) params.set(k, v)
    else params.delete(k)
    setParams(params, { replace: true })
  }
  const openComplaint = openId ? data.complaints.find((c) => c.id === openId) : null

  return (
    <div>
      <PageHeader title="Complaints" description="Track issues from report to resolution" actions={<Button variant="primary" icon={Plus} onClick={() => modals.open({ type: 'complaint' })}>New complaint</Button>} />

      <Tabs<Tab>
        className="mb-4"
        value={tab}
        onChange={(v) => set('status', v === 'all' ? null : v)}
        items={[
          { value: 'all', label: 'All', count: filtered.length },
          { value: 'open', label: 'Open', count: filtered.filter((c) => c.status === 'open').length },
          { value: 'in-progress', label: 'In Progress', count: filtered.filter((c) => c.status === 'in-progress').length },
          { value: 'resolved', label: 'Resolved', count: filtered.filter((c) => c.status === 'resolved').length },
        ]}
      />
      <div className="mb-5 flex flex-col gap-3 2xl:flex-row 2xl:items-center">
        <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
          <Chip active={category === 'all'} onClick={() => setCategory('all')}>All categories</Chip>
          {COMPLAINT_CATEGORIES.map((c) => {
            const M = CATEGORY_META[c]
            return (
              <Chip key={c} active={category === c} onClick={() => setCategory(c)}>
                <M.icon size={14} /> {c}
              </Chip>
            )
          })}
        </div>
        <div className="flex gap-2 2xl:ml-auto">
          <SearchInput value={q} onChange={setQ} placeholder="Search title, #, room, student" className="flex-1 sm:max-w-80 2xl:w-64" />
          <Select value={priority} onChange={(e) => setPriority(e.target.value)} className="h-9 w-36">
            <option value="all">Any priority</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </Select>
          <Select value={sort} onChange={(e) => setSort(e.target.value as 'newest' | 'priority')} className="hidden h-9 w-40 sm:block">
            <option value="priority">Sort: Priority</option>
            <option value="newest">Sort: Newest</option>
          </Select>
        </div>
      </div>

      {rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={CheckCircle2}
            title="No complaints found."
            description={tab === 'resolved' ? 'Nothing resolved matches these filters.' : 'Everything looks good.'}
            action={tab !== 'resolved' && <Button size="sm" onClick={() => set('status', 'resolved')}>View resolved complaints</Button>}
          />
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {rows.map((c) => <ComplaintCard key={c.id} complaint={c} onOpen={() => set('open', c.id)} />)}
        </div>
      )}

      {openComplaint && <ComplaintDrawer complaint={openComplaint} onClose={() => set('open', null)} />}
    </div>
  )
}
