import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, CalendarPlus, Clock, MapPin, Megaphone, Users } from 'lucide-react';
import { services } from '@/services';
import type { EventInput, EventView } from '@/services/interfaces';
import type { EventCategory, EventStatus } from '@/types/domain';
import { useQuery } from '@/hooks/useQuery';
import { useMutation } from '@/hooks/useMutation';
import { useConfirm } from '@/app/providers/ConfirmProvider';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardHeader, ProgressBar } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { FilterBar, FilterSelect } from '@/components/ui/FilterBar';
import { SegmentedControl } from '@/components/ui/Tabs';
import { Dropdown } from '@/components/ui/Dropdown';
import { StatusBadge, statusOptions } from '@/components/ui/StatusBadge';
import { EmptyState, QueryBoundary, Skeleton } from '@/components/ui/States';
import { addDays, todayISO } from '@/lib/clock';
import { formatClock, formatDate, formatDateLong, sentenceCase } from '@/lib/format';

const CATS: EventCategory[] = ['cultural', 'sports', 'workshop', 'festival', 'meeting', 'health'];

function EventForm({ open, onClose, scope, editing }: { open: boolean; onClose: () => void; scope: 'owner' | 'manager'; editing: EventView | null }) {
  const props = useQuery(() => (scope === 'owner' && open ? services.properties.list() : Promise.resolve([])), [scope, open]);
  const blank = { propertyId: '', title: '', description: '', category: 'cultural' as EventCategory, date: addDays(todayISO(), 7), startTime: '18:00', endTime: '20:00', location: '', capacity: '50', expectedAttendance: '25' };
  const [f, setF] = useState(blank);
  useEffect(() => {
    if (!open) return;
    setF(editing ? { propertyId: editing.propertyId, title: editing.title, description: editing.description, category: editing.category, date: editing.date, startTime: editing.startTime, endTime: editing.endTime, location: editing.location, capacity: String(editing.capacity), expectedAttendance: String(editing.expectedAttendance) } : blank);
  }, [open, editing?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const save = useMutation((i: EventInput) => (editing ? services.events.update(editing.id, i) : services.events.create(i)), { success: editing ? 'Event updated.' : 'Event scheduled. Residents have been notified.', onSuccess: onClose });
  const e = save.fieldErrors;
  const submit = () => void save.run({ ...f, propertyId: f.propertyId || undefined, capacity: Number(f.capacity), expectedAttendance: Number(f.expectedAttendance) });
  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Edit event' : 'Create event'} size="lg"
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={save.pending} onClick={submit}>{editing ? 'Save changes' : 'Schedule event'}</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        {scope === 'owner' && <Select className="sm:col-span-2" label="Property" required value={f.propertyId} onChange={(ev) => setF({ ...f, propertyId: ev.target.value })} placeholder="Choose property" error={e.propertyId} options={(props.data ?? []).map((p) => ({ value: p.id, label: p.name }))} disabled={!!editing} />}
        <Input className="sm:col-span-2" label="Title" required value={f.title} onChange={(ev) => setF({ ...f, title: ev.target.value })} error={e.title} placeholder="e.g. Movie night on the terrace" />
        <Select label="Category" value={f.category} onChange={(ev) => setF({ ...f, category: ev.target.value as EventCategory })} options={CATS.map((c) => ({ value: c, label: sentenceCase(c) }))} />
        <Input label="Date" type="date" required min={editing ? undefined : todayISO()} value={f.date} onChange={(ev) => setF({ ...f, date: ev.target.value })} error={e.date} />
        <Input label="Starts" type="time" required value={f.startTime} onChange={(ev) => setF({ ...f, startTime: ev.target.value })} error={e.startTime} />
        <Input label="Ends" type="time" required value={f.endTime} onChange={(ev) => setF({ ...f, endTime: ev.target.value })} error={e.endTime} />
        <Input className="sm:col-span-2" label="Location" required value={f.location} onChange={(ev) => setF({ ...f, location: ev.target.value })} error={e.location} placeholder="e.g. Terrace" />
        <Input label="Capacity" type="number" min={1} required value={f.capacity} onChange={(ev) => setF({ ...f, capacity: ev.target.value })} error={e.capacity} />
        <Input label="Expected attendance" type="number" min={0} value={f.expectedAttendance} onChange={(ev) => setF({ ...f, expectedAttendance: ev.target.value })} error={e.expectedAttendance} hint="Your estimate; update as RSVPs come in" />
        <Textarea className="sm:col-span-2" label="Description" rows={3} value={f.description} onChange={(ev) => setF({ ...f, description: ev.target.value })} />
      </div>
    </Modal>
  );
}

function EventCard({ ev, scope, onEdit }: { ev: EventView; scope: 'owner' | 'manager'; onEdit: () => void }) {
  const confirm = useConfirm();
  const set = useMutation((s: EventStatus) => services.events.setStatus(ev.id, s), { success: (r) => (r.status === 'cancelled' ? 'Event cancelled. Residents have been notified.' : r.status === 'completed' ? 'Marked as completed.' : 'Event restored.') });
  const past = ev.date < todayISO();
  const day = new Date(`${ev.date}T12:00:00`);
  return (
    <article className="surface flex gap-4 p-4">
      <div className="flex w-14 shrink-0 flex-col items-center rounded-2xl bg-clay-50 py-2 text-clay-800" aria-hidden>
        <span className="text-[11px] font-semibold">{day.toLocaleDateString('en-GB', { month: 'short' })}</span>
        <span className="font-display text-2xl font-semibold leading-none">{day.getDate()}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-sans text-[15px] font-semibold text-espresso">{ev.title}</h3>
            <p className="text-xs text-dust">{sentenceCase(ev.category)}{scope === 'owner' ? ` · ${ev.propertyName}` : ''}</p>
          </div>
          <div className="flex items-center gap-1">
            <StatusBadge kind="event" value={ev.status} />
            <Dropdown label={`Actions for ${ev.title}`} items={[
              { label: 'Edit details', onSelect: onEdit, disabled: ev.status === 'cancelled', hint: ev.status === 'cancelled' ? 'Restore the event to edit it' : undefined },
              ...(ev.status === 'scheduled' ? [{ label: 'Mark completed', onSelect: () => void set.run('completed'), disabled: !past && ev.date !== todayISO(), hint: 'Available on or after the event date' }] : []),
              ...(ev.status === 'cancelled' ? [{ label: 'Restore event', onSelect: () => void set.run('scheduled') }] : []),
              ...(ev.status === 'scheduled' ? [{ label: 'Cancel event', danger: true, onSelect: async () => { if (await confirm({ title: `Cancel “${ev.title}”?`, message: 'Residents will be notified that this event is cancelled.', confirmLabel: 'Cancel event', cancelLabel: 'Keep event', tone: 'danger' })) void set.run('cancelled'); } }] : []),
            ]} trigger={({ toggle, open, id }) => <Button size="sm" variant="ghost" onClick={toggle} aria-haspopup="menu" aria-expanded={open} aria-controls={open ? id : undefined} aria-label={`Actions for ${ev.title}`}>•••</Button>} />
          </div>
        </div>
        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-bark">
          <li className="flex items-center gap-1"><CalendarDays className="size-3.5 text-dust" aria-hidden />{formatDateLong(ev.date)}</li>
          <li className="flex items-center gap-1"><Clock className="size-3.5 text-dust" aria-hidden />{formatClock(ev.startTime)} – {formatClock(ev.endTime)}</li>
          <li className="flex items-center gap-1"><MapPin className="size-3.5 text-dust" aria-hidden />{ev.location}</li>
        </ul>
        {ev.description && <p className="mt-2 line-clamp-2 text-sm text-bark">{ev.description}</p>}
        <div className="mt-3 flex items-center gap-3">
          <Users className="size-3.5 text-dust" aria-hidden />
          <ProgressBar value={(ev.expectedAttendance / ev.capacity) * 100} label="Expected attendance" tone="clay" className="max-w-40" />
          <span className="text-xs tabular-nums text-dust">{ev.expectedAttendance}/{ev.capacity} expected</span>
        </div>
      </div>
    </article>
  );
}

export function EventsBoard({ scope }: { scope: 'owner' | 'manager' }) {
  const [view, setView] = useState<'upcoming' | 'past'>('upcoming');
  const [status, setStatus] = useState('');
  const [property, setProperty] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<EventView | null>(null);
  const q = useQuery(() => services.events.list({ propertyId: property || undefined, status: (status || undefined) as EventStatus | undefined }), [property, status]);
  const props = useQuery(() => (scope === 'owner' ? services.properties.list() : Promise.resolve([])), [scope]);
  const notices = useQuery(() => (scope === 'owner' ? services.announcements.list({ status: 'published' }) : Promise.resolve([])), [scope]);
  const today = todayISO();
  const shown = useMemo(() => {
    const all = q.data ?? [];
    return view === 'upcoming' ? all.filter((e) => e.date >= today) : all.filter((e) => e.date < today).reverse();
  }, [q.data, view, today]);

  return (
    <>
      <PageHeader title="Events" subtitle={scope === 'owner' ? 'Events and notices across properties. Create, edit or cancel any event.' : 'Plan resident events, track expected attendance and update status.'}
        actions={<Button icon={<CalendarPlus className="size-4" />} onClick={() => { setEditing(null); setFormOpen(true); }}>Create event</Button>} />
      <div className={scope === 'owner' ? 'grid gap-5 xl:grid-cols-3' : ''}>
        <div className="xl:col-span-2">
          <FilterBar className="mb-4">
            <SegmentedControl label="Timeframe" value={view} onChange={setView} options={[{ value: 'upcoming', label: 'Upcoming' }, { value: 'past', label: 'Past' }]} />
            {scope === 'owner' && <FilterSelect label="Properties" value={property} onChange={setProperty} options={(props.data ?? []).map((p) => ({ value: p.id, label: p.name }))} />}
            <FilterSelect label="Statuses" value={status} onChange={setStatus} options={statusOptions('event')} />
          </FilterBar>
          <QueryBoundary query={q} skeleton={<div className="grid gap-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-32" />)}</div>}>
            {() => shown.length === 0 ? (
              <Card><EmptyState icon={<CalendarDays className="size-5" />} title={view === 'upcoming' ? 'No upcoming events' : 'No past events'} message="Events bring residents together — schedule one in a minute." action={<Button size="sm" onClick={() => { setEditing(null); setFormOpen(true); }}>Create event</Button>} /></Card>
            ) : <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">{shown.map((ev) => <EventCard key={ev.id} ev={ev} scope={scope} onEdit={() => { setEditing(ev); setFormOpen(true); }} />)}</div>}
          </QueryBoundary>
        </div>
        {scope === 'owner' && (
          <Card className="h-fit p-5">
            <CardHeader title="Recent notices" subtitle="Published by property managers" as="h2" />
            <ul className="mt-4 space-y-3">
              {(notices.data ?? []).slice(0, 6).map((n) => (
                <li key={n.id} className="flex gap-3">
                  <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-slate-wash text-slate-ink" aria-hidden><Megaphone className="size-3.5" /></span>
                  <div className="min-w-0"><p className="text-sm font-medium">{n.title}</p><p className="text-xs text-dust">{n.propertyName} · {formatDate(n.publishedAt)}</p></div>
                </li>
              ))}
              {notices.data?.length === 0 && <li className="text-sm text-dust">No notices published yet.</li>}
            </ul>
          </Card>
        )}
      </div>
      <EventForm open={formOpen} onClose={() => setFormOpen(false)} scope={scope} editing={editing} />
    </>
  );
}
