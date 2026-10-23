import { Megaphone, Pin, Plus, Trash2, Users } from 'lucide-react'
import { useManagerProperty, useStore } from '../../store/AppStore'
import type { Announcement } from '../../lib/types'
import { formatDateTime, timeAgo } from '../../lib/utils'
import { Badge, Button, Card, EmptyState, PageHeader, useConfirm, useToast, type Tone } from '../../components/ui'
import { useModals } from '../../components/domain/ModalsProvider'

export const ANN_TONE: Record<Announcement['category'], Tone> = { General: 'neutral', Maintenance: 'blue', Event: 'violet', Important: 'red' }

export function audienceLabel(a: Announcement, roomNumber: (id: string) => string | undefined) {
  if (a.audience === 'all') return 'All students'
  if (a.audience === 'floor') return `Floor ${a.audienceValue}`
  return `Room ${roomNumber(a.audienceValue ?? '')}`
}

export default function AnnouncementsPage() {
  const { data, deleteAnnouncement } = useStore()
  const property = useManagerProperty()
  const modals = useModals()
  const confirm = useConfirm()
  const toast = useToast()
  const list = data.announcements.filter((a) => a.propertyId === property.id).sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.createdAt.localeCompare(a.createdAt))
  const roomNumber = (id: string) => data.rooms.find((r) => r.id === id)?.number

  return (
    <div>
      <PageHeader title="Announcements" description="Notices shown on the student app" actions={<Button variant="primary" icon={Plus} onClick={() => modals.open({ type: 'announcement' })}>New announcement</Button>} />
      {list.length === 0 ? (
        <Card><EmptyState icon={Megaphone} title="No announcements yet" description="Publish notices about maintenance, events or rules." action={<Button size="sm" variant="primary" onClick={() => modals.open({ type: 'announcement' })}>Create announcement</Button>} /></Card>
      ) : (
        <div className="space-y-3">
          {list.map((a) => (
            <Card key={a.id} className="flex gap-4 p-4 sm:p-5">
              <span className="hidden size-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 sm:flex"><Megaphone size={18} /></span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold text-slate-900">{a.title}</h3>
                  <Badge tone={ANN_TONE[a.category]}>{a.category}</Badge>
                  {a.pinned && <Badge tone="brand"><Pin size={11} />Pinned</Badge>}
                </div>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">{a.message}</p>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
                  <span className="inline-flex items-center gap-1"><Users size={12} />{audienceLabel(a, roomNumber)}</span>
                  <span title={formatDateTime(a.createdAt)}>{timeAgo(a.createdAt)}</span>
                  <span>by {a.author}</span>
                </div>
              </div>
              <Button size="sm" variant="ghost" icon={Trash2} aria-label="Delete announcement" onClick={async () => {
                const { ok } = await confirm({ title: 'Delete announcement?', description: `“${a.title}” will be removed from the student app.`, tone: 'danger', confirmLabel: 'Delete' })
                if (ok) { deleteAnnouncement(a.id); toast.success('Announcement deleted') }
              }} />
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
