import { useState } from 'react';
import { students } from '@/api/services';
import { Body, Button, Card, ErrorState, Field, Loading, Notice, Row, Screen, Section } from '@/components/ui';
import type { StudentSelfUpdate } from '@/contract/interfaces';
import { useAction, useApi } from '@/hooks/api';
import { date } from '@/lib/format';

export default function StudentProfile() {
  const me = useApi(['students', 'me'], students.me);
  const save = useAction(students.updateSelf);
  // What the user has changed so far, layered over the saved values.
  const [edits, setEdits] = useState<Partial<StudentSelfUpdate>>({});

  if (me.loading) return <Loading />;
  if (me.error || !me.data) return <Screen><ErrorState error={me.error} onRetry={me.refetch} /></Screen>;
  const s = me.data.student;
  const form: StudentSelfUpdate = {
    email: s.email, phone: s.phone, address: s.address, emergencyName: s.emergencyName, emergencyPhone: s.emergencyPhone, bloodGroup: s.bloodGroup,
    ...edits,
  };
  const set = (k: keyof StudentSelfUpdate) => (v: string) => setEdits({ ...edits, [k]: v });

  return (
    <Screen>
      <Card>
        <Row title={s.name} subtitle={`${s.studentCode} · ${s.college}`} icon="person-outline" />
        <Row title="Joined" subtitle={date(s.joinedOn)} icon="calendar-outline" />
        <Row title="Guardian" subtitle={`${s.guardianName} (${s.guardianRelation}) · ${s.guardianPhone}`} icon="people-outline" />
      </Card>
      <Body muted>Name, college and guardian details are kept by the hostel office. Ask the warden to change them.</Body>

      <Section title="Your contact details">
        <Notice error={save.error} />
        {save.done && <Notice message="Saved." tone="good" />}
        <Field label="Email" value={form.email} onChangeText={set('email')} error={save.fieldErrors.email} keyboardType="email-address" autoCapitalize="none" />
        <Field label="Phone" value={form.phone} onChangeText={set('phone')} error={save.fieldErrors.phone} keyboardType="phone-pad" />
        <Field label="Home address" value={form.address} onChangeText={set('address')} error={save.fieldErrors.address} multiline />
        <Field label="Blood group" value={form.bloodGroup} onChangeText={set('bloodGroup')} error={save.fieldErrors.bloodGroup} autoCapitalize="characters" maxLength={4} />
        <Field label="Emergency contact name" value={form.emergencyName} onChangeText={set('emergencyName')} error={save.fieldErrors.emergencyName} />
        <Field label="Emergency contact phone" value={form.emergencyPhone} onChangeText={set('emergencyPhone')} error={save.fieldErrors.emergencyPhone} keyboardType="phone-pad" />
        <Button title="Save" onPress={() => { void save.run(form); }} loading={save.busy} />
      </Section>
    </Screen>
  );
}
