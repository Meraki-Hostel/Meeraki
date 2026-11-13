import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';
import { payments } from '@/api/services';
import { Badge, Body, Button, Card, Chips, Empty, ErrorState, Loading, Notice, Screen, Section, Stat, StatGrid, Strong } from '@/components/ui';
import { space } from '@/components/theme';
import type { ChargeStatus } from '@/contract/domain';
import { useAction, useApi } from '@/hooks/api';
import { date, humanize, inr, period } from '@/lib/format';
import { METHOD_LABELS } from '@/lib/labels';

type View_ = 'overdue' | 'pending' | 'partial' | 'recent';

export default function ManagerPayments() {
  const router = useRouter();
  const [show, setShow] = useState<View_>('overdue');
  const summary = useApi(['payments', 'summary'], () => payments.summary());
  const charges = useApi(['charges', show], () => payments.listCharges({ status: show as ChargeStatus }), { enabled: show !== 'recent' });
  const recent = useApi(['payments', 'recent'], () => payments.listPayments(), { enabled: show === 'recent' });
  const remind = useAction(payments.sendReminders);

  const rows = charges.data ?? [];
  function sendReminders() {
    const ids = rows.map((c) => c.id);
    Alert.alert(`Remind ${ids.length} resident${ids.length > 1 ? 's' : ''}?`, 'Each gets an in-app notification (and email, if set up) about their due.', [
      { text: 'Cancel', style: 'cancel' }, { text: 'Send', onPress: () => { void remind.run(ids); } },
    ]);
  }

  return (
    <Screen onRefresh={() => { summary.refetch(); charges.refetch(); recent.refetch(); }} refreshing={summary.refreshing}>
      {summary.data && (
        <StatGrid>
          <Stat label="Collected this month" value={inr(summary.data.collected)} tone="good" />
          <Stat label={`Overdue (${summary.data.overdueCount})`} value={inr(summary.data.overdue)} tone={summary.data.overdue ? 'bad' : undefined} />
          <Stat label={`Pending (${summary.data.pendingCount})`} value={inr(summary.data.pending)} tone="warn" />
          <Stat label="Collection" value={`${summary.data.collectionPct}%`} />
        </StatGrid>
      )}
      {summary.error && <ErrorState error={summary.error} onRetry={summary.refetch} />}

      <Section title="Dues">
        <Chips<View_> value={show} onChange={setShow}
          options={[{ value: 'overdue', label: 'Overdue' }, { value: 'pending', label: 'Pending' }, { value: 'partial', label: 'Part-paid' }, { value: 'recent', label: 'Recent payments' }]} />
        {remind.done && <Notice message="Reminders sent." tone="good" />}
        <Notice error={remind.error} />

        {show === 'recent' ? (
          recent.loading ? <Loading /> : recent.error ? <ErrorState error={recent.error} onRetry={recent.refetch} /> : (recent.data ?? []).slice(0, 50).map((p) => (
            <Card key={p.id}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Strong>{p.studentName}</Strong>
                <Strong>{inr(p.amount)}</Strong>
              </View>
              <Body muted>{METHOD_LABELS[p.method] ?? p.method} · {date(p.paidOn)} · {p.receiptNo}</Body>
            </Card>
          ))
        ) : charges.loading ? <Loading /> : charges.error ? <ErrorState error={charges.error} onRetry={charges.refetch} /> : rows.length === 0 ? (
          <Empty title="Nothing due here" icon="checkmark-circle-outline" />
        ) : (
          <>
            <Button title={`Send reminders (${rows.length})`} icon="notifications-outline" variant="secondary" onPress={sendReminders} loading={remind.busy} style={{ marginBottom: space.md }} />
            {rows.map((c) => (
              <Card key={c.id}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Strong>{c.studentName}</Strong>
                  <Badge label={c.status} />
                </View>
                <Body>{inr(c.balance)} due · {humanize(c.kind ?? 'rent')} {period(c.period)}</Body>
                <Body muted>{c.studentCode}{c.roomNumber ? ` · Room ${c.roomNumber}` : ''} · due {date(c.dueDate)}</Body>
                <Button title="Record payment" icon="cash-outline" onPress={() => router.push({ pathname: '/manager/record-payment', params: { chargeId: c.id, studentId: c.studentId } })} style={{ marginTop: space.sm }} />
              </Card>
            ))}
          </>
        )}
      </Section>
    </Screen>
  );
}
