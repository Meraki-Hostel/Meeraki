import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { BedDouble, CreditCard, FileText, Pencil, Receipt } from 'lucide-react';
import { services } from '@/services';
import type { StudentDetail, StudentInput } from '@/services/interfaces';
import type { DocumentRecord, StudentStatus } from '@/types/domain';
import { useQuery } from '@/hooks/useQuery';
import { useMutation } from '@/hooks/useMutation';
import { useQueryParam } from '@/hooks/misc';
import { useConfirm } from '@/app/providers/ConfirmProvider';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardHeader, DescriptionList } from '@/components/ui/Card';
import { Button, IconButton } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { Input, Textarea } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { Dropdown } from '@/components/ui/Dropdown';
import { Tabs, TabPanel } from '@/components/ui/Tabs';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { ErrorState, PageSkeleton } from '@/components/ui/States';
import { AssignBedModal } from '@/components/domain/AssignBedModal';
import { RecordPaymentModal } from '@/components/domain/RecordPaymentModal';
import { ReceiptModal } from '@/components/domain/ReceiptModal';
import { formatClock, formatDate, formatDateTime, formatINR, formatPeriod, formatPhone, sentenceCase } from '@/lib/format';
import { METHOD_LABEL } from '@/features/owner/FinancePage';

const DOC_LABEL: Record<DocumentRecord['type'], string> = { id_proof: 'Government ID (Aadhaar)', admission_letter: 'College admission letter', photo: 'Passport photo', police_verification: 'Police verification', rent_agreement: 'Signed rent agreement', medical: 'Medical certificate' };
export { DOC_LABEL };

