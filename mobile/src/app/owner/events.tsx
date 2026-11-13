import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { events } from '@/api/services';
import { Badge, Body, Card, Empty, ErrorState, Loading, Screen, Strong } from '@/components/ui';
import { useApi } from '@/hooks/api';
import { date, humanize } from '@/lib/format';

export default function OwnerEvents() {
  const { propertyId } = useLocalSearchParams<{ propertyId?: string }>();
  const list = useApi(['events', propertyId ?? 'all'], () => events.list(propertyId ? { propertyId } : {}));
  if (list.loading) return <Loading />;
  if (list.error) return <Screen><ErrorState error={list.error} onRetry={list.refetch} /></Screen>;
  const rows = [...(list.data ?? [])].sort((a, b) => b.date.localeCompare(a.date));
  return (
    <Screen onRefresh={list.refetch} refreshing={list.refreshing}>
      {rows.length === 0 && <Empty title="No events" icon="calendar-outline" />}
      {rows.map((e) => (
        <Card key={e.id}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Strong>{e.title}</Strong>
            <Badge label={e.status} />
          </View>
          <Body>{date(e.date)} · {e.startTime}–{e.endTime} · {e.location}</Body>
          <Body muted>{e.propertyName} · {humanize(e.category)} · {e.expectedAttendance}/{e.capacity} expected</Body>
        </Card>
      ))}
    </Screen>
  );
}
