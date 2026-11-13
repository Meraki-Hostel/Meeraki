import { useRouter } from 'expo-router';
import { analytics } from '@/api/services';
import { Badge, Body, Card, Row, Screen, Section } from '@/components/ui';
import { useApi } from '@/hooks/api';

export default function ManagerOperations() {
  const router = useRouter();
  const o = useApi(['analytics', 'manager'], analytics.managerOverview);
  const count = (n?: number, tone: 'warn' | 'bad' = 'warn') => (n ? <Badge label={String(n)} tone={tone} /> : undefined);
  return (
    <Screen onRefresh={o.refetch} refreshing={o.refreshing}>
      <Card>
        <Row title="Emergency alerts" icon="warning-outline" onPress={() => router.push('/manager/emergency')} />
        <Row title="Maintenance" icon="hammer-outline" right={count(o.data?.openMaintenance)} onPress={() => router.push('/manager/maintenance')} />
        <Row title="Inventory" icon="cube-outline" right={count(o.data?.lowStock, 'bad')} onPress={() => router.push('/manager/inventory')} />
        <Row title="Announcements" icon="megaphone-outline" onPress={() => router.push('/manager/announcements')} />
      </Card>
      <Section title="Residents & rooms">
        <Card>
          <Row title="Residents" icon="people-outline" onPress={() => router.push('/manager/students')} />
          <Row title="Rooms & beds" icon="bed-outline" onPress={() => router.push('/manager/rooms')} />
        </Card>
      </Section>
      <Body muted>Admitting a resident, editing rooms, staff, events and the activity log are on the web app.</Body>
    </Screen>
  );
}
