import { useRouter } from 'expo-router';
import { analytics, emergency, visitors } from '@/api/services';
import { Body, Button, Card, ErrorState, Loading, Row, Screen, Section, Stat, StatGrid, Strong } from '@/components/ui';
import { space } from '@/components/theme';
import { useApi } from '@/hooks/api';
import { ago, inr, todayISO } from '@/lib/format';

export default function ManagerToday() {
  const router = useRouter();
  const o = useApi(['analytics', 'manager'], analytics.managerOverview);
  const alerts = useApi(['emergency', 'open'], () => emergency.list({ status: 'open' }));
  const today = useApi(['visitors', 'today'], () => visitors.list({ date: todayISO() }));

  if (o.loading) return <Loading />;
  if (o.error || !o.data) return <Screen><ErrorState error={o.error} onRetry={o.refetch} /></Screen>;
  const { property, collection } = o.data;
  const open = alerts.data ?? [];
  const expected = (today.data ?? []).filter((v) => v.status === 'approved' || v.status === 'checked_in');

  return (
    <Screen onRefresh={() => { o.refetch(); alerts.refetch(); today.refetch(); }} refreshing={o.refreshing}>
      <Strong>{property.name}</Strong>
      <Body muted>{property.locality}, {property.city}</Body>

      {open.length > 0 && (
        <Card style={{ marginTop: space.md, borderColor: '#b0473e', borderWidth: 2 }} onPress={() => router.push('/manager/emergency')} accessibilityLabel="Open emergency alerts">
          <Strong>🚨 {open.length} open emergency alert{open.length > 1 ? 's' : ''}</Strong>
          {open.slice(0, 2).map((a) => <Body key={a.id}>{a.studentName}{a.roomNumber ? ` (Room ${a.roomNumber})` : ''}: {a.message} · {ago(a.createdAt)}</Body>)}
          <Button title="Respond" variant="danger" onPress={() => router.push('/manager/emergency')} style={{ marginTop: space.sm }} />
        </Card>
      )}

      <Section title="Today">
        <StatGrid>
          <Stat label="Pending leave" value={String(o.data.pendingLeaves ?? 0)} tone={o.data.pendingLeaves ? 'warn' : undefined} />
          <Stat label="Open complaints" value={String(o.data.openComplaints ?? 0)} tone={o.data.urgentComplaints ? 'bad' : undefined} />
          <Stat label="Visitors today" value={String(o.data.visitorsToday ?? expected.length)} />
          <Stat label="Occupancy" value={`${property.stats.occupancyPct}%`} />
        </StatGrid>
      </Section>

      <Section title="Rent this month">
        <StatGrid>
          <Stat label="Collected" value={inr(collection.collected)} tone="good" />
          <Stat label="Overdue" value={inr(collection.overdue)} tone={collection.overdue ? 'bad' : undefined} />
        </StatGrid>
        <Body muted style={{ marginTop: space.sm } as object}>{collection.collectionPct}% of {inr(collection.expected)} collected · {collection.overdueCount} overdue</Body>
      </Section>

      <Section title="Jump to">
        <Card>
          <Row title="Approve requests" icon="checkmark-done-outline" onPress={() => router.push('/manager/requests')} />
          <Row title="Record a payment" icon="cash-outline" onPress={() => router.push('/manager/payments')} />
          <Row title="Log a walk-in visitor" icon="person-add-outline" onPress={() => router.push('/manager/visitors/walk-in')} />
          <Row title="Find a resident" icon="search-outline" onPress={() => router.push('/manager/students')} />
          {!!o.data.openMaintenance && <Row title={`${o.data.openMaintenance} open maintenance tickets`} icon="hammer-outline" onPress={() => router.push('/manager/maintenance')} />}
          {!!o.data.lowStock && <Row title={`${o.data.lowStock} items low on stock`} icon="cube-outline" onPress={() => router.push('/manager/inventory')} />}
        </Card>
      </Section>
    </Screen>
  );
}
