import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import { notifications } from '@/api/services';
import { useUser } from '@/auth/session';
import { Button, Card, Empty, ErrorState, Loading, Screen } from '@/components/ui';
import { color, space } from '@/components/theme';
import { useAction, useApi } from '@/hooks/api';
import { ago } from '@/lib/format';
import { appRouteFor, NOTIFICATIONS_ROUTE } from '@/lib/links';

export default function NotificationsScreen() {
  const router = useRouter();
  const user = useUser();
  const list = useApi(['notifications'], () => notifications.list());
  const markRead = useAction(notifications.markRead);
  const markAll = useAction(notifications.markAllRead);

  if (list.loading) return <Loading />;
  if (list.error) return <Screen><ErrorState error={list.error} onRetry={list.refetch} /></Screen>;
  const rows = list.data ?? [];
  const unread = rows.filter((n) => !n.read).length;

  return (
    <Screen onRefresh={list.refetch} refreshing={list.refreshing}>
      {unread > 0 && <Button title={`Mark all ${unread} as read`} variant="secondary" icon="checkmark-done" onPress={() => { void markAll.run(); }} loading={markAll.busy} style={{ marginBottom: space.md }} />}
      {rows.length === 0 && <Empty title="No notifications" body="Updates about rent, requests and notices show up here." icon="notifications-off-outline" />}
      {rows.map((n) => {
        const to = appRouteFor(n.link, user.role);
        return (
          <Card key={n.id} accessibilityLabel={n.title} onPress={() => {
            if (!n.read) void markRead.run(n.id, true);
            if (to !== NOTIFICATIONS_ROUTE) router.push(to as never);
          }} style={!n.read && { borderColor: color.primary }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontWeight: n.read ? '500' : '700', color: color.ink, fontSize: 16, flex: 1 }}>{n.title}</Text>
              <Text style={{ color: color.mute, fontSize: 12, marginLeft: space.sm }}>{ago(n.createdAt)}</Text>
            </View>
            <Text style={{ color: color.bark, marginTop: 4 }}>{n.body}</Text>
          </Card>
        );
      })}
    </Screen>
  );
}
