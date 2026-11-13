import { useRouter } from 'expo-router';
import { useState } from 'react';
import { visitors } from '@/api/services';
import { DateField } from '@/components/DateField';
import { Body, Button, Field, Notice, Screen } from '@/components/ui';
import { useAction } from '@/hooks/api';
import { isISODate, todayISO } from '@/lib/format';

export default function NewVisitor() {
  const router = useRouter();
  const [visitorName, setName] = useState('');
  const [visitorPhone, setPhone] = useState('');
  const [relation, setRelation] = useState('');
  const [visitDate, setDate] = useState(todayISO());
  const [visitTime, setTime] = useState('17:00');
  const [purpose, setPurpose] = useState('');
  const create = useAction(visitors.create);

  async function submit() {
    const fe: Record<string, string> = {};
    if (!visitorName.trim()) fe.visitorName = "Visitor's name";
    if (!visitorPhone.trim()) fe.visitorPhone = "Visitor's phone number";
    if (!relation.trim()) fe.relation = 'e.g. Father, Friend';
    if (!isISODate(visitDate)) fe.visitDate = 'Enter a date like 2026-11-20';
    if (!/^\d{2}:\d{2}$/.test(visitTime)) fe.visitTime = 'Enter a time like 17:30';
    if (Object.keys(fe).length) { create.setFieldErrors(fe); return; }
    if (await create.run({ visitorName: visitorName.trim(), visitorPhone: visitorPhone.trim(), relation: relation.trim(), visitDate, visitTime, purpose: purpose.trim() })) router.back();
  }

  return (
    <Screen>
      <Body muted>The warden approves the visit, and security checks your visitor in at the gate.</Body>
      <Notice error={create.error} />
      <Field label="Visitor's name" value={visitorName} onChangeText={setName} error={create.fieldErrors.visitorName} />
      <Field label="Visitor's phone" value={visitorPhone} onChangeText={setPhone} error={create.fieldErrors.visitorPhone} keyboardType="phone-pad" />
      <Field label="Relation" value={relation} onChangeText={setRelation} error={create.fieldErrors.relation} placeholder="e.g. Father" />
      <DateField label="Date" value={visitDate} onChange={setDate} error={create.fieldErrors.visitDate} />
      <Field label="Time (24-hour)" value={visitTime} onChangeText={setTime} error={create.fieldErrors.visitTime} placeholder="17:30" keyboardType="numbers-and-punctuation" maxLength={5} />
      <Field label="Purpose" value={purpose} onChangeText={setPurpose} error={create.fieldErrors.purpose} placeholder="Optional" />
      <Button title="Register visitor" onPress={() => { void submit(); }} loading={create.busy} />
    </Screen>
  );
}