function EditStudentModal({ open, onClose, d }: { open: boolean; onClose: () => void; d: StudentDetail }) {
  const s = d.student;
  const init = () => ({ name: s.name, email: s.email, phone: s.phone, college: s.college, course: s.course, year: String(s.year), guardianName: s.guardianName, guardianRelation: s.guardianRelation, guardianPhone: s.guardianPhone, emergencyName: s.emergencyName, emergencyPhone: s.emergencyPhone, address: s.address, bloodGroup: s.bloodGroup });
  const [f, setF] = useState(init);
  useEffect(() => { if (open) setF(init()); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const m = useMutation((p: Partial<StudentInput>) => services.students.update(s.id, p), { success: 'Student details saved.', onSuccess: onClose });
  const e = m.fieldErrors;
  const field = (k: keyof typeof f, label: string, extra: Record<string, unknown> = {}) => <Input label={label} value={f[k]} onChange={(ev) => setF({ ...f, [k]: ev.target.value })} error={e[k]} {...extra} />;
  return (
    <Modal open={open} onClose={onClose} size="xl" title={`Edit ${s.name}`}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={m.pending} onClick={() => void m.run({ ...f, year: Number(f.year) })}>Save changes</Button></>}>
      <div className="grid gap-4 sm:grid-cols-3">
        {field('name', 'Full name', { required: true })}{field('phone', 'Mobile number', { required: true })}{field('email', 'Email', { required: true, type: 'email' })}
        {field('college', 'College')}{field('course', 'Course')}{field('year', 'Year', { type: 'number', min: 1, max: 6 })}
        {field('guardianName', 'Guardian name')}{field('guardianRelation', 'Relation')}{field('guardianPhone', 'Guardian phone')}
        {field('emergencyName', 'Emergency contact')}{field('emergencyPhone', 'Emergency phone')}{field('bloodGroup', 'Blood group')}
        <Textarea className="sm:col-span-3" rows={2} label="Home address" value={f.address} onChange={(ev) => setF({ ...f, address: ev.target.value })} />
      </div>
    </Modal>
  );
}

function DocReview({ doc }: { doc: DocumentRecord }) {
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState('');
  const m = useMutation((dec: 'verified' | 'rejected') => services.documents.review(doc.id, dec, note), { success: (d) => (d.status === 'verified' ? 'Document verified.' : 'Sent back to student for re-upload.'), onSuccess: () => setRejecting(false) });
  return (
    <li className="flex flex-wrap items-center gap-3 py-3">
      <FileText className="size-5 text-dust" aria-hidden />
      <div className="min-w-0 flex-1"><p className="text-sm font-medium">{DOC_LABEL[doc.type]}</p><p className="text-xs text-dust">{doc.fileName ? `${doc.fileName} · ${doc.fileSizeKb} KB · ${formatDate(doc.uploadedAt)}` : 'Not uploaded'}{doc.note ? ` · ${doc.note}` : ''}</p></div>
      <StatusBadge kind="document" value={doc.status} />
      {doc.status === 'uploaded' && <div className="flex gap-1.5"><Button size="sm" variant="soft" loading={m.pending} onClick={() => void m.run('verified')}>Verify</Button><Button size="sm" variant="ghost" onClick={() => setRejecting(true)}>Reject</Button></div>}
      <Modal open={rejecting} onClose={() => setRejecting(false)} size="sm" title="Ask for re-upload" footer={<><Button variant="secondary" onClick={() => setRejecting(false)}>Cancel</Button><Button variant="danger" loading={m.pending} onClick={() => void m.run('rejected')}>Reject document</Button></>}>
        <Textarea label="What should the student fix?" required value={note} onChange={(e) => setNote(e.target.value)} error={m.fieldErrors.note} placeholder="e.g. Photo is blurry; upload a clear scan" />
      </Modal>
    </li>
  );
}

export function StudentProfilePage() {
  const { studentId = '' } = useParams();
  const confirm = useConfirm();
  const [tab, setTabParam] = useQueryParam('tab');
  const current = (tab ?? 'overview') as 'overview' | 'payments' | 'documents' | 'requests';
  const q = useQuery(() => services.students.get(studentId), [studentId]);
  const [editOpen, setEditOpen] = useState(false);
  const [bedOpen, setBedOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [receipt, setReceipt] = useState<string | null>(null);
  const setStatus = useMutation((st: StudentStatus) => services.students.setStatus(studentId, st), { success: (s) => `${s.name} is now ${sentenceCase(s.status).toLowerCase()}.` });
  if (q.error) return <ErrorState message={q.error} onRetry={q.reload} />;
  if (!q.data) return <PageSkeleton />;
  const d = q.data;
  const s = d.student;
  const changeStatus = async (st: StudentStatus) => {
    if (st === 'moved_out' && !(await confirm({ title: `Mark ${s.name} as moved out?`, message: <>Their bed{ s.roomNumber ? ` (Room ${s.roomNumber}, Bed ${s.bedLabel})` : ''} will be released. Outstanding balance of <strong>{formatINR(s.balance)}</strong> stays on record.</>, confirmLabel: 'Mark moved out', tone: 'danger' }))) return;
    void setStatus.run(st);
  };
  const hasRequests = Boolean(d.complaints || d.leaves || d.visitors);
  const tw = (title: string, items: Array<{ label: string; value: React.ReactNode }>) => <Card className="p-5"><CardHeader title={title} as="h3" /><div className="mt-4"><DescriptionList items={items} /></div></Card>;

  return (
    <>
      <PageHeader docTitle={s.name} breadcrumbs={[{ label: 'Students', to: '/manager/students' }, { label: s.name }]}
        title={<span className="flex items-center gap-3"><Avatar name={s.name} size="lg" /><span>{s.name}<span className="mt-1 flex flex-wrap items-center gap-2 font-sans text-sm font-normal text-dust">{s.studentCode} · {s.roomNumber ? `Room ${s.roomNumber}, Bed ${s.bedLabel}` : 'No bed allotted'} <StatusBadge kind="student" value={s.status} /></span></span></span>}
        actions={<>
          <Button variant="secondary" icon={<Pencil className="size-4" />} onClick={() => setEditOpen(true)}>Edit</Button>
          <Button variant="secondary" icon={<BedDouble className="size-4" />} onClick={() => setBedOpen(true)} disabled={s.status === 'moved_out'} title={s.status === 'moved_out' ? 'Moved-out residents cannot be allotted a bed' : undefined}>{s.bedId ? 'Transfer' : 'Allot bed'}</Button>
          <Button icon={<CreditCard className="size-4" />} onClick={() => setPayOpen(true)} disabled={!s.balance} title={!s.balance ? 'No outstanding balance' : undefined}>Record payment</Button>
          <Dropdown label="Status actions" items={(['active', 'notice', 'moved_out'] as StudentStatus[]).filter((x) => x !== s.status).map((x) => ({ label: x === 'active' ? 'Mark active' : x === 'notice' ? 'Put on notice' : 'Mark moved out', danger: x === 'moved_out', onSelect: () => void changeStatus(x) }))}
            trigger={({ toggle, open, id }) => <Button variant="ghost" onClick={toggle} aria-haspopup="menu" aria-expanded={open} aria-controls={open ? id : undefined}>Status</Button>} />
        </>} />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[['Monthly rent', formatINR(s.monthlyRent)], ['Balance due', formatINR(s.balance)], ['Joined', formatDate(s.joinedOn)],
          d.documents ? ['Documents verified', `${d.documents.filter((x) => x.status === 'verified').length}/${d.documents.length}`] : ['Paid so far', formatINR(d.payments.reduce((a, p) => a + p.amount, 0))]].map(([l, v]) => (
          <Card key={l} className="p-4"><p className="text-[13px] text-bark">{l}</p><p className={`mt-1 font-display text-xl font-semibold tabular-nums ${l === 'Balance due' && s.balance ? 'text-brick' : ''}`}>{v}</p></Card>
        ))}
      </div>

      <Tabs label="Profile sections" value={current} onChange={(t) => setTabParam(t === 'overview' ? null : t)} items={[
        { value: 'overview', label: 'Overview' }, { value: 'payments', label: 'Payments', count: d.payments.length },
        // Tabs for modules without a backend are not shown (the API does not return those lists yet).
        ...(d.documents ? [{ value: 'documents', label: 'Documents', count: d.documents.filter((x) => x.status === 'uploaded').length || undefined }] : []),
        ...(hasRequests ? [{ value: 'requests', label: 'Complaints, leave & visitors', count: (d.complaints?.length ?? 0) + (d.leaves?.length ?? 0) + (d.visitors?.length ?? 0) }] : []),
      ]} />

      {current === 'overview' && (
        <TabPanel className="grid gap-5 lg:grid-cols-2">
          {tw('Personal', [{ label: 'Mobile', value: formatPhone(s.phone) }, { label: 'Email', value: s.email }, { label: 'Date of birth', value: formatDate(s.dob) }, { label: 'Gender', value: sentenceCase(s.gender) }, { label: 'Blood group', value: s.bloodGroup }, { label: 'Home address', value: s.address }])}
          {tw('Academic', [{ label: 'College', value: s.college }, { label: 'Course', value: s.course }, { label: 'Year', value: `Year ${s.year}` }, { label: 'Property', value: s.propertyName }])}
          {tw('Guardian', [{ label: 'Name', value: `${s.guardianName} (${s.guardianRelation})` }, { label: 'Phone', value: formatPhone(s.guardianPhone) }])}
          {tw('Emergency contact', [{ label: 'Name', value: s.emergencyName }, { label: 'Phone', value: formatPhone(s.emergencyPhone) }])}
        </TabPanel>
      )}

      {current === 'payments' && (
        <TabPanel className="grid gap-5 lg:grid-cols-2">
          <Card className="p-5">
            <CardHeader title="Rent dues" as="h3" />
            <ul className="mt-3 divide-y divide-line/70">
              {d.charges.map((c) => (
                <li key={c.id} className="flex items-center gap-3 py-3 text-sm">
                  <div className="flex-1"><p className="font-medium">{formatPeriod(c.period)}</p><p className="text-xs text-dust">Due {formatDate(c.dueDate)} · paid {formatINR(c.paid)} of {formatINR(c.amount)}</p></div>
                  <StatusBadge kind="charge" value={c.status} />
                </li>
              ))}
              {d.charges.length === 0 && <li className="py-6 text-center text-sm text-dust">No rent raised yet.</li>}
            </ul>
          </Card>
          <Card className="p-5">
            <CardHeader title="Payment history" as="h3" />
            <ul className="mt-3 divide-y divide-line/70">
              {d.payments.map((p) => (
                <li key={p.id} className="flex items-center gap-3 py-3 text-sm">
                  <div className="flex-1"><p className="font-medium">{formatINR(p.amount)} <span className="font-normal text-dust">· {METHOD_LABEL[p.method]}</span></p><p className="text-xs text-dust">{p.receiptNo} · {formatDate(p.paidOn)}</p></div>
                  <IconButton size="sm" label={`View receipt ${p.receiptNo}`} onClick={() => setReceipt(p.id)}><Receipt className="size-4" /></IconButton>
                </li>
              ))}
              {d.payments.length === 0 && <li className="py-6 text-center text-sm text-dust">No payments yet.</li>}
            </ul>
          </Card>
        </TabPanel>
      )}

      {current === 'documents' && d.documents && (
        <TabPanel><Card className="p-5"><CardHeader title="Document checklist" subtitle="Verify uploads or ask for a re-upload" as="h3" /><ul className="mt-2 divide-y divide-line/70">{d.documents.map((doc) => <DocReview key={doc.id} doc={doc} />)}</ul></Card></TabPanel>
      )}

      {current === 'requests' && hasRequests && (
        <TabPanel className="grid gap-5 lg:grid-cols-3">
          {d.complaints && <Card className="p-5"><CardHeader title="Complaints" as="h3" />
            <ul className="mt-3 space-y-3 text-sm">{d.complaints.map((c) => <li key={c.id}><Link to={`/manager/complaints?id=${c.id}`} className="font-medium hover:underline">{c.title}</Link><div className="mt-1 flex items-center gap-2 text-xs text-dust">{c.ticketNo} · {formatDate(c.createdAt)} <StatusBadge kind="complaint" value={c.status} /></div></li>)}{!d.complaints.length && <li className="text-dust">None</li>}</ul>
          </Card>}
          {d.leaves && <Card className="p-5"><CardHeader title="Leave" as="h3" />
            <ul className="mt-3 space-y-3 text-sm">{d.leaves.map((l) => <li key={l.id}><p className="font-medium">{formatDate(l.from)} – {formatDate(l.to)}</p><div className="mt-1 flex items-center gap-2 text-xs text-dust">{l.destination} <StatusBadge kind="leave" value={l.status} /></div></li>)}{!d.leaves.length && <li className="text-dust">None</li>}</ul>
          </Card>}
          {d.visitors && <Card className="p-5"><CardHeader title="Visitors" as="h3" />
            <ul className="mt-3 space-y-3 text-sm">{d.visitors.map((v) => <li key={v.id}><p className="font-medium">{v.visitorName} <span className="font-normal text-dust">({v.relation})</span></p><div className="mt-1 flex items-center gap-2 text-xs text-dust">{formatDate(v.visitDate)}, {formatClock(v.visitTime)} <StatusBadge kind="visitor" value={v.status} /></div>{v.checkInAt && <p className="text-xs text-dust">In {formatDateTime(v.checkInAt)}{v.checkOutAt ? ` · out ${formatDateTime(v.checkOutAt)}` : ''}</p>}</li>)}{!d.visitors.length && <li className="text-dust">None</li>}</ul>
          </Card>}
        </TabPanel>
      )}

      <EditStudentModal open={editOpen} onClose={() => setEditOpen(false)} d={d} />
      <AssignBedModal open={bedOpen} onClose={() => setBedOpen(false)} studentId={s.id} studentName={s.name} currentBedId={s.bedId} />
      <RecordPaymentModal open={payOpen} onClose={() => setPayOpen(false)} studentId={s.id} onRecorded={setReceipt} />
      <ReceiptModal paymentId={receipt} onClose={() => setReceipt(null)} />
    </>
  );
}

