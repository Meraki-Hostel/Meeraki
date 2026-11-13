import * as Application from 'expo-application';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { Platform } from 'react-native';
import { app } from '@/api/services';
import { tokens } from '@/api/tokens';

/**
 * Registers this phone for push after sign-in. Quietly does nothing when push
 * can't work here (simulator, permission denied, server has PUSH_MODE=disabled,
 * no EAS project id in a local build) — push is a convenience; the in-app
 * notifications list always works.
 */
export async function registerForPush(): Promise<'registered' | 'unavailable' | 'denied'> {
  try {
    if (!Device.isDevice) return 'unavailable';
    const config = await app.config();
    if (!config.pushEnabled) return 'unavailable';

    if (Platform.OS === 'android') {
      // Must exist before the permission prompt can appear on Android 13+.
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Notifications',
        importance: AndroidImportance.HIGH,
      });
    }
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') status = (await Notifications.requestPermissionsAsync()).status;
    if (status !== 'granted') return 'denied';

    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) return 'unavailable';
    const { data: pushToken } = await Notifications.getExpoPushTokenAsync({ projectId });

    await app.registerDevice({
      pushToken,
      platform: Platform.OS === 'ios' ? 'ios' : 'android',
      appVersion: Application.nativeApplicationVersion ?? undefined,
    });
    await tokens.setPushToken(pushToken);
    return 'registered';
  } catch {
    return 'unavailable';
  }
}

/** Called before sign-out, while the access token still works. */
export async function unregisterPush(): Promise<void> {
  const pushToken = await tokens.pushToken();
  if (!pushToken) return;
  try { await app.unregisterDevice(pushToken); } catch { /* the server drops dead tokens on its own */ }
  await tokens.setPushToken(null);
}
