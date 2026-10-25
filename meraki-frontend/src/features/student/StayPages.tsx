import { useState } from 'react';
import { CheckCheck, FileText, MapPin, Phone, ShieldAlert, Siren, Trash2 } from 'lucide-react';
import { services } from '@/services';
import type { AnnouncementCategory, DocumentRecord, Feedback, FeedbackCategory } from '@/types/domain';
import { useQuery } from '@/hooks/useQuery';
import { useMutation } from '@/hooks/useMutation';
import { useConfirm } from '@/app/providers/ConfirmProvider';
import { useToast } from '@/app/providers/ToastProvider';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardHeader, ProgressBar } from '@/components/ui/Card';
import { Button, IconButton } from '@/components/ui/Button';
import { Checkbox, FilePicker, Select, Textarea } from '@/components/ui/Field';
import { FilterSelect } from '@/components/ui/FilterBar';
import { SegmentedControl } from '@/components/ui/Tabs';
import { Badge } from '@/components/ui/Badge';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { StarInput, Stars } from '@/components/ui/Stars';
import { EmptyState, PageSkeleton, QueryBoundary, Skeleton } from '@/components/ui/States';
import { DOC_LABEL } from '@/features/manager/StudentProfilePage';
import { formatDate, formatDateTime, formatPhone, sentenceCase } from '@/lib/format';
import { cn } from '@/lib/cn';

