import { useRouter } from 'expo-router';
import { useState } from 'react';
import { leave } from '@/api/services';
import { useUser } from '@/auth/session';
import { DateField } from '@/components/DateField';
import { Button, Field, Notice, Screen } from '@/components/ui';
import { useAction } from '@/hooks/api';
import { addDaysISO, isISODate, todayISO } from '@/lib/format';

export default function NewLeave() {
  const router = useRouter();
  const user = useUser();
  const [from, setFrom] = useState(addDaysISO(todayISO(), 1));
  const [to, setTo] = useState(addDaysISO(todayISO(), 3));
  const [destination, setDestination] = useState('');
  const [contactPhone, setContactPhone] = useState(user.phone ?? '');
  const [reason, setReason] = useState('');
  const create = useAction(leave.create);

  async function submit() {
    const fe: Record<string, string> = {};
    if (!isISODate(from)) fe.from = 'Enter a date like 2026-11-20';
    if (!isISODate(to)) fe.to = 'Enter a date like 2026-11-22';
    else if (isISODate(from) && to < from) fe.to = 'Must be on or after the start date';
    if (!destination.trim()) fe.destination = 'Where are you going?';
    if (!contactPhone.trim()) fe.contactPhone = 'A number to reach you on';
    if (!reason.trim()) fe.reason = 'Add a reason';
    if (Object.keys(fe).length) { create.setFieldErrors(fe); return; }
    if (await create.run({ from, to, destination: destination.trim(), contactPhone: contactPhone.trim(), reason: reason.trim() })) router.back();
  }

  return (
    <Screen>
      <Notice error={create.error} />
      <DateField label="Leaving on" value={from} onChange={setFrom} error={create.fieldErrors.from} />
      <DateField label="Back on" value={to} onChange={setTo} error={create.fieldErrors.to} shortcuts={[1, 2, 7]} from={0} />
      <Field label="Going to" value={destination} onChangeText={setDestination} error={create.fieldErrors.destination} placeholder="e.g. Home, Jaipur" />
      <Field label="Phone while away" value={contactPhone} onChangeText={setContactPhone} error={create.fieldErrors.contactPhone} keyboardType="phone-pad" />
      <Field label="Reason" value={reason} onChangeText={setReason} error={create.fieldErrors.reason} multiline />
      <Button title="Apply" onPress={() => { void submit(); }} loading={create.busy} />
    </Screen>
  );
}
