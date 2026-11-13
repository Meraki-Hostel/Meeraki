import { Text, View } from 'react-native';
import { rooms } from '@/api/services';
import { Body, Card, Empty, ErrorState, Loading, Screen, Strong } from '@/components/ui';
import { color, radius, space, tone } from '@/components/theme';
import { useApi } from '@/hooks/api';
import { humanize, inr } from '@/lib/format';

const BED_TONE = { available: tone.good, occupied: tone.info, unavailable: tone.neutral } as const;

/** Read-only bed board: who is where, what is free. */
export default function Rooms() {
  const list = useApi(['rooms'], () => rooms.list());
  if (list.loading) return <Loading />;
  if (list.error) return <Screen><ErrorState error={list.error} onRetry={list.refetch} /></Screen>;
  const all = list.data ?? [];
  const beds = all.flatMap((r) => r.beds);
  const free = beds.filter((b) => b.status === 'available').length;

  return (
    <Screen onRefresh={list.refetch} refreshing={list.refreshing}>
      <Body muted>{beds.length} beds · {free} free · {beds.filter((b) => b.status === 'occupied').length} occupied</Body>
      {all.length === 0 && <Empty title="No rooms yet" body="Rooms are added on the web app." icon="bed-outline" />}
      {all.map((r) => (
        <Card key={r.id}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Strong>Room {r.number}</Strong>
            <Body muted>Floor {r.floor} · {humanize(r.type)} · {inr(r.rent)}{r.ac ? ' · AC' : ''}</Body>
          </View>
          {r.status === 'maintenance' && <Body style={{ color: color.amber } as object}>Under maintenance</Body>}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.sm }}>
            {r.beds.map((b) => (
              <View key={b.id} accessibilityLabel={`Bed ${b.label}, ${b.status}${b.studentName ? `, ${b.studentName}` : ''}`}
                style={{ backgroundColor: BED_TONE[b.status].bg, borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: 6, minWidth: '45%', flexGrow: 1 }}>
                <Text style={{ color: BED_TONE[b.status].fg, fontWeight: '700' }}>Bed {b.label}</Text>
                <Text style={{ color: BED_TONE[b.status].fg }} numberOfLines={1}>
                  {b.status === 'occupied' ? b.studentName ?? 'Occupied' : b.status === 'available' ? 'Free' : b.unavailableReason || 'Unavailable'}
                </Text>
              </View>
            ))}
          </View>
        </Card>
      ))}
    </Screen>
  );
}
