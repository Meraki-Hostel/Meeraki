import { useLocalSearchParams, useRouter } from 'expo-router';
import { Linking, View } from 'react-native';
import { students } from '@/api/services';
import { Badge, Body, Button, Card, ErrorState, Loading, Row, Screen, Section, Strong } from '@/components/ui';
import { space } from '@/components/theme';
import { useApi } from '@/hooks/api';
import { date, humanize, inr, period } from '@/lib/format';
import { METHOD_LABELS } from '@/lib/labels';

/** Read-only resident card for a manager on the move. Editing is on the web. */
export default function Resident() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const d = useApi(['students', id], () => students.get(id));
  if (d.loading) return <Loading />;
  if (d.error || !d.data) return <Screen><ErrorState error={d.error} onRetry={d.refetch} /></Screen>;
  const { student: s, charges, payments } = d.data;
  const due = charges.filter((c) => c.balance > 0);
  const call = (n: string) => { void Linking.openURL(`tel:${n}`); };

  return (
    <Screen onRefresh={d.refetch} refreshing={d.refreshing}>
      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Strong>{s.name}</Strong>
          <Badge label={s.status} />
        </View>
        <Body muted>{s.studentCode} · {s.roomNumber ? `Room ${s.roomNumber}${s.bedLabel ? `-${s.bedLabel}` : ''}` : 'No bed'} · {s.propertyName}</Body>
        <Body muted>{s.college}, {s.course} (year {s.year}) · joined {date(s.joinedOn)}</Body>
        <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.sm }}>
          <Button title="Call" icon="call-outline" variant="secondary" onPress={() => call(s.phone)} style={{ flex: 1 }} />
          {!!s.guardianPhone && <Button title="Guardian" icon="call-outline" variant="secondary" onPress={() => call(s.guardianPhone)} style={{ flex: 1 }} />}
        </View>
      </Card>

      <Section title="Emergency">
        <Card>
          <Row title={`${s.emergencyName || '—'} · ${s.emergencyPhone || '—'}`} subtitle={`Blood group ${s.bloodGroup || '—'}`} icon="medkit-outline"
            onPress={s.emergencyPhone ? () => call(s.emergencyPhone) : undefined} />
          <Row title={`${s.guardianName} (${s.guardianRelation})`} subtitle={s.guardianPhone} icon="people-outline" />
        </Card>
      </Section>

      <Section title={`Dues · ${inr(due.reduce((a, c) => a + c.balance, 0))}`}>
        {due.length === 0 ? <Body muted>Nothing due.</Body> : due.map((c) => (
          <Card key={c.id}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Strong>{inr(c.balance)} · {humanize(c.kind ?? 'rent')} {period(c.period)}</Strong>
              <Badge label={c.status} />
            </View>
            <Body muted>Due {date(c.dueDate)}</Body>
            <Button title="Record payment" icon="cash-outline" onPress={() => router.push({ pathname: '/manager/record-payment', params: { chargeId: c.id, studentId: s.id } })} style={{ marginTop: space.sm }} />
          </Card>
        ))}
      </Section>

      <Section title="Payments">
        {payments.length === 0 ? <Body muted>No payments yet.</Body> : (
          <Card>
            {[...payments].sort((a, b) => b.paidOn.localeCompare(a.paidOn)).slice(0, 12).map((p) => (
              <Row key={p.id} title={`${inr(p.amount)} · ${METHOD_LABELS[p.method] ?? p.method}`} subtitle={`${date(p.paidOn)} · ${p.receiptNo}`} />
            ))}
          </Card>
        )}
      </Section>
    </Screen>
  );
}
