import { useLocalSearchParams } from 'expo-router';
import { Linking } from 'react-native';
import { staff } from '@/api/services';
import { Badge, Card, Empty, ErrorState, Loading, Row, Screen } from '@/components/ui';
import { useApi } from '@/hooks/api';
import { humanize } from '@/lib/format';

/** Staff directory (read-only): tap to call. */
export default function OwnerStaff() {
  const { propertyId } = useLocalSearchParams<{ propertyId?: string }>();
  const list = useApi(['staff', propertyId ?? 'all'], () => staff.list(propertyId ? { propertyId } : {}));
  if (list.loading) return <Loading />;
  if (list.error) return <Screen><ErrorState error={list.error} onRetry={list.refetch} /></Screen>;
  const rows = list.data ?? [];
  return (
    <Screen onRefresh={list.refetch} refreshing={list.refreshing}>
      {rows.length === 0 ? <Empty title="No staff yet" icon="people-outline" /> : (
        <Card>
          {rows.map((m) => (
            <Row key={m.id} title={m.name} subtitle={`${humanize(m.role)} · ${humanize(m.shift)} shift${m.propertyName ? ` · ${m.propertyName}` : ''}`}
              right={m.status !== 'active' ? <Badge label={m.status} /> : undefined}
              onPress={m.phone ? () => { void Linking.openURL(`tel:${m.phone}`); } : undefined} />
          ))}
        </Card>
      )}
    </Screen>
  );
}
