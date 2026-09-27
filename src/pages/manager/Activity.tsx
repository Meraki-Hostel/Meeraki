import { useState } from 'react'
import { History } from 'lucide-react'
import { useManagerProperty, useStore } from '../../store/AppStore'
import type { ActivityKind } from '../../lib/types'
import { Card, Chip, EmptyState, PageHeader, SearchInput } from '../../components/ui'
import { ActivityFeed } from '../../components/domain/ActivityFeed'

const KINDS: { value: ActivityKind | 'all'; label: string }[] = [
  { value: 'all', label: 'All' }, { value: 'student', label: 'Students' }, { value: 'room', label: 'Rooms' }, { value: 'payment', label: 'Payments' },
  { value: 'complaint', label: 'Complaints' }, { value: 'leave', label: 'Leave' }, { value: 'visitor', label: 'Visitors' }, { value: 'inventory', label: 'Inventory' },
  { value: 'maintenance', label: 'Maintenance' }, { value: 'announcement', label: 'Announcements' }, { value: 'emergency', label: 'Emergency' },
]

export default function ActivityPage() {
  const { data } = useStore()
  const property = useManagerProperty()
  const [kind, setKind] = useState<ActivityKind | 'all'>('all')
  const [q, setQ] = useState('')
  const [limit, setLimit] = useState(40)
  const items = data.activity.filter((a) => a.propertyId === property.id && (kind === 'all' || a.kind === kind) && (!q || a.message.toLowerCase().includes(q.toLowerCase())))
  return (
    <div>
      <PageHeader title="Activity log" description="Every important action across the property, newest first" />
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="no-scrollbar flex gap-1.5 overflow-x-auto">{KINDS.map((k) => <Chip key={k.value} active={kind === k.value} onClick={() => setKind(k.value)}>{k.label}</Chip>)}</div>
        <SearchInput value={q} onChange={setQ} placeholder="Search activity" className="lg:ml-auto lg:w-64" />
      </div>
      <Card className="p-5">
        {items.length ? (
          <>
            <ActivityFeed items={items.slice(0, limit)} />
            {items.length > limit && <button onClick={() => setLimit((l) => l + 40)} className="mt-2 text-[13px] font-medium text-brand-700">Load more</button>}
          </>
        ) : (
          <EmptyState compact icon={History} title="No activity found" />
        )}
      </Card>
    </div>
  )
}
