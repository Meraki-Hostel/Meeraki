import { useLocalSearchParams, useRouter } from 'expo-router';
import { Linking } from 'react-native';
import { properties } from '@/api/services';
import { Badge, Body, Button, Card, ErrorState, Loading, Row, Screen, Section, Stat, StatGrid, Strong } from '@/components/ui';
import { space } from '@/components/theme';
import { useApi } from '@/hooks/api';
import { date, humanize, inr } from '@/lib/format';

export default function OwnerProperty() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const p = useApi(['properties', id], () => properties.get(id));
  if (p.loading) return <Loading />;
  if (p.error || !p.data) return <Screen><ErrorState error={p.error} onRetry={p.refetch} /></Screen>;
  const x = p.data;
  return (
    <Screen onRefresh={p.refetch} refreshing={p.refreshing}>
      <Card>
        <Strong>{x.name}</Strong>
        <Body muted>{x.code} · {humanize(x.type)} · opened {date(x.openedOn)}</Body>
        <Body muted>{x.address}, {x.locality}, {x.city} {x.pincode}</Body>
        <Badge label={x.status} />
        {!!x.phone && <Button title={`Call ${x.phone}`} icon="call-outline" variant="secondary" onPress={() => { void Linking.openURL(`tel:${x.phone}`); }} style={{ marginTop: space.sm }} />}
      </Card>
      <StatGrid>
        <Stat label="Occupancy" value={`${x.stats.occupancyPct}%`} />
        <Stat label="Free beds" value={String(x.stats.availableBeds)} />
        <Stat label="Collected" value={inr(x.stats.collectedRent)} tone="good" />
        <Stat label="Expected" value={inr(x.stats.expectedRent)} />
      </StatGrid>
      <Section title="More">
        <Card>
          <Row title="Manager" subtitle={x.stats.managerName ?? 'Not assigned'} icon="person-outline" />
          <Row title="Open complaints" subtitle={String(x.stats.openComplaints ?? 0)} icon="chatbubbles-outline" onPress={() => router.push('/owner/complaints')} />
          <Row title="Staff" icon="people-outline" onPress={() => router.push({ pathname: '/owner/staff', params: { propertyId: x.id } })} />
          <Row title="Events" icon="calendar-outline" onPress={() => router.push({ pathname: '/owner/events', params: { propertyId: x.id } })} />
        </Card>
      </Section>
      <Body muted>Editing a property, rooms and payout accounts is on the web app.</Body>
    </Screen>
  );
}
