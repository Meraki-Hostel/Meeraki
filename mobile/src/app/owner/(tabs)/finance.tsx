import { useState } from 'react';
import { View } from 'react-native';
import { payments, properties } from '@/api/services';
import { Badge, Body, Card, Chips, Empty, ErrorState, Loading, Screen, Section, Stat, StatGrid, Strong } from '@/components/ui';
import { useApi } from '@/hooks/api';
import { date, humanize, inr, period } from '@/lib/format';
import { METHOD_LABELS } from '@/lib/labels';

type Tab = 'overdue' | 'payments';

/** Owner money view: read-only on the phone. Refunds and charge changes are on the web. */
export default function OwnerFinance() {
  const [propertyId, setPropertyId] = useState<string>('all');
  const [tab, setTab] = useState<Tab>('overdue');
  const props = useApi(['properties'], () => properties.list());
  const filter = propertyId === 'all' ? {} : { propertyId };
  const summary = useApi(['payments', 'summary', propertyId], () => payments.summary(filter));
  const overdue = useApi(['charges', 'overdue', propertyId], () => payments.listCharges({ ...filter, status: 'overdue' }), { enabled: tab === 'overdue' });
  const recent = useApi(['payments', 'list', propertyId], () => payments.listPayments(filter), { enabled: tab === 'payments' });

  return (
    <Screen onRefresh={() => { summary.refetch(); overdue.refetch(); recent.refetch(); }} refreshing={summary.refreshing}>
      {(props.data ?? []).length > 1 && (
        <Chips<string> value={propertyId} onChange={setPropertyId}
          options={[{ value: 'all', label: 'All properties' }, ...(props.data ?? []).map((p) => ({ value: p.id, label: p.name }))]} />
      )}
      {summary.error ? <ErrorState error={summary.error} onRetry={summary.refetch} /> : summary.data && (
        <StatGrid>
          <Stat label="Expected" value={inr(summary.data.expected)} />
          <Stat label="Collected" value={inr(summary.data.collected)} tone="good" />
          <Stat label={`Pending (${summary.data.pendingCount})`} value={inr(summary.data.pending)} tone="warn" />
          <Stat label={`Overdue (${summary.data.overdueCount})`} value={inr(summary.data.overdue)} tone={summary.data.overdue ? 'bad' : undefined} />
        </StatGrid>
      )}

      <Section title="Details">
        <Chips<Tab> value={tab} onChange={setTab} options={[{ value: 'overdue', label: 'Overdue' }, { value: 'payments', label: 'Payments' }]} />
        {tab === 'overdue' ? (
          overdue.loading ? <Loading /> : overdue.error ? <ErrorState error={overdue.error} onRetry={overdue.refetch} /> : (overdue.data ?? []).length === 0 ? (
            <Empty title="Nothing overdue" icon="checkmark-circle-outline" />
          ) : (overdue.data ?? []).map((c) => (
            <Card key={c.id}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Strong>{c.studentName}</Strong>
                <Strong>{inr(c.balance)}</Strong>
              </View>
              <Body muted>{c.propertyName}{c.roomNumber ? ` · Room ${c.roomNumber}` : ''} · {humanize(c.kind ?? 'rent')} {period(c.period)} · due {date(c.dueDate)}</Body>
            </Card>
          ))
        ) : (
          recent.loading ? <Loading /> : recent.error ? <ErrorState error={recent.error} onRetry={recent.refetch} /> : (recent.data ?? []).length === 0 ? (
            <Empty title="No payments yet" />
          ) : (recent.data ?? []).slice(0, 50).map((p) => (
            <Card key={p.id}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Strong>{p.studentName}</Strong>
                <Strong>{inr(p.amount)}</Strong>
              </View>
              <Body muted>{p.propertyName} · {METHOD_LABELS[p.method] ?? p.method} · {date(p.paidOn)}</Body>
              {p.status === 'simulated' && <Badge label="Test payment" tone="warn" />}
            </Card>
          ))
        )}
      </Section>
    </Screen>
  );
}
