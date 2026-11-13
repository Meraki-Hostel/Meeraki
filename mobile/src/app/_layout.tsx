import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as Notifications from 'expo-notifications';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { notifications } from '@/api/services';
import { SessionProvider, useSession } from '@/auth/session';
import { color } from '@/components/theme';
import type { PushData } from '@/contract/mobile';
import { AppGate } from '@/features/AppGate';
import { appRouteFor } from '@/lib/links';

export default function RootLayout() {
  const [client] = useState(() => new QueryClient({
    defaultOptions: {
      queries: { retry: (n, e) => n < 2 && (e as { code?: string })?.code === 'UNAVAILABLE', staleTime: 30_000 },
      mutations: { retry: false },
    },
  }));
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={client}>
        <SessionProvider>
          <StatusBar style="dark" />
          <AppGate>
            <RootStack />
          </AppGate>
        </SessionProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

function RootStack() {
  const { status, user } = useSession();
  const signedIn = status === 'signedIn' && !!user;
  useOpenTappedNotification();
  return (
    <Stack screenOptions={{
      headerStyle: { backgroundColor: color.bg }, headerTintColor: color.ink, headerShadowVisible: false,
      contentStyle: { backgroundColor: color.bg }, headerBackButtonDisplayMode: 'minimal',
    }}>
      {/* Decides where to go: loading / offline / sign-in / the role's home. */}
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Protected guard={status === 'signedOut'}>
        <Stack.Screen name="login" options={{ headerShown: false }} />
      </Stack.Protected>
      {/* Client-side only: the API enforces every role rule itself. */}
      <Stack.Protected guard={signedIn && user?.role === 'student'}>
        <Stack.Screen name="student" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && user?.role === 'manager'}>
        <Stack.Screen name="manager" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && user?.role === 'owner'}>
        <Stack.Screen name="owner" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="notifications" options={{ title: 'Notifications' }} />
        <Stack.Screen name="account/password" options={{ title: 'Change password' }} />
      </Stack.Protected>
    </Stack>
  );
}

/** A tapped push opens the screen its link points to, once signed in. */
function useOpenTappedNotification() {
  const router = useRouter();
  const { status, user } = useSession();
  const last = Notifications.useLastNotificationResponse();
  const handled = useRef<string | null>(null);
  useEffect(() => {
    if (status !== 'signedIn' || !user || !last) return;
    const id = last.notification.request.identifier;
    if (handled.current === id) return;
    handled.current = id;
    const data = (last.notification.request.content.data ?? {}) as Partial<PushData>;
    if (data.notificationId) void notifications.markRead(data.notificationId, true).catch(() => undefined);
    router.push(appRouteFor(data.link, user.role) as never);
  }, [last, status, user, router]);
}
