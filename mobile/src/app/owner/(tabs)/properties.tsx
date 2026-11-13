import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { properties } from '@/api/services';
import { Badge, Body, Card, Empty, ErrorState, Loading, Screen, Strong } from '@/components/ui';
import { useApi } from '@/hooks/api';
import { inr } from '@/lib/format';

export default function OwnerProperties() {
  const router = useRouter();
  const list = useApi(['properties'], () => properties.list());
  if (list.loading) return <Loading />;
  if (list.error) return <Screen><ErrorState error={list.error} onRetry={list.refetch} /></Screen>;
  return (
    <Screen onRefresh={list.refetch} refreshing={list.refreshing}>
      {(list.data ?? []).length === 0 && <Empty title="No properties yet" body="Add your first property on the web app." icon="business-outline" />}
      {(list.data ?? []).map((p) => (
        <Card key={p.id} onPress={() => router.push(`/owner/properties/${p.id}`)} accessibilityLabel={p.name}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Strong>{p.name}</Strong>
            <Badge label={p.status} />
          </View>
          <Body muted>{p.locality}, {p.city} · {p.stats.managerName ? `Manager: ${p.stats.managerName}` : 'No manager'}</Body>
          <Body>{p.stats.occupiedBeds}/{p.stats.beds} beds ({p.stats.occupancyPct}%) · {inr(p.stats.collectedRent)} of {inr(p.stats.expectedRent)}</Body>
        </Card>
      ))}
    </Screen>
  );
}
