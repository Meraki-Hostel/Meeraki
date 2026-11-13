import { Redirect } from 'expo-router';
import { View } from 'react-native';
import { useSession } from '@/auth/session';
import { Body, Button, Loading, Title } from '@/components/ui';
import { color, space } from '@/components/theme';
import { HOME } from '@/lib/links';

export default function Index() {
  const { status, user, offline, retry } = useSession();
  if (offline) {
    return (
      <View style={{ flex: 1, backgroundColor: color.bg, justifyContent: 'center', padding: space.xl }}>
        <Title>You&apos;re offline</Title>
        <Body muted>StayPookie couldn&apos;t reach the server to check your sign-in. Check your connection and try again.</Body>
        <Button title="Try again" icon="refresh" onPress={retry} style={{ marginTop: space.lg }} />
      </View>
    );
  }
  if (status === 'loading') return <View style={{ flex: 1, backgroundColor: color.bg }}><Loading /></View>;
  if (status === 'signedIn' && user) return <Redirect href={HOME[user.role] as never} />;
  return <Redirect href="/login" />;
}
