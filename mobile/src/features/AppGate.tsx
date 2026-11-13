import * as Application from 'expo-application';
import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { Linking, Platform, View } from 'react-native';
import { app } from '@/api/services';
import { Body, Button, Title } from '@/components/ui';
import { color, space } from '@/components/theme';
import { mustUpdate } from '@/lib/version';

const STORE_URL = Platform.select({
  ios: process.env.EXPO_PUBLIC_APP_STORE_URL,
  android: process.env.EXPO_PUBLIC_PLAY_STORE_URL,
});

/**
 * Blocks the app when it is older than the server's MOBILE_MIN_VERSION (a
 * breaking API change). If the config can't be read (offline), the app is let
 * through: every screen handles being offline on its own.
 */
export function AppGate({ children }: { children: ReactNode }) {
  const { data } = useQuery({ queryKey: ['app-config'], queryFn: app.config, staleTime: 10 * 60_000, retry: 1 });
  const current = Application.nativeApplicationVersion ?? '0.0.0';
  if (data && mustUpdate(current, data.minVersion)) {
    return (
      <View style={{ flex: 1, backgroundColor: color.bg, justifyContent: 'center', padding: space.xl }}>
        <Title>Update required</Title>
        <Body>
          This version of StayPookie ({current}) no longer works with the server. Install the latest version ({data.latestVersion}) to continue.
        </Body>
        {STORE_URL ? (
          <Button title="Open the store" icon="download-outline" style={{ marginTop: space.lg }} onPress={() => { void Linking.openURL(STORE_URL); }} />
        ) : null}
      </View>
    );
  }
  return <>{children}</>;
}
