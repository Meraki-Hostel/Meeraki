import { useRouter } from 'expo-router';
import { useState } from 'react';
import { students, visitors } from '@/api/services';
import { Body, Button, Card, Field, Notice, Row, Screen, Section } from '@/components/ui';
import type { StudentListItem } from '@/contract/interfaces';
import { useAction, useApi } from '@/hooks/api';
import { todayISO } from '@/lib/format';

/** Someone at the gate without a prior request: logged and checked in straight away. */
export default function WalkIn() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [student, setStudent] = useState<StudentListItem | null>(null);
  const [visitorName, setName] = useState('');
  const [visitorPhone, setPhone] = useState('');
  const [relation, setRelation] = useState('');
  const [purpose, setPurpose] = useState('');
  const found = useApi(['students', 'search', search], async () => (await students.list({ search })).filter((s) => s.status === 'active' || s.status === 'notice'), { enabled: search.trim().length >= 2 && !student });
  const create = useAction(visitors.createWalkIn);

  async function submit() {
    if (!student) return;
    const fe: Record<string, string> = {};
    if (!visitorName.trim()) fe.visitorName = "Visitor's name";
    if (!visitorPhone.trim()) fe.visitorPhone = "Visitor's phone number";
    if (!relation.trim()) fe.relation = 'e.g. Father, Friend';
    if (Object.keys(fe).length) { create.setFieldErrors(fe); return; }
    const now = new Date();
    const visitTime = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' }).format(now);
    if (await create.run({
      studentId: student.id, visitorName: visitorName.trim(), visitorPhone: visitorPhone.trim(), relation: relation.trim(),
      visitDate: todayISO(), visitTime, purpose: purpose.trim(),
    })) router.back();
  }

  return (
    <Screen>
      <Section title="Visiting">
        {student ? (
          <Card><Row title={student.name} subtitle={`${student.studentCode}${student.roomNumber ? ` · Room ${student.roomNumber}` : ''}`} icon="person-outline"
            right={<Button title="Change" variant="ghost" onPress={() => setStudent(null)} />} /></Card>
        ) : (
          <>
            <Field label="Find resident" value={search} onChangeText={setSearch} placeholder="Name, code or room" autoFocus />
            {search.trim().length >= 2 && (found.data ?? []).slice(0, 8).map((s) => (
              <Row key={s.id} title={s.name} subtitle={`${s.studentCode}${s.roomNumber ? ` · Room ${s.roomNumber}` : ''}`} onPress={() => setStudent(s)} />
            ))}
            {search.trim().length >= 2 && found.data?.length === 0 && <Body muted>No current resident matches.</Body>}
          </>
        )}
      </Section>
      {student && (
        <Section title="Visitor">
          <Notice error={create.error ?? (create.fieldErrors.studentId ? new Error(create.fieldErrors.studentId) : undefined)} />
          <Field label="Name" value={visitorName} onChangeText={setName} error={create.fieldErrors.visitorName} />
          <Field label="Phone" value={visitorPhone} onChangeText={setPhone} error={create.fieldErrors.visitorPhone} keyboardType="phone-pad" />
          <Field label="Relation" value={relation} onChangeText={setRelation} error={create.fieldErrors.relation} />
          <Field label="Purpose (optional)" value={purpose} onChangeText={setPurpose} />
          <Button title="Log and check in" icon="log-in-outline" onPress={() => { void submit(); }} loading={create.busy} />
        </Section>
      )}
    </Screen>
  );
}
