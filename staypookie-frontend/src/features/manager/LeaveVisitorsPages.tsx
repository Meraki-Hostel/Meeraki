import { useEffect, useMemo, useState } from 'react';
import { Check, LogIn, LogOut, UserPlus, X } from 'lucide-react';
import { services } from '@/services';
import type { LeaveView, VisitorView } from '@/services/interfaces';
import type { VisitorStatus } from '@/types/domain';
import { useQuery } from '@/hooks/useQuery';
import { useMutation } from '@/hooks/useMutation';
import { useDebounced, useQueryParam } from '@/hooks/misc';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { FilterBar, FilterSelect, SearchInput } from '@/components/ui/FilterBar';
import { Tabs, TabPanel } from '@/components/ui/Tabs';
import { StatusBadge, statusOptions } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/States';
import { addDays, daysBetween, now, todayISO } from '@/lib/clock';
import { formatClock, formatDate, formatDateTime, formatPhone, formatTime } from '@/lib/format';

/* ---------------- Leave ---------------- */
function DecisionModal<T extends { id: string }>({ target, decision, onClose, title, run, pending, error }: { target: T | null; decision: 'approved' | 'rejected'; onClose: () => void; title: string; run: (reason: string) => void; pending: boolean; error?: string }) {
  const [reason, setReason] = useState('');
  useEffect(() => { setReason(''); }, [target?.id]);
  return (
    <Modal open={!!target} onClose={onClose} size="sm" title={title}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button variant={decision === 'rejected' ? 'danger' : 'primary'} loading={pending} onClick={() => run(reason)}>{decision === 'approved' ? 'Approve' : 'Reject'}</Button></>}>
      <Textarea label={decision === 'approved' ? 'Note for the student (optional)' : 'Reason for rejecting'} required={decision === 'rejected'} value={reason} onChange={(e) => setReason(e.target.value)} error={error} placeholder={decision === 'approved' ? 'e.g. Sign out at the gate register' : 'e.g. Clashes with internal exams'} />
    </Modal>
  );
}

