import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { announcements } from '@/api/services';
import { Badge, Body, Button, Card, Empty, ErrorState, Loading, Screen, Strong } from '@/components/ui';
import { space } from '@/components/theme';
import { useApi } from '@/hooks/api';
import { ago } from '@/lib/format';

export default function Announcements() {
  const router = useRouter();
  const list = useApi(['announcements', 'all'], () => announcements.list());
  return (
    <Screen onRefresh={list.refetch} refreshing={list.refreshing}>
      <Button title="New announcement" icon="add" onPress={() => router.push('/manager/announcements/new')} style={{ marginBottom: space.md }} />
      {list.loading ? <Loading /> : list.error ? <ErrorState error={list.error} onRetry={list.refetch} /> : (list.data ?? []).length === 0 ? (
        <Empty title="No announcements" icon="megaphone-outline" />
      ) : (list.data ?? []).map((a) => (
        <Card key={a.id}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Badge label={a.category} tone={a.category === 'urgent' ? 'bad' : 'brand'} />
            <Badge label={a.status} />
          </View>
          <View style={{ marginTop: space.sm }}><Strong>{a.title}</Strong></View>
          <Body>{a.body.length > 220 ? `${a.body.slice(0, 220)}…` : a.body}</Body>
          <Body muted>{a.author} · {ago(a.publishedAt ?? a.createdAt)} · read by {a.readBy.length}</Body>
        </Card>
      ))}
    </Screen>
  );
}
