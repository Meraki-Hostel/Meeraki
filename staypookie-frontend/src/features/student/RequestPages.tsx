import { useEffect, useState, type FormEvent } from 'react';
import { Paperclip, Plus, X } from 'lucide-react';
import { services } from '@/services';
import type { ComplaintView } from '@/services/interfaces';
import type { ComplaintCategory, Priority } from '@/types/domain';
import { useQuery } from '@/hooks/useQuery';
import { useMutation } from '@/hooks/useMutation';
import { useQueryParam } from '@/hooks/misc';
import { useConfirm } from '@/app/providers/ConfirmProvider';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button, IconButton } from '@/components/ui/Button';
import { FilePicker, Input, Select, Textarea } from '@/components/ui/Field';
import { Drawer, Modal } from '@/components/ui/Modal';
import { StatusBadge, statusOptions } from '@/components/ui/StatusBadge';
import { EmptyState, QueryBoundary, Skeleton } from '@/components/ui/States';
import { ComplaintTimeline } from '@/components/domain/ComplaintTimeline';
import { addDays, todayISO } from '@/lib/clock';
import { formatClock, formatDate, formatDateTime, sentenceCase } from '@/lib/format';

const CATS: ComplaintCategory[] = ['electrical', 'plumbing', 'cleaning', 'internet', 'food', 'furniture', 'security', 'other'];