/* ---------------- Notices ---------------- */
export function StudentNoticesPage() {
  const q = useQuery(() => services.announcements.list(), []);
  const [view, setView] = useState<'all' | 'unread'>('all');
  const [cat, setCat] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const items = (q.data ?? []).filter((n) => (view === 'all' || !n.isRead) && (!cat || n.category === cat));
  const unread = (q.data ?? []).filter((n) => !n.isRead).length;
  const toggle = (id: string, isRead?: boolean) => { setOpen(open === id ? null : id); if (!isRead) void services.announcements.markRead(id, true); };
  return (
    <>
      <PageHeader title="Notices" subtitle="Announcements from your hostel office." actions={<Button variant="secondary" icon={<CheckCheck className="size-4" />} disabled={!unread} onClick={() => void services.announcements.markAllRead()}>Mark all read</Button>} />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SegmentedControl label="Show" value={view} onChange={setView} options={[{ value: 'all', label: 'All' }, { value: 'unread', label: `Unread (${unread})` }]} />
        <FilterSelect label="Categories" value={cat} onChange={setCat} options={(['general', 'maintenance', 'mess', 'event', 'urgent'] as AnnouncementCategory[]).map((c) => ({ value: c, label: sentenceCase(c) }))} />
      </div>
      <QueryBoundary query={q} skeleton={<div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-20" />)}</div>}>
        {() => items.length === 0 ? <Card><EmptyState title={view === 'unread' ? 'You’re all caught up' : 'No notices'} message="New notices from the office will appear here." /></Card> : (
          <ul className="space-y-3">{items.map((n) => (
            <li key={n.id} className={cn('surface overflow-hidden', !n.isRead && 'border-clay-200')}>
              <button type="button" onClick={() => toggle(n.id, n.isRead)} aria-expanded={open === n.id} className="flex w-full items-start gap-3 p-4 text-left">
                <span className={cn('mt-2 size-2 shrink-0 rounded-full', n.isRead ? 'bg-line-strong' : 'bg-clay-600')} aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2"><span className="font-semibold">{n.title}</span>{n.category === 'urgent' ? <Badge tone="brick">Urgent</Badge> : <Badge tone="neutral" dot={false}>{sentenceCase(n.category)}</Badge>}{!n.isRead && <span className="sr-only">Unread</span>}</span>
                  <span className="mt-0.5 block text-xs text-dust">{n.author} · {formatDateTime(n.publishedAt)}</span>
                  {open !== n.id && <span className="mt-1 line-clamp-1 block text-sm text-bark">{n.body}</span>}
                </span>
              </button>
              {open === n.id && (
                <div className="border-t border-line px-4 pb-4 pt-3 sm:pl-9">
                  <p className="whitespace-pre-line text-sm leading-relaxed text-espresso">{n.body}</p>
                  <button type="button" className="mt-3 text-xs font-medium text-clay-700 hover:underline" onClick={() => void services.announcements.markRead(n.id, false)}>Mark as unread</button>
                </div>
              )}
            </li>
          ))}</ul>
        )}
      </QueryBoundary>
    </>
  );
}

/* ---------------- Documents ---------------- */
function DocRow({ d }: { d: DocumentRecord }) {
  const confirm = useConfirm();
  const [err, setErr] = useState<string>();
  const up = useMutation((file: File) => services.documents.upload(d.id, { name: file.name, sizeKb: Math.max(1, Math.round(file.size / 1024)) }), { success: 'Uploaded. The office will review it soon.', toastErrors: false });
  const rm = useMutation(() => services.documents.remove(d.id), { success: 'File removed.' });
  const canUpload = d.status === 'missing' || d.status === 'rejected';
  return (
    <li className="py-4">
      <div className="flex flex-wrap items-start gap-3">
        <FileText className="mt-0.5 size-5 text-dust" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{DOC_LABEL[d.type]}</p>
          <p className="text-xs text-dust">{d.fileName ? `${d.fileName} · ${d.fileSizeKb} KB · ${formatDate(d.uploadedAt)}` : 'Not uploaded yet'}</p>
          {d.status === 'rejected' && d.note && <p className="mt-1 text-xs font-medium text-brick">{d.note}</p>}
        </div>
        <StatusBadge kind="document" value={d.status} />
        {d.status === 'uploaded' && <IconButton size="sm" label={`Remove ${DOC_LABEL[d.type]}`} onClick={async () => { if (await confirm({ title: 'Remove this file?', message: 'You’ll need to upload it again for verification.', confirmLabel: 'Remove file', tone: 'danger' })) void rm.run(); }}><Trash2 className="size-4" /></IconButton>}
      </div>
      {canUpload && (
        <div className="mt-3 sm:pl-8">
          <FilePicker label={up.pending ? 'Uploading…' : d.status === 'rejected' ? 'Upload a new copy' : 'Choose a file or drop it here'} hint="PDF, JPG or PNG up to 5 MB" accept=".pdf,.jpg,.jpeg,.png" disabled={up.pending}
            error={err ?? up.fieldErrors.file ?? (up.error && !up.fieldErrors.file ? up.error : undefined)}
            onPick={(files) => { setErr(undefined); if (files[0]) void up.run(files[0]); }} />
        </div>
      )}
    </li>
  );
}

export function StudentDocumentsPage() {
  const q = useQuery(() => services.documents.mine(), []);
  const docs = q.data ?? [];
  const verified = docs.filter((d) => d.status === 'verified').length;
  return (
    <>
      <PageHeader title="Documents" subtitle="Upload what the office needs for your stay. Files stay on this device — demo mode stores names only." />
      <Card className="p-5">
        {!q.data ? <Skeleton className="h-64" /> : (
          <>
            <div className="mb-2 flex items-center justify-between text-sm"><span>{verified} of {docs.length} verified</span><span className="text-dust">{docs.filter((d) => d.status === 'missing' || d.status === 'rejected').length} need action</span></div>
            <ProgressBar value={docs.length ? (verified / docs.length) * 100 : 0} label="Documents verified" tone="moss" />
            <ul className="mt-2 divide-y divide-line/70">{docs.map((d) => <DocRow key={d.id} d={d} />)}</ul>
          </>
        )}
      </Card>
    </>
  );
}

/* ---------------- Feedback ---------------- */
export function StudentFeedbackPage() {
  const q = useQuery(() => services.feedback.mine(), []);
  const [rating, setRating] = useState<Feedback['rating'] | 0>(0);
  const [category, setCategory] = useState<FeedbackCategory>('food');
  const [comment, setComment] = useState('');
  const [anonymous, setAnonymous] = useState(false);
  const m = useMutation(services.feedback.submit, { success: 'Thanks — your feedback reached the hostel office.', onSuccess: () => { setRating(0); setComment(''); setAnonymous(false); } });
  return (
    <>
      <PageHeader title="Feedback" subtitle="Tell the office what’s working and what isn’t." />
      <div className="grid gap-5 lg:grid-cols-5">
        <Card className="p-5 lg:col-span-2">
          <CardHeader title="Share feedback" />
          <form className="mt-4 space-y-4" noValidate onSubmit={(e) => { e.preventDefault(); void m.run({ rating: (rating || 0) as Feedback['rating'], category, comment, anonymous }); }}>
            <StarInput value={rating} onChange={setRating} error={m.fieldErrors.rating} />
            <Select label="About" value={category} onChange={(e) => setCategory(e.target.value as FeedbackCategory)} options={(['food', 'cleanliness', 'staff', 'facilities', 'security', 'internet', 'other'] as FeedbackCategory[]).map((c) => ({ value: c, label: sentenceCase(c) }))} />
            <Textarea label="Comments" required rows={4} value={comment} onChange={(e) => setComment(e.target.value)} error={m.fieldErrors.comment} />
            <Checkbox label="Submit anonymously" description="Your name is hidden from staff" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} />
            <Button type="submit" className="w-full" loading={m.pending}>Submit feedback</Button>
          </form>
        </Card>
        <Card className="p-5 lg:col-span-3">
          <CardHeader title="Your past feedback" />
          <QueryBoundary query={q} skeleton={<Skeleton className="mt-4 h-40" />}>
            {(list) => list.length === 0 ? <EmptyState title="Nothing submitted yet" /> : (
              <ul className="mt-3 divide-y divide-line/70">{list.map((f) => (
                <li key={f.id} className="py-3"><div className="flex items-center gap-2"><Stars value={f.rating} /><span className="text-xs text-dust">{sentenceCase(f.category)} · {formatDate(f.createdAt)}{f.anonymous ? ' · anonymous' : ''}</span></div><p className="mt-1 text-sm">{f.comment}</p></li>
              ))}</ul>
            )}
          </QueryBoundary>
        </Card>
      </div>
    </>
  );
}

