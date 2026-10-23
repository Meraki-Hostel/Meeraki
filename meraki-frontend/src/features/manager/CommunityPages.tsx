import { useEffect, useMemo, useState } from 'react';
import { Archive, Download, Megaphone, Pencil, Plus, Send } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { services } from '@/services';
import type { AnnouncementInput, AnnouncementView } from '@/services/interfaces';
import type { ActivityCategory, AnnouncementCategory, FeedbackCategory } from '@/types/domain';
import { useQuery } from '@/hooks/useQuery';
import { useMutation } from '@/hooks/useMutation';
import { useQueryParam } from '@/hooks/misc';
import { useConfirm } from '@/app/providers/ConfirmProvider';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardHeader, ProgressBar } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, RadioGroup, Select, Textarea } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { FilterBar, FilterSelect } from '@/components/ui/FilterBar';
import { Tabs, TabPanel } from '@/components/ui/Tabs';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Badge } from '@/components/ui/Badge';
import { Stars } from '@/components/ui/Stars';
import { CHART, ChartFrame } from '@/components/ui/Chart';
import { EmptyState, QueryBoundary, Skeleton } from '@/components/ui/States';
import { ActivityFeed } from '@/components/domain/ActivityFeed';
import { exportCSV } from '@/lib/export';
import { formatDate, formatDateTime, sentenceCase } from '@/lib/format';
import { cn } from '@/lib/cn';

/* ---------------- Announcements ---------------- */
const ACATS: AnnouncementCategory[] = ['general', 'maintenance', 'mess', 'event', 'urgent'];

