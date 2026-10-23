import { useEffect, useMemo, useState } from 'react';
import { services } from '@/services';
import type { ChargeView } from '@/services/interfaces';
import type { PaymentMethod } from '@/types/domain';
import { useMutation } from '@/hooks/useMutation';
import { useQuery } from '@/hooks/useQuery';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/Field';
import { todayISO } from '@/lib/clock';
import { formatDate, formatINR, formatPeriod } from '@/lib/format';

const METHODS: Array<{ value: PaymentMethod; label: string }> = [
  { value: 'upi', label: 'UPI' }, { value: 'cash', label: 'Cash' }, { value: 'bank_transfer', label: 'Bank transfer' }, { value: 'card', label: 'Card (POS)' },
];

export function RecordPaymentModal({ open, onClose, studentId, chargeId, onRecorded }: { open: boolean; onClose: () => void; studentId?: string; chargeId?: string; onRecorded?: (paymentId: string) => void }) {
  const charges = useQuery(() => (open ? services.payments.listCharges({ studentId }) : Promise.resolve([] as ChargeView[])), [open, studentId]);
  const outstanding = useMemo(() => (charges.data ?? []).filter((c) => c.balance > 0), [charges.data]);
  const [sel, setSel] = useState('');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('upi');
  const [paidOn, setPaidOn] = useState(todayISO());
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const charge = outstanding.find((c) => c.id === sel);

  useEffect(() => {
    if (!open) return;
    setSel(chargeId ?? ''); setMethod('upi'); setPaidOn(todayISO()); setReference(''); setNote(''); setAmount('');
  }, [open, chargeId]);
  useEffect(() => { if (charge) setAmount(String(charge.balance)); }, [charge?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const m = useMutation(services.payments.recordPayment, { success: (p) => `Payment recorded. Receipt ${p.receiptNo} is ready.`, onSuccess: (p) => { onClose(); onRecorded?.(p.id); } });

  return (
    <Modal open={open} onClose={onClose} title="Record payment" description="Payments are recorded against a rent due. A receipt is generated automatically."
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={m.pending} onClick={() => void m.run({ chargeId: sel, amount: Number(amount), method, paidOn, reference, note })}>Record payment</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Select className="sm:col-span-2" label="Due" required value={sel} onChange={(e) => setSel(e.target.value)} error={m.fieldErrors.chargeId}
          placeholder={charges.loading ? 'Loading dues…' : outstanding.length ? 'Select a resident’s due' : 'No outstanding dues'}
          options={outstanding.map((c) => ({ value: c.id, label: `${c.studentName}${c.roomNumber ? ` · Rm ${c.roomNumber}` : ''} — ${formatPeriod(c.period)} — ${formatINR(c.balance)} due` }))} />
        {charge && (
          <p className="rounded-xl bg-sand/60 px-3 py-2 text-xs text-bark sm:col-span-2">
            Rent {formatINR(charge.amount)} · paid {formatINR(charge.paid)} · balance <strong>{formatINR(charge.balance)}</strong> · due {formatDate(charge.dueDate)}
          </p>
        )}
        <Input label="Amount (₹)" type="number" inputMode="numeric" min={1} required value={amount} onChange={(e) => setAmount(e.target.value)} error={m.fieldErrors.amount} />
        <Select label="Method" value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)} options={METHODS} />
        <Input label="Payment date" type="date" max={todayISO()} required value={paidOn} onChange={(e) => setPaidOn(e.target.value)} error={m.fieldErrors.paidOn} />
        <Input label="Reference / UTR" value={reference} onChange={(e) => setReference(e.target.value)} error={m.fieldErrors.reference} required={method !== 'cash'} hint={method === 'cash' ? 'Optional for cash' : undefined} />
        <Textarea className="sm:col-span-2" label="Note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional, e.g. Paid by guardian" />
      </div>
    </Modal>
  );
}