/* ---------------- Emergency ---------------- */
const NATIONAL = [['Police / emergency', '112'], ['Ambulance', '108'], ['Fire', '101'], ['Women helpline', '1091']];
export function StudentEmergencyPage() {
  const me = useQuery(() => services.students.me(), []);
  const prop = useQuery(() => (me.data ? services.properties.get(me.data.student.propertyId) : Promise.resolve(null)), [me.data?.student.propertyId]);
  const confirm = useConfirm();
  const toast = useToast();
  if (!me.data || !prop.data) return <PageSkeleton />;
  const s = me.data.student;
  const p = prop.data;
  const report = async () => {
    if (await confirm({ title: 'Alert the hostel office?', message: <>In the live product this would alert the warden and security with your room number. <strong>This demo does not send any alert.</strong> For a real emergency, call 112 now.</>, confirmLabel: 'Send alert (demo)', tone: 'danger' }))
      toast.info('Demo only: no alert was sent. In a real emergency call 112 or the front desk.', 'Emergency alert simulated');
  };
  return (
    <>
      <PageHeader title="Emergency" subtitle="Who to call and what to do. Save these numbers on your phone." />
      <Card className="mb-5 flex flex-col items-start gap-4 border-brick/30 bg-brick-wash/40 p-5 sm:flex-row sm:items-center">
        <Siren className="size-8 text-brick" aria-hidden />
        <div className="flex-1"><h2 className="text-xl font-semibold">In danger right now?</h2><p className="text-sm text-bark">Call <a href="tel:112" className="font-semibold underline">112</a> first, then alert the front desk.</p></div>
        <Button variant="danger" size="lg" icon={<ShieldAlert className="size-5" />} onClick={() => void report()}>Report an emergency</Button>
      </Card>
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        <Card className="p-5">
          <CardHeader title="Your hostel" />
          <ul className="mt-4 space-y-3 text-sm">
            <li className="flex gap-2"><MapPin className="mt-0.5 size-4 text-clay-600" aria-hidden /><span><strong>{p.name}</strong><br />{p.address}, {p.city} {p.pincode}</span></li>
            <li className="flex gap-2"><Phone className="mt-0.5 size-4 text-clay-600" aria-hidden /><span>Front desk (24×7): <a className="font-medium text-clay-700 underline" href={`tel:+91${p.phone}`}>{formatPhone(p.phone)}</a></span></li>
            <li className="flex gap-2"><Phone className="mt-0.5 size-4 text-clay-600" aria-hidden /><span>Manager: {p.stats.managerName ?? 'Front desk'}</span></li>
            <li className="text-xs text-dust">Your room: {s.roomNumber ? `Room ${s.roomNumber}, Bed ${s.bedLabel}` : 'not allotted'} · Blood group {s.bloodGroup}</li>
          </ul>
        </Card>
        <Card className="p-5">
          <CardHeader title="National helplines" />
          <ul className="mt-4 divide-y divide-line/70">{NATIONAL.map(([l, n]) => <li key={n} className="flex items-center justify-between py-2 text-sm"><span>{l}</span><a href={`tel:${n}`} className="font-display text-lg font-semibold text-clay-700">{n}</a></li>)}</ul>
        </Card>
        <Card className="p-5">
          <CardHeader title="Your emergency contacts" />
          <ul className="mt-4 space-y-3 text-sm">
            <li><p className="font-medium">{s.emergencyName}</p><a className="text-clay-700 underline" href={`tel:+91${s.emergencyPhone}`}>{formatPhone(s.emergencyPhone)}</a></li>
            <li><p className="font-medium">{s.guardianName} <span className="font-normal text-dust">({s.guardianRelation})</span></p><a className="text-clay-700 underline" href={`tel:+91${s.guardianPhone}`}>{formatPhone(s.guardianPhone)}</a></li>
          </ul>
        </Card>
        <Card className="p-5 md:col-span-2 xl:col-span-3">
          <CardHeader title="Safety basics" />
          <ul className="mt-3 grid gap-x-8 gap-y-2 text-sm text-bark sm:grid-cols-2">
            <li>Fire: leave by the nearest staircase — never the lift. Assemble at the main gate.</li>
            <li>Medical: tell the warden immediately; first-aid kits are at reception and each floor landing.</li>
            <li>Power cut at night: stay in your room; backup lights cover corridors and stairs.</li>
            <li>Lost key or ID: report at the front desk; don’t let unknown visitors in.</li>
            <li>Gate closes at 10:30 pm. Late entry needs a call to the warden.</li>
            <li>Keep your emergency contacts current on your profile.</li>
          </ul>
        </Card>
      </div>
    </>
  );
}