/* ---------------- Complaints ---------------- */
function NewComplaintModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (id: string) => void }) {
  const blank = { category: 'electrical' as ComplaintCategory, title: '', description: '', priority: 'medium' as Priority, attachments: [] as string[] };
  const [f, setF] = useState(blank);
  const [fileErr, setFileErr] = useState<string>();
  useEffect(() => { if (open) { setF(blank); setFileErr(undefined); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const m = useMutation(services.complaints.create, { success: (c) => `Complaint ${c.ticketNo} raised. The hostel office has been notified.`, onSuccess: (c) => { onClose(); onCreated(c.id); } });
  const e = m.fieldErrors;
  const pick = (files: File[]) => {
    const bad = files.find((x) => x.size > 5 * 1024 * 1024);
    if (bad) { setFileErr(`${bad.name} is larger than 5 MB`); return; }
    setFileErr(undefined);
    setF((x) => ({ ...x, attachments: [...x.attachments, ...files.map((y) => y.name)].slice(0, 3) }));
  };
  return (
    <Modal open={open} onClose={onClose} size="lg" title="Raise a complaint" description="Describe what’s wrong. You’ll see every update on this page."
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={m.pending} onClick={() => void m.run(f)}>Submit complaint</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Select label="Category" value={f.category} onChange={(ev) => setF({ ...f, category: ev.target.value as ComplaintCategory })} options={CATS.map((c) => ({ value: c, label: sentenceCase(c) }))} />
        <Select label="How urgent is it?" value={f.priority} onChange={(ev) => setF({ ...f, priority: ev.target.value as Priority })} options={statusOptions('priority')} hint="Use Urgent only for safety issues" />
        <Input className="sm:col-span-2" label="Title" required maxLength={80} value={f.title} onChange={(ev) => setF({ ...f, title: ev.target.value })} error={e.title} placeholder="e.g. Tap leaking in bathroom" />
        <Textarea className="sm:col-span-2" label="Details" required rows={4} value={f.description} onChange={(ev) => setF({ ...f, description: ev.target.value })} error={e.description} placeholder="When did it start? Where exactly?" />
        <div className="sm:col-span-2">
          <FilePicker label="Add photos or a short video" hint="Up to 3 files, 5 MB each. Demo: only file names are saved." accept="image/*,video/*" multiple onPick={pick} error={fileErr} disabled={f.attachments.length >= 3} />
          {f.attachments.length > 0 && <ul className="mt-2 flex flex-wrap gap-2">{f.attachments.map((a, i) => (
            <li key={`${a}-${i}`} className="inline-flex items-center gap-1 rounded-lg border border-line bg-white px-2 py-1 text-xs"><Paperclip className="size-3" aria-hidden />{a}
              <button type="button" aria-label={`Remove ${a}`} onClick={() => setF({ ...f, attachments: f.attachments.filter((_, j) => j !== i) })} className="text-dust hover:text-brick"><X className="size-3" /></button></li>
          ))}</ul>}
        </div>
      </div>
    </Modal>
  );
}

function StudentComplaintDrawer({ c, onClose }: { c: ComplaintView | null; onClose: () => void }) {
  const [body, setBody] = useState('');
  useEffect(() => setBody(''), [c?.id]);
  const m = useMutation((id: string) => services.complaints.addComment(id, body, false), { success: 'Reply sent to the hostel office.', onSuccess: () => setBody('') });
  if (!c) return null;
  return (
    <Drawer open onClose={onClose} title={c.title} description={<span className="flex items-center gap-2">{c.ticketNo} <StatusBadge kind="complaint" value={c.status} /> <StatusBadge kind="priority" value={c.priority} /></span>}>
      <p className="whitespace-pre-line text-sm text-espresso">{c.description}</p>
      <p className="mt-2 text-xs text-dust">{sentenceCase(c.category)} · raised {formatDateTime(c.createdAt)}{c.assigneeName ? ` · assigned to ${c.assigneeName}` : ''}</p>
      {c.attachments.length > 0 && <ul className="mt-2 flex flex-wrap gap-2">{c.attachments.map((a) => <li key={a} className="inline-flex items-center gap-1 rounded-lg border border-line bg-white px-2 py-1 text-xs"><Paperclip className="size-3" aria-hidden />{a}</li>)}</ul>}
      <h3 className="mb-3 mt-6 text-base font-semibold">Updates</h3>
      <ComplaintTimeline complaint={c} />
      {c.status !== 'closed' ? (
        <div className="mt-5 rounded-2xl border border-line bg-white/60 p-3">
          <Textarea label="Reply to the office" rows={2} value={body} onChange={(e) => setBody(e.target.value)} error={m.fieldErrors.body} placeholder="Add details or confirm the fix" />
          <div className="mt-2 flex justify-end"><Button size="sm" disabled={!body.trim()} loading={m.pending} onClick={() => void m.run(c.id)}>Send reply</Button></div>
        </div>
      ) : <p className="mt-5 text-sm text-dust">This complaint is closed. Raise a new one if the issue returns.</p>}
    </Drawer>
  );
}

export function StudentComplaintsPage() {
  const q = useQuery(() => services.complaints.list(), []);
  const [newParam, setNewParam] = useQueryParam('new');
  const [openId, setOpenId] = useQueryParam('id');
  const [filter, setFilter] = useState<'active' | 'all'>('active');
  const list = (q.data ?? []).filter((c) => filter === 'all' || c.status === 'open' || c.status === 'in_progress');
  const opened = (q.data ?? []).find((c) => c.id === openId) ?? null;
  return (
    <>
      <PageHeader title="My complaints" subtitle="Report problems in your room or the hostel and follow progress." actions={<Button icon={<Plus className="size-4" />} onClick={() => setNewParam('1')}>Raise complaint</Button>} />
      <div className="mb-4 flex gap-2" role="group" aria-label="Filter">
        {(['active', 'all'] as const).map((v) => <Button key={v} size="sm" variant={filter === v ? 'soft' : 'ghost'} aria-pressed={filter === v} onClick={() => setFilter(v)}>{v === 'active' ? 'Open & in progress' : 'All complaints'}</Button>)}
      </div>
      <QueryBoundary query={q} skeleton={<Skeleton className="h-48" />}>
        {() => list.length === 0 ? <Card><EmptyState title={filter === 'active' ? 'Nothing open right now' : 'No complaints yet'} message="If something needs fixing, raise it — the office gets notified straight away." action={<Button size="sm" onClick={() => setNewParam('1')}>Raise complaint</Button>} /></Card> : (
          <ul className="grid gap-3 md:grid-cols-2">
            {list.map((c) => (
              <li key={c.id}>
                <button type="button" onClick={() => setOpenId(c.id)} className="surface block w-full p-4 text-left hover:border-line-strong">
                  <div className="flex items-start justify-between gap-2"><p className="font-semibold">{c.title}</p><StatusBadge kind="complaint" value={c.status} /></div>
                  <p className="mt-1 text-xs text-dust">{c.ticketNo} · {sentenceCase(c.category)} · updated {formatDate(c.updatedAt)}</p>
                  {c.comments.length > 0 && <p className="mt-2 line-clamp-2 text-sm text-bark">“{c.comments[c.comments.length - 1]!.body}”</p>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </QueryBoundary>
      <NewComplaintModal open={newParam === '1'} onClose={() => setNewParam(null)} onCreated={(id) => setOpenId(id)} />
      <StudentComplaintDrawer c={opened} onClose={() => setOpenId(null)} />
    </>
  );
}

/* ---------------- Leave ---------------- */
export function StudentLeavePage() {
  const me = useQuery(() => services.students.me(), []);
  const q = useQuery(() => services.leave.list(), []);
  const confirm = useConfirm();
  const blank = () => ({ from: addDays(todayISO(), 1), to: addDays(todayISO(), 3), destination: '', contactPhone: me.data?.student.guardianPhone ?? '', reason: '' });
  const [f, setF] = useState(blank);
  useEffect(() => { if (me.data) setF((x) => ({ ...x, contactPhone: x.contactPhone || me.data!.student.guardianPhone })); }, [me.data]);
  const create = useMutation(services.leave.create, { success: 'Leave request sent. You’ll be notified when it’s decided.', onSuccess: () => setF(blank()) });
  const cancel = useMutation(services.leave.cancel, { success: 'Leave request cancelled.' });
  const e = create.fieldErrors;
  const submit = (ev: FormEvent) => { ev.preventDefault(); void create.run(f); };
  return (
    <>
      <PageHeader title="Leave" subtitle="Tell the warden when you’ll be away. Approval is usually within a day." />
      <div className="grid gap-5 lg:grid-cols-5">
        <Card className="p-5 lg:col-span-2">
          <CardHeader title="Request leave" />
          <form onSubmit={submit} noValidate className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            <Input label="Leaving on" type="date" required min={todayISO()} value={f.from} onChange={(ev) => setF({ ...f, from: ev.target.value })} error={e.from} />
            <Input label="Returning on" type="date" required min={f.from} value={f.to} onChange={(ev) => setF({ ...f, to: ev.target.value })} error={e.to} />
            <Input label="Destination" required value={f.destination} onChange={(ev) => setF({ ...f, destination: ev.target.value })} error={e.destination} placeholder="e.g. Kanpur (home)" />
            <Input label="Contact while away" required inputMode="tel" value={f.contactPhone} onChange={(ev) => setF({ ...f, contactPhone: ev.target.value })} error={e.contactPhone} />
            <Textarea className="sm:col-span-2 lg:col-span-1 xl:col-span-2" rows={3} label="Reason" required value={f.reason} onChange={(ev) => setF({ ...f, reason: ev.target.value })} error={e.reason} />
            <Button type="submit" className="sm:col-span-2 lg:col-span-1 xl:col-span-2" loading={create.pending}>Send request</Button>
          </form>
        </Card>
        <Card className="p-5 lg:col-span-3">
          <CardHeader title="My requests" />
          <QueryBoundary query={q} skeleton={<Skeleton className="mt-4 h-40" />}>
            {(list) => list.length === 0 ? <EmptyState title="No leave requests yet" /> : (
              <ul className="mt-3 divide-y divide-line/70">{list.map((l) => (
                <li key={l.id} className="flex flex-wrap items-start gap-3 py-3">
                  <div className="min-w-0 flex-1"><p className="text-sm font-medium">{formatDate(l.from)} – {formatDate(l.to)} · {l.destination}</p><p className="text-xs text-dust">{l.reason}</p>
                    {l.decisionReason && <p className="mt-1 text-xs text-bark">Warden: “{l.decisionReason}”</p>}</div>
                  <StatusBadge kind="leave" value={l.status} />
                  {l.status === 'pending' && <Button size="sm" variant="ghost" onClick={async () => { if (await confirm({ title: 'Cancel this leave request?', message: `${formatDate(l.from)} – ${formatDate(l.to)}. You can submit a new one any time.`, confirmLabel: 'Cancel request', cancelLabel: 'Keep it', tone: 'danger' })) void cancel.run(l.id); }}>Cancel</Button>}
                </li>
              ))}</ul>
            )}
          </QueryBoundary>
        </Card>
      </div>
    </>
  );
}

/* ---------------- Visitors ---------------- */
export function StudentVisitorsPage() {
  const q = useQuery(() => services.visitors.list(), []);
  const confirm = useConfirm();
  const blank = { visitorName: '', visitorPhone: '', relation: 'Father', visitDate: todayISO(), visitTime: '16:00', purpose: '' };
  const [f, setF] = useState(blank);
  const create = useMutation(services.visitors.create, { success: 'Visit requested. You’ll be notified once the warden approves.', onSuccess: () => setF(blank) });
  const cancel = useMutation(services.visitors.cancel, { success: 'Visit cancelled.' });
  const e = create.fieldErrors;
  return (
    <>
      <PageHeader title="Visitors" subtitle="Request a visit in advance. Visiting hours are 8 am to 7 pm." />
      <div className="grid gap-5 lg:grid-cols-5">
        <Card className="p-5 lg:col-span-2">
          <CardHeader title="Request a visit" />
          <form onSubmit={(ev) => { ev.preventDefault(); void create.run(f); }} noValidate className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            <Input label="Visitor name" required value={f.visitorName} onChange={(ev) => setF({ ...f, visitorName: ev.target.value })} error={e.visitorName} />
            <Input label="Visitor phone" required inputMode="tel" value={f.visitorPhone} onChange={(ev) => setF({ ...f, visitorPhone: ev.target.value })} error={e.visitorPhone} />
            <Select label="Relation" value={f.relation} onChange={(ev) => setF({ ...f, relation: ev.target.value })} error={e.relation} options={['Father', 'Mother', 'Brother', 'Sister', 'Guardian', 'Relative', 'Friend'].map((r) => ({ value: r, label: r }))} />
            <Input label="Date" type="date" required min={todayISO()} max={addDays(todayISO(), 30)} value={f.visitDate} onChange={(ev) => setF({ ...f, visitDate: ev.target.value })} error={e.visitDate} />
            <Input label="Time" type="time" required min="08:00" max="19:00" value={f.visitTime} onChange={(ev) => setF({ ...f, visitTime: ev.target.value })} error={e.visitTime} />
            <Input label="Purpose" value={f.purpose} onChange={(ev) => setF({ ...f, purpose: ev.target.value })} placeholder="Optional" />
            <Button type="submit" className="sm:col-span-2 lg:col-span-1 xl:col-span-2" loading={create.pending}>Request visit</Button>
          </form>
        </Card>
        <Card className="p-5 lg:col-span-3">
          <CardHeader title="My visitors" />
          <QueryBoundary query={q} skeleton={<Skeleton className="mt-4 h-40" />}>
            {(list) => list.length === 0 ? <EmptyState title="No visits yet" /> : (
              <ul className="mt-3 divide-y divide-line/70">{list.map((v) => (
                <li key={v.id} className="flex flex-wrap items-start gap-3 py-3">
                  <div className="min-w-0 flex-1"><p className="text-sm font-medium">{v.visitorName} <span className="font-normal text-dust">({v.relation})</span></p>
                    <p className="text-xs text-dust">{formatDate(v.visitDate)}, {formatClock(v.visitTime)}{v.checkInAt ? ` · in ${formatDateTime(v.checkInAt)}` : ''}{v.checkOutAt ? ` · out ${formatDateTime(v.checkOutAt)}` : ''}</p>
                    {v.decisionReason && <p className="mt-1 text-xs text-bark">Warden: “{v.decisionReason}”</p>}</div>
                  <StatusBadge kind="visitor" value={v.status} />
                  {(v.status === 'pending' || v.status === 'approved') && <IconButton size="sm" label={`Cancel visit by ${v.visitorName}`} onClick={async () => { if (await confirm({ title: 'Cancel this visit?', message: `${v.visitorName} on ${formatDate(v.visitDate)}.`, confirmLabel: 'Cancel visit', cancelLabel: 'Keep it', tone: 'danger' })) void cancel.run(v.id); }}><X className="size-4" /></IconButton>}
                </li>
              ))}</ul>
            )}
          </QueryBoundary>
        </Card>
      </div>
    </>
  );
}
