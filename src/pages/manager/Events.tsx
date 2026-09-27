import { useState } from 'react'
import { CalendarDays, IndianRupee, MapPin, Pencil, Plus, Users } from 'lucide-react'
import { useStore } from '../../store/AppStore'
import type { EventStatus, HostelEvent } from '../../lib/types'
import { DEMO_TODAY, formatDate, formatINR, weekday } from '../../lib/utils'
import { Button, Card, Drawer, EmptyState, Field, Input, Modal, PageHeader, Select, StatusBadge, Tabs, Textarea, useToast } from '../../components/ui'

export default function EventsPage() {
  const { session } = useStore()
  return <EventsView propertyId={session.managerPropertyId} />
}

export function EventsView({ propertyId, owner }: { propertyId: string | 'all'; owner?: boolean }) {
  const { data } = useStore()
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming')
  const [editing, setEditing] = useState<HostelEvent | 'new' | null>(null)
  const [viewing, setViewing] = useState<HostelEvent | null>(null)
  const events = data.events.filter((e) => propertyId === 'all' || e.propertyId === propertyId)
  const upcoming = events.filter((e) => e.date >= DEMO_TODAY).sort((a, b) => a.date.localeCompare(b.date))
  const past = events.filter((e) => e.date < DEMO_TODAY).sort((a, b) => b.date.localeCompare(a.date))
  const rows = tab === 'upcoming' ? upcoming : past
  const pName = (id: string) => data.properties.find((p) => p.id === id)?.name
  const view = viewing ? data.events.find((e) => e.id === viewing.id) ?? null : null

  return (
    <div>
      <PageHeader title="Events" description={owner ? 'Festivals & community events across properties' : 'Festivals, parties and community events'} actions={<Button variant="primary" icon={Plus} onClick={() => setEditing('new')}>Create event</Button>} />
      <Tabs className="mb-5" value={tab} onChange={setTab} items={[{ value: 'upcoming', label: 'Upcoming', count: upcoming.length }, { value: 'past', label: 'Past', count: past.length }]} />
      {rows.length === 0 ? (
        <Card><EmptyState icon={CalendarDays} title={tab === 'upcoming' ? 'No upcoming events' : 'No past events'} action={tab === 'upcoming' && <Button size="sm" variant="primary" onClick={() => setEditing('new')}>Plan an event</Button>} /></Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((e) => {
            const d = new Date(`${e.date}T00:00:00`)
            return (
              <Card key={e.id} className="cursor-pointer p-4 transition-colors hover:border-slate-300" onClick={() => setViewing(e)}>
                <div className="flex items-start gap-3">
                  <div className="flex w-12 shrink-0 flex-col items-center rounded-xl border border-slate-200 py-1.5">
                    <span className="text-[10px] font-semibold text-rose-600 uppercase">{d.toLocaleString('en-IN', { month: 'short' })}</span>
                    <span className="text-lg leading-none font-semibold text-slate-900">{d.getDate()}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold text-slate-900">{e.name}</div>
                    <div className="truncate text-[13px] text-slate-500">{owner ? pName(e.propertyId) : e.location}</div>
                  </div>
                  <StatusBadge status={e.status} />
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2 text-[13px]">
                  <div className="flex items-center gap-1.5 text-slate-600"><Users size={14} className="text-slate-400" />{e.participants} participants</div>
                  <div className="flex items-center gap-1.5 text-slate-600"><IndianRupee size={14} className="text-slate-400" />{formatINR(e.budget)}</div>
                </div>
              </Card>
            )
          })}
        </div>
      )}
      {view && (
        <Drawer open onClose={() => setViewing(null)} title={view.name} description={`${weekday(view.date)}, ${formatDate(view.date, { year: true })}${owner ? ` · ${pName(view.propertyId)}` : ''}`} footer={<Button icon={Pencil} onClick={() => { setEditing(view); setViewing(null) }}>Edit event</Button>}>
          <div className="space-y-4">
            <StatusBadge status={view.status} />
            <p className="text-sm leading-relaxed text-slate-700">{view.description}</p>
            <div className="grid grid-cols-3 divide-x divide-slate-100 rounded-xl border border-slate-200 text-center">
              <div className="p-3"><div className="font-semibold text-slate-900 tabular">{view.participants}</div><div className="text-xs text-slate-500">Participants</div></div>
              <div className="p-3"><div className="font-semibold text-slate-900 tabular">{formatINR(view.budget)}</div><div className="text-xs text-slate-500">Budget</div></div>
              <div className="p-3"><div className="font-semibold text-slate-900 tabular">{view.rsvps.length}</div><div className="text-xs text-slate-500">App RSVPs</div></div>
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-600"><MapPin size={15} className="text-slate-400" />{view.location}</div>
          </div>
        </Drawer>
      )}
      {editing && <EventModal event={editing === 'new' ? null : editing} propertyId={propertyId} onClose={() => setEditing(null)} />}
    </div>
  )
}

function EventModal({ event, propertyId, onClose }: { event: HostelEvent | null; propertyId: string | 'all'; onClose: () => void }) {
  const { data, saveEvent } = useStore()
  const toast = useToast()
  const [f, setF] = useState({
    name: event?.name ?? '', date: event?.date ?? '2026-10-10', location: event?.location ?? '', description: event?.description ?? '',
    participants: String(event?.participants ?? ''), budget: String(event?.budget ?? ''), status: event?.status ?? ('Planning' as EventStatus),
    propertyId: event?.propertyId ?? (propertyId === 'all' ? data.properties[0]!.id : propertyId),
  })
  const save = () => {
    if (!f.name.trim() || !f.date) return toast.error('Event name and date are required.')
    saveEvent({ id: event?.id, propertyId: f.propertyId, name: f.name.trim(), date: f.date, location: f.location, description: f.description, participants: Number(f.participants) || 0, budget: Number(f.budget) || 0, status: f.status })
    toast.success(event ? 'Event updated' : 'Event created')
    onClose()
  }
  return (
    <Modal open onClose={onClose} title={event ? 'Edit event' : 'Create event'} footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" onClick={save}>{event ? 'Save changes' : 'Create event'}</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Event name" className="sm:col-span-2"><Input autoFocus value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. Freshers Party" /></Field>
        {propertyId === 'all' && (
          <Field label="Property" className="sm:col-span-2">
            <Select value={f.propertyId} onChange={(e) => setF({ ...f, propertyId: e.target.value })}>{data.properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select>
          </Field>
        )}
        <Field label="Date"><Input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
        <Field label="Location"><Input value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} placeholder="e.g. Block A lawn" /></Field>
        <Field label="Expected participants"><Input type="number" value={f.participants} onChange={(e) => setF({ ...f, participants: e.target.value })} /></Field>
        <Field label="Budget"><Input prefix="₹" type="number" value={f.budget} onChange={(e) => setF({ ...f, budget: e.target.value })} /></Field>
        <Field label="Status"><Select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as EventStatus })}>{(['Planning', 'Confirmed', 'Completed', 'Cancelled'] as const).map((s) => <option key={s}>{s}</option>)}</Select></Field>
        <Field label="Description" className="sm:col-span-2"><Textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
      </div>
    </Modal>
  )
}
