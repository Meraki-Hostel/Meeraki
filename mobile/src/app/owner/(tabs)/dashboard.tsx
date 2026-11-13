import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import { analytics } from '@/api/services';
import { Body, Card, ErrorState, Loading, Row, Screen, Section, Stat, StatGrid } from '@/components/ui';
import { color, radius, space } from '@/components/theme';
import { useApi } from '@/hooks/api';
import { inr } from '@/lib/format';

export default function OwnerDashboard() {
  const router = useRouter();
  const o = useApi(['analytics', 'owner'], () => analytics.ownerOverview());
  const trends = useApi(['analytics', 'trends', 6], () => analytics.trends({ months: 6 }));
  const props = useApi(['analytics', 'comparison'], analytics.propertyComparison);

  if (o.loading) return <Loading />;
  if (o.error || !o.data) return <Screen><ErrorState error={o.error} onRetry={o.refetch} /></Screen>;
  const d = o.data;
  const points = trends.data ?? [];
  const max = Math.max(1, ...points.map((p) => p.expected));
  const delta = d.collection.collectionPct - d.lastMonthCollectionPct;

  return (
    <Screen onRefresh={() => { o.refetch(); trends.refetch(); props.refetch(); }} refreshing={o.refreshing}>
      <StatGrid>
        <Stat label="Occupancy" value={`${d.occupancyPct}%`} />
        <Stat label="Residents" value={String(d.students)} />
        <Stat label="Collected this month" value={inr(d.collection.collected)} tone="good" />
        <Stat label="Overdue" value={inr(d.collection.overdue)} tone={d.collection.overdue ? 'bad' : undefined} />
      </StatGrid>
      <Body muted style={{ marginTop: space.sm } as object}>
        {d.collection.collectionPct}% of {inr(d.collection.expected)} collected ({delta >= 0 ? '+' : ''}{delta} pts vs last month) · {d.occupiedBeds}/{d.beds} beds · {d.activeProperties} active properties
      </Body>

      {points.length > 0 && (
        <Section title="Collected vs expected · 6 months">
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 140, gap: space.sm }}
              accessibilityLabel={points.map((p) => `${p.label}: ${inr(p.collected)} of ${inr(p.expected)}`).join('; ')}>
              {points.map((p) => (
                <View key={p.period} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
                  <View style={{ width: '70%', height: `${(p.expected / max) * 100}%`, backgroundColor: color.sand, borderRadius: radius.sm, justifyContent: 'flex-end', overflow: 'hidden' }}>
                    <View style={{ height: `${p.expected ? (p.collected / p.expected) * 100 : 0}%`, backgroundColor: color.primary }} />
                  </View>
                  <Text style={{ fontSize: 11, color: color.dust, marginTop: 4 }}>{p.label}</Text>
                </View>
              ))}
            </View>
            <Body muted style={{ marginTop: space.sm } as object}>Dark: collected · light: expected</Body>
          </Card>
        </Section>
      )}

      <Section title="Properties">
        {props.error ? <ErrorState error={props.error} onRetry={props.refetch} /> : (
          <Card>
            {(props.data ?? []).map((p) => (
              <Row key={p.id} title={p.name} icon="business-outline"
                subtitle={`${p.stats.occupancyPct}% occupied · ${inr(p.stats.collectedRent)} / ${inr(p.stats.expectedRent)}${p.stats.openComplaints ? ` · ${p.stats.openComplaints} open complaints` : ''}`}
                onPress={() => router.push(`/owner/properties/${p.id}`)} />
            ))}
          </Card>
        )}
      </Section>
    </Screen>
  );
}