export function LeavePage() {
  const [tab, setTab] = useState<'pending' | 'all'>('pending');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [deciding, setDeciding] = useState<{ leave: LeaveView; decision: 'approved' | 'rejected' } | null>(null);
  const ds = useDebounced(search).toLowerCase();
  const q = useQuery(() => services.leave.list(), []);
  const decide = useMutation((id: string, d: 'approved' | 'rejected', r: string) => services.leave.decide(id, d, r), { success: (l) => `Leave ${l.status}. The student has been notified.`, onSuccess: () => setDeciding(null) });
  const all = useMemo(() => q.data ?? [], [q.data]);
  const rows = useMemo(() => all.filter((l) => (tab === 'pending' ? l.status === 'pending' : !status || l.status === status) && (!ds || `${l.studentName} ${l.destination} ${l.roomNumber ?? ''}`.toLowerCase().includes(ds))), [all, tab, status, ds]);
  const today = todayISO();
  const week = addDays(today, 7);
  const departures = all.filter((l) => l.status === 'approved' && l.from >= today && l.from <= week);
  const returns = all.filter((l) => l.status === 'approved' && l.to >= today && l.to <= week);
  const away = all.filter((l) => l.status === 'approved' && l.from <= today && l.to >= today);

  const cols: Column<LeaveView>[] = [
    { key: 'student', header: 'Student', cell: (l) => <div><p className="font-medium">{l.studentName}</p><p className="text-xs text-dust">Room {l.roomNumber ?? '—'}</p></div>, sortValue: (l) => l.studentName },
    { key: 'dates', header: 'Dates', cell: (l) => <div><p>{formatDate(l.from)} – {formatDate(l.to)}</p><p className="text-xs text-dust">{daysBetween(l.from, l.to) + 1} day{daysBetween(l.from, l.to) ? 's' : ''}</p></div>, sortValue: (l) => l.from },
    { key: 'dest', header: 'Destination · reason', cell: (l) => <div className="max-w-[260px]"><p>{l.destination}</p><p className="truncate text-xs text-dust" title={l.reason}>{l.reason}</p></div> },
    { key: 'contact', header: 'Contact', cell: (l) => formatPhone(l.contactPhone), hideBelow: 'lg' },
    { key: 'status', header: 'Status', cell: (l) => <div><StatusBadge kind="leave" value={l.status} />{l.decisionReason && <p className="mt-1 max-w-[180px] truncate text-xs text-dust" title={l.decisionReason}>{l.decisionReason}</p>}</div>, sortValue: (l) => l.status },
    { key: 'act', header: 'Decision', align: 'right', cell: (l) => l.status === 'pending' ? (
      <div className="flex justify-end gap-1.5">
        <Button size="sm" variant="soft" icon={<Check className="size-3.5" />} onClick={() => setDeciding({ leave: l, decision: 'approved' })}>Approve</Button>
        <Button size="sm" variant="ghost" icon={<X className="size-3.5" />} onClick={() => setDeciding({ leave: l, decision: 'rejected' })}>Reject</Button>
      </div>) : <span className="text-xs text-dust">{l.decidedBy ? `by ${l.decidedBy}` : '—'}</span> },
  ];

  const mini = (title: string, list: LeaveView[], key: 'from' | 'to') => (
    <Card className="p-5"><CardHeader title={title} as="h2" />
      <ul className="mt-3 space-y-2 text-sm">{list.length === 0 ? <li className="text-dust">None this week.</li> : list.map((l) => <li key={l.id} className="flex justify-between gap-2"><span>{l.studentName} <span className="text-dust">· Rm {l.roomNumber}</span></span><span className="text-dust">{formatDate(l[key])}</span></li>)}</ul>
    </Card>
  );

  return (
    <>
      <PageHeader title="Leave requests" subtitle="Approve or reject resident leave. Students see your decision instantly." />
      <div className="mb-5 grid gap-4 md:grid-cols-3">
        {mini('Away right now', away, 'to')}{mini('Departing this week', departures, 'from')}{mini('Returning this week', returns, 'to')}
      </div>
      <Card className="p-4 sm:p-5">
        <Tabs label="Leave views" value={tab} onChange={setTab} items={[{ value: 'pending', label: 'Awaiting decision', count: all.filter((l) => l.status === 'pending').length }, { value: 'all', label: 'All requests', count: all.length }]} />
        <TabPanel>
          <FilterBar className="mb-4">
            <SearchInput value={search} onChange={setSearch} placeholder="Student, room or destination" label="Search leave" />
            {tab === 'all' && <FilterSelect label="Statuses" value={status} onChange={setStatus} options={statusOptions('leave')} />}
          </FilterBar>
          <DataTable caption="Leave requests" columns={cols} rows={q.data ? rows : undefined} loading={q.loading} error={q.error} rowKey={(l) => l.id}
            empty={<EmptyState title={tab === 'pending' ? 'All caught up' : 'No leave requests'} message="New requests from students appear here." />} />
        </TabPanel>
      </Card>
      <DecisionModal target={deciding?.leave ?? null} decision={deciding?.decision ?? 'approved'} onClose={() => setDeciding(null)}
        title={deciding ? `${deciding.decision === 'approved' ? 'Approve' : 'Reject'} leave for ${deciding.leave.studentName}` : ''}
        pending={decide.pending} error={decide.fieldErrors.reason} run={(r) => deciding && void decide.run(deciding.leave.id, deciding.decision, r)} />
    </>
  );
}

