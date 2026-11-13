import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { payments } from '@/api/services';
import { DateField } from '@/components/DateField';
import { Body, Button, Card, Chips, ErrorState, Field, Loading, Notice, Screen, Strong } from '@/components/ui';
import type { PaymentMethod } from '@/contract/domain';
import { useAction, useApi } from '@/hooks/api';
import { date, humanize, inr, isISODate, period, todayISO } from '@/lib/format';
import { RECORD_METHODS } from '@/lib/labels';

/** Cash / UPI / bank transfer received in person. Amounts are checked by the API. */
export default function RecordPayment() {
  const router = useRouter();
  const { chargeId, studentId } = useLocalSearchParams<{ chargeId: string; studentId?: string }>();
  // Only this resident's dues are fetched, then the one being paid is picked out.
  const charge = useApi(['charges', 'one', chargeId], async () =>
    (await payments.listCharges(studentId ? { studentId } : {})).find((c) => c.id === chargeId) ?? null);
  const record = useAction(payments.recordPayment);
  const [typedAmount, setAmount] = useState<string | null>(null);
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [paidOn, setPaidOn] = useState(todayISO());
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');

  // Until the user types, the amount is the full balance.
  const amount = typedAmount ?? (charge.data ? String(charge.data.balance) : '');

  if (charge.loading) return <Loading />;
  if (charge.error) return <Screen><ErrorState error={charge.error} onRetry={charge.refetch} /></Screen>;
  if (!charge.data) return <Screen><Body>This due was not found, or is already paid.</Body></Screen>;
  const c = charge.data;

  async function submit() {
    const n = Number(amount);
    const fe: Record<string, string> = {};
    if (!(n > 0)) fe.amount = 'Enter the amount received';
    else if (n > c.balance) fe.amount = `More than the ${inr(c.balance)} due`;
    if (!isISODate(paidOn)) fe.paidOn = 'Enter a date like 2026-11-20';
    else if (paidOn > todayISO()) fe.paidOn = "Can't be in the future";
    if (Object.keys(fe).length) { record.setFieldErrors(fe); return; }
    if (await record.run({ chargeId: c.id, amount: n, method, paidOn, reference: reference.trim(), note: note.trim() || undefined })) router.back();
  }

  return (
    <Screen>
      <Card>
        <Strong>{c.studentName} · {c.studentCode}</Strong>
        <Body>{humanize(c.kind ?? 'rent')} {period(c.period)} · due {date(c.dueDate)}</Body>
        <Body muted>Balance {inr(c.balance)}{c.paid ? ` (${inr(c.paid)} paid)` : ''}</Body>
      </Card>
      <Notice error={record.error} />
      <Field label="Amount received (₹)" value={amount} onChangeText={setAmount} error={record.fieldErrors.amount} keyboardType="numeric" />
      <Chips<PaymentMethod> label="Method" value={method} onChange={setMethod} options={RECORD_METHODS} />
      <DateField label="Received on" value={paidOn} onChange={setPaidOn} error={record.fieldErrors.paidOn} from={-1} shortcuts={[1, 0]} />
      <Field label={method === 'cash' ? 'Reference (optional)' : 'UTR / transaction id (recommended)'} value={reference} onChangeText={setReference} error={record.fieldErrors.reference} autoCapitalize="characters" />
      <Field label="Note (optional)" value={note} onChangeText={setNote} error={record.fieldErrors.note} />
      <Button title={`Record ${inr(Number(amount) || 0)}`} onPress={() => { void submit(); }} loading={record.busy} />
      <Body muted style={{ marginTop: 8 } as object}>A receipt is issued and the resident is notified.</Body>
    </Screen>
  );
}