function NoticeForm({ open, onClose, editing }: { open: boolean; onClose: () => void; editing: AnnouncementView | null }) {
  const rooms = useQuery(() => (open ? services.rooms.list() : Promise.resolve([])), [open]);
  const floors = Array.from(new Set((rooms.data ?? []).map((r) => String(r.floor)))).sort();
  const blank = { title: '', body: '', category: 'general' as AnnouncementCategory, type: 'all' as 'all' | 'floors' | 'rooms', floors: [] as string[], rooms: '' };
  const [f, setF] = useState(blank);
  useEffect(() => {
    if (!open) return;
    setF(editing ? { title: editing.title, body: editing.body, category: editing.category, type: editing.audience.type, floors: editing.audience.type === 'floors' ? editing.audience.values : [], rooms: editing.audience.type === 'rooms' ? editing.audience.values.join(', ') : '' } : blank);
  }, [open, editing?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const input = (): AnnouncementInput => ({ title: f.title, body: f.body, category: f.category, audience: { type: f.type, values: f.type === 'floors' ? f.floors : f.type === 'rooms' ? f.rooms.split(/[,\s]+/).filter(Boolean) : [] } });
  const save = useMutation((publish: boolean) => (editing ? services.announcements.update(editing.id, input()) : services.announcements.create(input(), publish)), {
    success: (a) => (a.status === 'published' && !editing ? 'Notice published. Targeted residents have been notified.' : editing ? 'Notice updated.' : 'Draft saved.'), onSuccess: onClose,
  });
  const e = save.fieldErrors;
  const roomNumbers = new Set((rooms.data ?? []).map((r) => r.number.toLowerCase()));
  const unknownRooms = f.type === 'rooms' ? f.rooms.split(/[,\s]+/).filter((r) => r && !roomNumbers.has(r.toLowerCase())) : [];
  return (
    <Modal open={open} onClose={onClose} size="lg" title={editing ? 'Edit notice' : 'New notice'}
      footer={editing ? <><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={save.pending} onClick={() => void save.run(false)}>Save changes</Button></>
        : <><Button variant="secondary" onClick={onClose}>Cancel</Button><Button variant="secondary" loading={save.pending} onClick={() => void save.run(false)}>Save draft</Button><Button icon={<Send className="size-4" />} loading={save.pending} onClick={() => void save.run(true)}>Publish now</Button></>}>
      <div className="space-y-4">
        <Input label="Title" required value={f.title} onChange={(ev) => setF({ ...f, title: ev.target.value })} error={e.title} placeholder="e.g. Water supply interruption on Tuesday" />
        <Select label="Category" value={f.category} onChange={(ev) => setF({ ...f, category: ev.target.value as AnnouncementCategory })} options={ACATS.map((c) => ({ value: c, label: sentenceCase(c) }))} />
        <Textarea label="Message" required rows={5} value={f.body} onChange={(ev) => setF({ ...f, body: ev.target.value })} error={e.body} />
        <RadioGroup label="Audience" name="aud" inline value={f.type} onChange={(v) => setF({ ...f, type: v })} error={e.audience}
          options={[{ value: 'all', label: 'All residents' }, { value: 'floors', label: 'Selected floors' }, { value: 'rooms', label: 'Selected rooms' }]} />
        {f.type === 'floors' && (
          <div className="flex flex-wrap gap-2" role="group" aria-label="Floors">
            {floors.map((fl) => (
              <button key={fl} type="button" aria-pressed={f.floors.includes(fl)} onClick={() => setF({ ...f, floors: f.floors.includes(fl) ? f.floors.filter((x) => x !== fl) : [...f.floors, fl] })}
                className={cn('rounded-full border px-3 py-1 text-sm', f.floors.includes(fl) ? 'border-clay-500 bg-clay-50 text-clay-800' : 'border-line')}>{fl === '0' ? 'Ground' : `Floor ${fl}`}</button>
            ))}
          </div>
        )}
        {f.type === 'rooms' && <Input label="Room numbers" value={f.rooms} onChange={(ev) => setF({ ...f, rooms: ev.target.value })} placeholder="e.g. 201, 204, 301" hint={unknownRooms.length ? `Not found at this property: ${unknownRooms.join(', ')}` : 'Separate with commas'} />}
      </div>
    </Modal>
  );
}

function NoticeCard({ a, onEdit }: { a: AnnouncementView; onEdit: () => void }) {
  const confirm = useConfirm();
  const publish = useMutation(() => services.announcements.publish(a.id), { success: 'Notice published.' });
  const archive = useMutation(() => services.announcements.archive(a.id), { success: 'Notice archived. Residents no longer see it.' });
  const audience = a.audience.type === 'all' ? 'All residents' : a.audience.type === 'floors' ? `Floor ${a.audience.values.join(', ')}` : `Rooms ${a.audience.values.join(', ')}`;
  return (
    <article className="surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-sans text-base font-semibold">{a.title}</h3>
          <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-dust"><Badge tone={a.category === 'urgent' ? 'brick' : 'neutral'} dot={false}>{sentenceCase(a.category)}</Badge>{audience} · {a.publishedAt ? `Published ${formatDateTime(a.publishedAt)}` : `Drafted ${formatDate(a.createdAt)}`}</p>
        </div>
        <StatusBadge kind="announcement" value={a.status} />
      </div>
      <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-bark">{a.body}</p>
      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-3">
        {a.status !== 'archived' && <Button size="sm" variant="ghost" icon={<Pencil className="size-3.5" />} onClick={onEdit}>Edit</Button>}
        {a.status === 'draft' && <Button size="sm" variant="soft" icon={<Send className="size-3.5" />} loading={publish.pending} onClick={() => void publish.run()}>Publish</Button>}
        {a.status !== 'archived' && <Button size="sm" variant="ghost" icon={<Archive className="size-3.5" />} onClick={async () => { if (await confirm({ title: 'Archive this notice?', message: 'It will be hidden from residents’ notice feed. You can still see it under Archived.', confirmLabel: 'Archive' })) void archive.run(); }}>Archive</Button>}
        {a.status === 'published' && <span className="ml-auto text-xs text-dust">Read by {a.readBy.length} resident{a.readBy.length === 1 ? '' : 's'}</span>}
      </div>
    </article>
  );
}

export function AnnouncementsPage() {
  const [tab, setTab] = useState<'published' | 'draft' | 'archived'>('published');
  const [newParam, setNewParam] = useQueryParam('new');
  const [editing, setEditing] = useState<AnnouncementView | null>(null);
  const q = useQuery(() => services.announcements.list(), []);
  const all = q.data ?? [];
  const shown = all.filter((a) => a.status === tab);
  const open = newParam === '1' || !!editing;
  return (
    <>
      <PageHeader title="Announcements" subtitle="Notices for all residents or selected floors and rooms. Published notices appear in the student notice feed." actions={<Button icon={<Plus className="size-4" />} onClick={() => setNewParam('1')}>New notice</Button>} />
      <Tabs label="Notice status" value={tab} onChange={setTab} items={(['published', 'draft', 'archived'] as const).map((s) => ({ value: s, label: s === 'draft' ? 'Drafts' : sentenceCase(s), count: all.filter((a) => a.status === s).length }))} />
      <TabPanel>
        <QueryBoundary query={q} skeleton={<div className="space-y-3">{[0, 1].map((i) => <Skeleton key={i} className="h-40" />)}</div>}>
          {() => shown.length === 0 ? <Card><EmptyState icon={<Megaphone className="size-5" />} title={`No ${tab === 'draft' ? 'drafts' : `${tab} notices`}`} message="Keep residents informed about water, mess timings, events and safety." action={<Button size="sm" onClick={() => setNewParam('1')}>New notice</Button>} /></Card>
            : <div className="grid gap-4 lg:grid-cols-2">{shown.map((a) => <NoticeCard key={a.id} a={a} onEdit={() => setEditing(a)} />)}</div>}
        </QueryBoundary>
      </TabPanel>
      <NoticeForm open={open} editing={editing} onClose={() => { setEditing(null); setNewParam(null); }} />
    </>
  );
}

/* ---------------- Feedback ---------------- */
const FCATS: FeedbackCategory[] = ['food', 'cleanliness', 'staff', 'facilities', 'security', 'internet', 'other'];

export function FeedbackPage() {
  const [cat, setCat] = useState('');
  const list = useQuery(() => services.feedback.list({ category: (cat || undefined) as FeedbackCategory | undefined }), [cat]);
  const sum = useQuery(() => services.feedback.summary(), []);
  const s = sum.data;
  return (
    <>
      <PageHeader title="Feedback" subtitle="What residents say, and where satisfaction is lowest."
        actions={<Button variant="secondary" icon={<Download className="size-4" />} disabled={!list.data?.length} onClick={() => exportCSV('feedback', list.data ?? [], [{ header: 'Date', value: (f) => f.createdAt }, { header: 'Resident', value: (f) => f.studentName }, { header: 'Category', value: (f) => f.category }, { header: 'Rating', value: (f) => f.rating }, { header: 'Comment', value: (f) => f.comment }])}>Export CSV</Button>} />
      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="p-5">
          <CardHeader title="Overall satisfaction" />
          {s ? <>
            <p className="mt-3 font-display text-5xl font-semibold">{s.average.toFixed(1)}<span className="text-xl text-dust"> / 5</span></p>
            <div className="mt-1"><Stars value={s.average} size="md" /></div>
            <p className="mt-1 text-sm text-dust">{s.total} responses</p>
            <ul className="mt-4 space-y-1.5">{s.distribution.map((d) => (
              <li key={d.rating} className="grid grid-cols-[28px_1fr_28px] items-center gap-2 text-xs"><span>{d.rating}★</span><ProgressBar value={s.total ? (d.count / s.total) * 100 : 0} label={`${d.rating} star share`} tone="amber" /><span className="text-right tabular-nums text-dust">{d.count}</span></li>
            ))}</ul>
          </> : <Skeleton className="mt-3 h-40" />}
        </Card>
        <Card className="p-5 lg:col-span-2">
          <CardHeader title="Average rating by category" subtitle="Lowest first — start here" />
          {s && (
            <ChartFrame summary={s.byCategory.map((c) => `${c.category} ${c.average} from ${c.count}`).join(', ')} height={230}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={s.byCategory.map((c) => ({ ...c, label: sentenceCase(c.category) }))} margin={{ top: 16, right: 4, left: -24, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke={CHART.grid} strokeDasharray="3 3" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: CHART.text, fontSize: 12 }} />
                  <YAxis domain={[0, 5]} ticks={[0, 1, 2, 3, 4, 5]} tickLine={false} axisLine={false} tick={{ fill: CHART.text, fontSize: 11 }} />
                  <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} formatter={(v: number) => [`${v} / 5`, 'Average']} />
                  <Bar dataKey="average" fill={CHART.ink} radius={[6, 6, 0, 0]} barSize={36} />
                </BarChart>
              </ResponsiveContainer>
            </ChartFrame>
          )}
        </Card>
      </div>
      <Card className="mt-5 p-5">
        <FilterBar className="mb-3"><FilterSelect label="Categories" value={cat} onChange={setCat} options={FCATS.map((c) => ({ value: c, label: sentenceCase(c) }))} /></FilterBar>
        <QueryBoundary query={list} skeleton={<Skeleton className="h-48" />}>
          {(items) => items.length === 0 ? <EmptyState title="No feedback yet" /> : (
            <ul className="divide-y divide-line/70">{items.map((f) => (
              <li key={f.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-start sm:gap-4">
                <div className="w-44 shrink-0"><Stars value={f.rating} /><p className="text-xs text-dust">{formatDate(f.createdAt)}</p></div>
                <div className="flex-1"><p className="text-sm">{f.comment}</p><p className="mt-0.5 text-xs text-dust">{f.studentName} · {sentenceCase(f.category)}</p></div>
              </li>
            ))}</ul>
          )}
        </QueryBoundary>
      </Card>
    </>
  );
}

/* ---------------- Activity ---------------- */
const ACT: ActivityCategory[] = ['student', 'payment', 'complaint', 'leave', 'visitor', 'maintenance', 'inventory', 'announcement', 'event', 'room', 'staff', 'feedback'];

export function ActivityPage() {
  const [cat, setCat] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const q = useQuery(() => services.activity.list({ category: (cat || undefined) as ActivityCategory | undefined, from: from || undefined, to: to || undefined }), [cat, from, to]);
  const [limit, setLimit] = useState(25);
  const items = useMemo(() => (q.data ?? []).slice(0, limit), [q.data, limit]);
  return (
    <>
      <PageHeader title="Activity log" subtitle="Who did what, and when — for audits and handovers."
        actions={<Button variant="secondary" icon={<Download className="size-4" />} disabled={!q.data?.length} onClick={() => exportCSV('activity', q.data ?? [], [{ header: 'Time', value: (a) => a.createdAt }, { header: 'Actor', value: (a) => a.actorName }, { header: 'Role', value: (a) => a.actorRole }, { header: 'Category', value: (a) => a.category }, { header: 'Message', value: (a) => a.message }])}>Export CSV</Button>} />
      <Card className="p-5">
        <FilterBar className="mb-5">
          <FilterSelect label="Categories" value={cat} onChange={setCat} options={ACT.map((c) => ({ value: c, label: sentenceCase(c) }))} />
          <Input label="From date" hideLabel type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
          <Input label="To date" hideLabel type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
          {(cat || from || to) && <Button size="sm" variant="ghost" onClick={() => { setCat(''); setFrom(''); setTo(''); }}>Clear filters</Button>}
        </FilterBar>
        <QueryBoundary query={q} skeleton={<Skeleton className="h-64" />}>
          {(all) => <>
            <ActivityFeed items={items} />
            {all.length > limit && <div className="mt-2 text-center"><Button variant="secondary" size="sm" onClick={() => setLimit((l) => l + 25)}>Load more ({all.length - limit} remaining)</Button></div>}
          </>}
        </QueryBoundary>
      </Card>
    </>
  );
}
