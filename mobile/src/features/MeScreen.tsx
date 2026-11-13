import * as Application from 'expo-application';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Alert, View } from 'react-native';
import { notifications } from '@/api/services';
import { useSession, useUser } from '@/auth/session';
import { Badge, Body, Card, Row, Screen, Section, Strong, type IconName } from '@/components/ui';
import { space } from '@/components/theme';
import { useApi } from '@/hooks/api';
import { humanize } from '@/lib/format';

const WEB_URL = (process.env.EXPO_PUBLIC_WEB_URL ?? '').replace(/\/+$/, '');

export interface MeLink { title: string; icon: IconName; href: string; subtitle?: string }

/** The "Me" tab for every role: who you are, role-specific links, account. */
export function MeScreen({ links = [], webNote }: { links?: MeLink[]; webNote?: string }) {
  const router = useRouter();
  const user = useUser();
  const { signOut } = useSession();
  const unread = useApi(['notifications', 'unread'], () => notifications.list({ unreadOnly: true }));
  const unreadCount = unread.data?.length ?? 0;

  function confirmSignOut(everywhere: boolean) {
    Alert.alert(
      everywhere ? 'Sign out everywhere?' : 'Sign out?',
      everywhere ? 'This ends your session on every phone and browser, including this one.' : undefined,
      [{ text: 'Cancel', style: 'cancel' }, { text: 'Sign out', style: 'destructive', onPress: () => { void signOut({ everywhere }); } }],
    );
  }

  return (
    <Screen onRefresh={unread.refetch} refreshing={unread.refreshing}>
      <Card>
        <Strong>{user.name}</Strong>
        <Body muted>{user.email}</Body>
        <Body muted>{user.phone}</Body>
        <View style={{ marginTop: space.sm }}><Badge label={user.title || humanize(user.role)} tone="brand" /></View>
      </Card>

      <Card>
        <Row title="Notifications" icon="notifications-outline" onPress={() => router.push('/notifications')}
          right={unreadCount ? <Badge label={`${unreadCount} new`} tone="bad" /> : undefined} />
        {links.map((l) => <Row key={l.href} title={l.title} subtitle={l.subtitle} icon={l.icon} onPress={() => router.push(l.href as never)} />)}
      </Card>

      <Section title="Account">
        <Card>
          <Row title="Change password" icon="key-outline" onPress={() => router.push('/account/password')} />
          {WEB_URL ? (
            <Row title="Open StayPookie on the web" subtitle={webNote} icon="globe-outline" onPress={() => { void WebBrowser.openBrowserAsync(WEB_URL); }} />
          ) : null}
          <Row title="Sign out" icon="log-out-outline" onPress={() => confirmSignOut(false)} />
          <Row title="Sign out everywhere" icon="exit-outline" onPress={() => confirmSignOut(true)} />
        </Card>
      </Section>
      <Body muted style={{ textAlign: 'center', marginTop: space.md } as object}>
        StayPookie {Application.nativeApplicationVersion ?? ''} ({Application.nativeBuildVersion ?? 'dev'})
      </Body>
    </Screen>
  );
}