/* ---------------- Visitors ---------------- */
function WalkInModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const students = useQuery(() => (open ? services.students.list({ status: 'active' }) : Promise.resolve([])), [open]);
  const t = now();
  const blank = { studentId: '', visitorName: '', visitorPhone: '', relation: 'Parent', visitTime: `${String(Math.min(19, Math.max(8, t.getHours()))).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`, purpose: '' };
  const [f, setF] = useState(blank);
  useEffect(() => { if (open) setF(blank); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const m = useMutation(services.visitors.createWalkIn, { success: (v) => `${v.visitorName} checked in. The resident has been notified.`, onSuccess: onClose });
  const e = m.fieldErrors;
  return (
    <Modal open={open} onClose={onClose} title="Log walk-in visitor" description="For visitors who arrive without a prior request. They are checked in immediately."
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={m.pending} onClick={() => void m.run({ ...f, visitDate: todayISO() })}>Check in visitor</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Select className="sm:col-span-2" label="Visiting resident" required value={f.studentId} onChange={(ev) => setF({ ...f, studentId: ev.target.value })} error={e.studentId} placeholder="Choose resident" options={(students.data ?? []).map((s) => ({ value: s.id, label: `${s.name}${s.roomNumber ? ` · Room ${s.roomNumber}` : ''}` }))} />
        <Input label="Visitor name" required value={f.visitorName} onChange={(ev) => setF({ ...f, visitorName: ev.target.value })} error={e.visitorName} />
        <Input label="Visitor phone" required inputMode="tel" value={f.visitorPhone} onChange={(ev) => setF({ ...f, visitorPhone: ev.target.value })} error={e.visitorPhone} />
        <Input label="Relation" required value={f.relation} onChange={(ev) => setF({ ...f, relation: ev.target.value })} error={e.relation} />
        <Input label="Arrival time" type="time" required value={f.visitTime} onChange={(ev) => setF({ ...f, visitTime: ev.target.value })} error={e.visitTime} hint="Visiting hours 8 am – 7 pm" />
        <Input className="sm:col-span-2" label="Purpose" value={f.purpose} onChange={(ev) => setF({ ...f, purpose: ev.target.value })} placeholder="e.g. Dropping off books" />
      </div>
    </Modal>
  );
}

export function VisitorsPage() {
  const [tab, setTab] = useState<'today' | 'requests' | 'log'>('today');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [walkParam, setWalkParam] = useQueryParam('walkin');
  const [rejecting, setRejecting] = useState<VisitorView | null>(null);
  const ds = useDebounced(search).toLowerCase();
  const q = useQuery(() => services.visitors.list(), []);
  const approve = useMutation((id: string) => services.visitors.decide(id, 'approved'), { success: (v) => `Visit by ${v.visitorName} approved.` });
  const reject = useMutation((id: string, r: string) => services.visitors.decide(id, 'rejected', r), { success: 'Visit rejected. The student has been notified.', onSuccess: () => setRejecting(null) });
  const checkIn = useMutation(services.visitors.checkIn, { success: (v) => `${v.visitorName} checked in.` });
  const checkOut = useMutation(services.visitors.checkOut, { success: (v) => `${v.visitorName} checked out.` });
  const all = useMemo(() => q.data ?? [], [q.data]);
  const today = todayISO();
  const rows = useMemo(() => all.filter((v) => {
    if (tab === 'today' && !(v.visitDate === today || v.status === 'checked_in')) return false;
    if (tab === 'requests' && v.status !== 'pending') return false;
    if (tab === 'log' && status && v.status !== status) return false;
    return !ds || `${v.visitorName} ${v.studentName} ${v.roomNumber ?? ''} ${v.visitorPhone}`.toLowerCase().includes(ds);
  }), [all, tab, today, status, ds]);

  const cols: Column<VisitorView>[] = [
    { key: 'visitor', header: 'Visitor', cell: (v) => <div><p className="font-medium">{v.visitorName}</p><p className="text-xs text-dust">{v.relation} · {formatPhone(v.visitorPhone)}</p></div>, sortValue: (v) => v.visitorName },
    { key: 'student', header: 'Visiting', cell: (v) => <div><p>{v.studentName}</p><p className="text-xs text-dust">Room {v.roomNumber ?? '—'}</p></div>, sortValue: (v) => v.studentName },
    { key: 'when', header: 'Planned', cell: (v) => <div><p>{formatDate(v.visitDate)}</p><p className="text-xs text-dust">{formatClock(v.visitTime)}{v.source === 'walk_in' ? ' · walk-in' : ''}</p></div>, sortValue: (v) => `${v.visitDate}${v.visitTime}` },
    { key: 'inout', header: 'In · out', cell: (v) => v.checkInAt ? <span className="text-xs">{formatTime(v.checkInAt)}{v.checkOutAt ? ` – ${formatTime(v.checkOutAt)}` : ' – inside'}</span> : <span className="text-xs text-mute">—</span>, hideBelow: 'md' },
    { key: 'status', header: 'Status', cell: (v) => <StatusBadge kind="visitor" value={v.status} />, sortValue: (v) => v.status },
    { key: 'act', header: 'Action', align: 'right', cell: (v) => (
      <div className="flex justify-end gap-1.5">
        {v.status === 'pending' && <><Button size="sm" variant="soft" onClick={() => void approve.run(v.id)}>Approve</Button><Button size="sm" variant="ghost" onClick={() => setRejecting(v)}>Reject</Button></>}
        {v.status === 'approved' && <Button size="sm" variant="soft" icon={<LogIn className="size-3.5" />} disabled={v.visitDate !== today} title={v.visitDate !== today ? `Check-in opens on ${formatDate(v.visitDate)}` : undefined} onClick={() => void checkIn.run(v.id)}>Check in</Button>}
        {v.status === 'checked_in' && <Button size="sm" variant="secondary" icon={<LogOut className="size-3.5" />} onClick={() => void checkOut.run(v.id)}>Check out</Button>}
        {['rejected', 'checked_out', 'cancelled'].includes(v.status) && <span className="text-xs text-dust" title={v.checkOutAt ? formatDateTime(v.checkOutAt) : v.decisionReason}>{v.decisionReason ? 'See reason' : 'Done'}</span>}
      </div>
    ) },
  ];

  return (
    <>
      <PageHeader title="Visitors" subtitle="Approve requests, check visitors in and out, and keep the gate log."
        actions={<Button icon={<UserPlus className="size-4" />} onClick={() => setWalkParam('1')}>Log walk-in</Button>} />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[['Expected today', all.filter((v) => v.visitDate === today && v.status === 'approved').length], ['Inside now', all.filter((v) => v.status === 'checked_in').length], ['Requests to review', all.filter((v) => v.status === 'pending').length], ['Visits this month', all.filter((v) => v.visitDate.slice(0, 7) === today.slice(0, 7) && v.checkInAt).length]].map(([l, n]) => (
          <Card key={l as string} className="p-4"><p className="text-[13px] text-bark">{l}</p><p className="mt-1 font-display text-2xl font-semibold tabular-nums">{n}</p></Card>
        ))}
      </div>
      <Card className="p-4 sm:p-5">
        <Tabs label="Visitor views" value={tab} onChange={setTab} items={[{ value: 'today', label: 'Today' }, { value: 'requests', label: 'Requests', count: all.filter((v) => v.status === 'pending').length }, { value: 'log', label: 'Full log', count: all.length }]} />
        <TabPanel>
          <FilterBar className="mb-4">
            <SearchInput value={search} onChange={setSearch} placeholder="Visitor, resident or room" label="Search visitors" />
            {tab === 'log' && <FilterSelect label="Statuses" value={status} onChange={(v) => setStatus(v as VisitorStatus | '')} options={statusOptions('visitor')} />}
          </FilterBar>
          <DataTable caption="Visitors" columns={cols} rows={q.data ? rows : undefined} loading={q.loading} error={q.error} rowKey={(v) => v.id}
            empty={<EmptyState title={tab === 'requests' ? 'No requests to review' : 'No visitors here'} message="Student visit requests and walk-ins appear in this list." />} />
        </TabPanel>
      </Card>
      <WalkInModal open={walkParam === '1'} onClose={() => setWalkParam(null)} />
      <DecisionModal target={rejecting} decision="rejected" onClose={() => setRejecting(null)} title={rejecting ? `Reject visit by ${rejecting.visitorName}` : ''}
        pending={reject.pending} error={reject.fieldErrors.reason} run={(r) => rejecting && void reject.run(rejecting.id, r)} />
    </>
  );
}

