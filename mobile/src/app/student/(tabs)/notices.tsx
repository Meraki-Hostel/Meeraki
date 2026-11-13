import { View } from 'react-native';
import { announcements } from '@/api/services';
import { Badge, Body, Card, Empty, ErrorState, Loading, Screen, Strong } from '@/components/ui';
import { color, space } from '@/components/theme';
import { useAction, useApi } from '@/hooks/api';
import { ago } from '@/lib/format';

export default function StudentNotices() {
  const list = useApi(['announcements', 'published'], () => announcements.list({ status: 'published' }));
  const markRead = useAction(announcements.markRead);

  if (list.loading) return <Loading />;
  if (list.error) return <Screen><ErrorState error={list.error} onRetry={list.refetch} /></Screen>;
  const rows = list.data ?? [];

  return (
    <Screen onRefresh={list.refetch} refreshing={list.refreshing}>
      {rows.length === 0 && <Empty title="No notices" body="Notices from your hostel show up here." icon="megaphone-outline" />}
      {rows.map((a) => (
        <Card key={a.id} accessibilityLabel={a.title}
          onPress={a.isRead === false ? () => { void markRead.run(a.id, true); } : undefined}
          style={a.isRead === false && { borderColor: color.primary }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Badge label={a.category} tone={a.category === 'urgent' ? 'bad' : 'brand'} />
            <Body muted>{ago(a.publishedAt ?? a.createdAt)}</Body>
          </View>
          <View style={{ marginTop: space.sm }}><Strong>{a.title}</Strong></View>
          <Body>{a.body}</Body>
          {a.isRead === false && <Body muted style={{ marginTop: space.sm } as object}>Tap to mark as read</Body>}
        </Card>
      ))}
    </Screen>
  );
}
