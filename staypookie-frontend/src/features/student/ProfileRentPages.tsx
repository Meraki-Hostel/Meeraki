import { useEffect, useState, type FormEvent } from 'react';
import { CheckCircle2, Receipt, ShieldCheck } from 'lucide-react';
import { services } from '@/services';
import type { ChargeWithBalance, Payment } from '@/types/domain';
import { useQuery } from '@/hooks/useQuery';
import { useMutation } from '@/hooks/useMutation';
import { useQueryParam } from '@/hooks/misc';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardHeader, DescriptionList } from '@/components/ui/Card';
import { Button, IconButton } from '@/components/ui/Button';
import { Input, RadioGroup, Select, Textarea } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { PageSkeleton } from '@/components/ui/States';
import { ReceiptModal } from '@/components/domain/ReceiptModal';
import { METHOD_LABEL } from '@/features/owner/FinancePage';
import { formatDate, formatINR, formatPeriod, formatPhone, sentenceCase } from '@/lib/format';
import { openCheckout } from '@/lib/razorpay';

export function StudentProfilePage() {
  const me = useQuery(() => services.students.me(), []);
  const s = me.data?.student;
  const [f, setF] = useState({ email: '', phone: '', address: '', emergencyName: '', emergencyPhone: '', bloodGroup: '' });
  useEffect(() => { if (s) setF({ email: s.email, phone: s.phone, address: s.address, emergencyName: s.emergencyName, emergencyPhone: s.emergencyPhone, bloodGroup: s.bloodGroup }); }, [s?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const save = useMutation(services.students.updateSelf, { success: 'Your details are saved. The hostel office can see the update.' });
  if (!s) return <PageSkeleton />;
  const e = save.fieldErrors;
  const submit = (ev: FormEvent) => { ev.preventDefault(); void save.run(f); };
  return (
    <>
      <PageHeader title="My profile" subtitle="Keep your contact and emergency details current." />
      <div className="grid gap-5 lg:grid-cols-5">
        <Card className="p-5 lg:col-span-2">
          <CardHeader title="Stay details" subtitle="Managed by the hostel office" />
          <div className="mt-4"><DescriptionList cols={1} items={[
            { label: 'Name', value: s.name }, { label: 'Student ID', value: s.studentCode }, { label: 'Property', value: s.propertyName },
            { label: 'Room', value: s.roomNumber ? `Room ${s.roomNumber}, Bed ${s.bedLabel}` : 'Not allotted' }, { label: 'College', value: `${s.college} · ${s.course}, Year ${s.year}` },
            { label: 'Date of birth', value: formatDate(s.dob) }, { label: 'Guardian', value: `${s.guardianName} (${s.guardianRelation}) · ${formatPhone(s.guardianPhone)}` },
            { label: 'Resident since', value: formatDate(s.joinedOn) }, { label: 'Status', value: <StatusBadge kind="student" value={s.status} /> },
          ]} /></div>
          <p className="mt-4 text-xs text-dust">To change these, raise a request from Complaints → Other, or visit the office.</p>
        </Card>
        <Card className="p-5 lg:col-span-3">
          <CardHeader title="Contact & emergency" subtitle="You can edit these" />
          <form onSubmit={submit} noValidate className="mt-4 grid gap-4 sm:grid-cols-2">
            <Input label="Mobile number" required inputMode="tel" value={f.phone} onChange={(ev) => setF({ ...f, phone: ev.target.value })} error={e.phone} />
            <Input label="Email" type="email" required value={f.email} onChange={(ev) => setF({ ...f, email: ev.target.value })} error={e.email} />
            <Input label="Emergency contact name" required value={f.emergencyName} onChange={(ev) => setF({ ...f, emergencyName: ev.target.value })} error={e.emergencyName} />
            <Input label="Emergency contact phone" required inputMode="tel" value={f.emergencyPhone} onChange={(ev) => setF({ ...f, emergencyPhone: ev.target.value })} error={e.emergencyPhone} />
            <Select label="Blood group" value={f.bloodGroup} onChange={(ev) => setF({ ...f, bloodGroup: ev.target.value })} options={['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'].map((b) => ({ value: b, label: b }))} />
            <Textarea className="sm:col-span-2" rows={2} label="Home address" required value={f.address} onChange={(ev) => setF({ ...f, address: ev.target.value })} error={e.address} />
            <div className="flex justify-end gap-2 sm:col-span-2">
              <Button variant="ghost" onClick={() => { setF({ email: s.email, phone: s.phone, address: s.address, emergencyName: s.emergencyName, emergencyPhone: s.emergencyPhone, bloodGroup: s.bloodGroup }); save.clearErrors(); }}>Discard</Button>
              <Button type="submit" loading={save.pending}>Save changes</Button>
            </div>
          </form>
        </Card>
      </div>
    </>
  );
}

type PayMethod = 'upi' | 'card' | 'netbanking';
function PayNowModal({ charge, onClose, onPaid }: { charge: ChargeWithBalance | null; onClose: () => void; onPaid: (p: Payment) => void }) {
  const [method, setMethod] = useState<PayMethod>('upi');
  const [done, setDone] = useState<Payment | null>(null);
  // Razorpay took the payment but is still settling it; the webhook will confirm it.
  const [processing, setProcessing] = useState(false);
  useEffect(() => { if (charge) { setDone(null); setProcessing(false); setMethod('upi'); } }, [charge?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const pay = useMutation(async (id: string) => {
    const r = await services.payments.payNow(id, method);
    if (!('pending' in r)) return r; // simulated (development)
    // Real money: Razorpay's own window, then the API verifies with Razorpay.
    const ok = await openCheckout(r, { description: `${charge?.description || 'Rent'} (${charge?.period})`, method });
    const result = await services.payments.verifyOnlinePayment({ orderId: ok.razorpay_order_id, paymentId: ok.razorpay_payment_id, signature: ok.razorpay_signature });
    if (result.status === 'failed') throw new Error('Razorpay reported the payment failed. No money was taken.');
    return result.payment ?? null;
  }, {
    onSuccess: (p) => { if (p) setDone(p); else setProcessing(true); },
    toastErrors: true,
  });
  if (!charge) return null;
  // Only a payment the API marks `captured` moved money; dev mode is simulated.
  const real = done?.status === 'captured';
  const title = processing ? 'Payment processing' : done ? (real ? 'Payment successful' : 'Simulated payment recorded') : `Pay ${formatPeriod(charge.period)} ${charge.kind === 'deposit' ? 'deposit' : charge.kind === 'late_fee' ? 'late fee' : 'rent'}`;
  return (
    <Modal open onClose={onClose} size="sm" title={title}
      footer={processing ? <Button variant="secondary" onClick={onClose}>Close</Button>
        : done ? <><Button variant="secondary" onClick={onClose}>Close</Button><Button icon={<Receipt className="size-4" />} onClick={() => { onPaid(done); onClose(); }}>View receipt</Button></>
        : <><Button variant="secondary" onClick={onClose} disabled={pay.pending}>Cancel</Button><Button loading={pay.pending} onClick={() => void pay.run(charge.id)}>{pay.pending ? 'Processing…' : `Pay ${formatINR(charge.balance)}`}</Button></>}>
      {processing ? (
        <p className="text-sm text-bark" role="status">Razorpay received your payment and is confirming it. This usually takes under a minute; your receipt appears on this page once it’s confirmed. Don’t pay again.</p>
      ) : done ? (
        <div className="flex flex-col items-center text-center" role="status">
          <CheckCircle2 className="size-12 text-moss" aria-hidden />
          <p className="mt-3 font-display text-3xl font-semibold">{formatINR(done.amount)}</p>
          <p className="text-sm text-dust">Receipt {done.receiptNo} · {formatDate(done.paidOn)}</p>
          {!real && <p className="mt-3 text-xs text-dust">Simulated payment. No money moved.</p>}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-xl bg-sand/60 px-4 py-3"><span className="text-sm text-bark">Amount</span><span className="font-display text-2xl font-semibold tabular-nums">{formatINR(charge.balance)}</span></div>
          <RadioGroup label="Pay with" name="pm" value={method} onChange={setMethod} options={[
            { value: 'upi', label: 'UPI', description: 'Any UPI app' }, { value: 'card', label: 'Debit / credit card' }, { value: 'netbanking', label: 'Net banking' },
          ]} />
          <p className="flex gap-2 rounded-xl border border-slate-soft/60 bg-slate-wash/60 px-3 py-2 text-xs text-slate-ink"><ShieldCheck className="size-4 shrink-0" aria-hidden />Payment opens in Razorpay’s secure window. StayPookie never sees your card number, UPI PIN or bank password.</p>
        </div>
      )}
    </Modal>
  );
}

export function StudentRentPage() {
  const me = useQuery(() => services.students.me(), []);
  const [paying, setPaying] = useState<ChargeWithBalance | null>(null);
  const [receipt, setReceipt] = useQueryParam('receipt');
  if (!me.data) return <PageSkeleton />;
  const { charges, payments, student } = me.data;
  const due = charges.filter((c) => c.balance > 0);
  const totalPaid = payments.reduce((a, p) => a + p.amount, 0);
  return (
    <>
      <PageHeader title="Rent & receipts" subtitle="Your dues, payment history and receipts." />
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-5"><p className="text-[13px] text-bark">Outstanding</p><p className={`mt-1 font-display text-3xl font-semibold tabular-nums ${student.balance ? 'text-brick' : 'text-moss'}`}>{formatINR(student.balance)}</p><p className="mt-1 text-xs text-dust">{due.length ? `${due.length} due${due.length > 1 ? 's' : ''}` : 'Nothing due'}</p></Card>
        <Card className="p-5"><p className="text-[13px] text-bark">Monthly rent</p><p className="mt-1 font-display text-3xl font-semibold tabular-nums">{formatINR(student.monthlyRent)}</p><p className="mt-1 text-xs text-dust">Room {student.roomNumber ?? '—'}</p></Card>
        <Card className="p-5"><p className="text-[13px] text-bark">Paid so far</p><p className="mt-1 font-display text-3xl font-semibold tabular-nums">{formatINR(totalPaid)}</p><p className="mt-1 text-xs text-dust">{payments.length} payments</p></Card>
      </div>
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card className="p-5">
          <CardHeader title="Dues" />
          <ul className="mt-3 divide-y divide-line/70">
            {charges.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-0 flex-1"><p className="text-sm font-medium">{formatPeriod(c.period)} <span className="font-normal text-dust">· {c.description}</span></p><p className="text-xs text-dust">Due {formatDate(c.dueDate)} · {formatINR(c.paid)} of {formatINR(c.amount)} paid</p></div>
                <StatusBadge kind="charge" value={c.status} />
                {c.balance > 0 && <Button size="sm" onClick={() => setPaying(c)}>Pay {formatINR(c.balance)}</Button>}
              </li>
            ))}
          </ul>
        </Card>
        <Card className="p-5">
          <CardHeader title="Payment history" />
          <ul className="mt-3 divide-y divide-line/70">
            {payments.length === 0 && <li className="py-6 text-center text-sm text-dust">No payments yet.</li>}
            {payments.map((p) => (
              <li key={p.id} className="flex items-center gap-3 py-3 text-sm">
                <div className="flex-1"><p className="font-medium">{formatINR(p.amount)} <span className="font-normal text-dust">· {METHOD_LABEL[p.method]}</span></p><p className="text-xs text-dust">{p.receiptNo} · {formatDate(p.paidOn)} · {sentenceCase(p.recordedBy === student.name ? 'paid online' : `recorded by ${p.recordedBy}`)}</p></div>
                <IconButton size="sm" label={`View receipt ${p.receiptNo}`} onClick={() => setReceipt(p.id)}><Receipt className="size-4" /></IconButton>
              </li>
            ))}
          </ul>
        </Card>
      </div>
      <PayNowModal charge={paying} onClose={() => setPaying(null)} onPaid={(p) => setReceipt(p.id)} />
      <ReceiptModal paymentId={receipt} onClose={() => setReceipt(null)} />
    </>
  );
}
