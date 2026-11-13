import * as SecureStore from 'expo-secure-store';

// The access token lives in memory only (15 min). The refresh token (30 days)
// lives in the Keychain / Keystore, never in AsyncStorage. The push token is
// kept so sign-out can unregister this phone.
const REFRESH_KEY = 'staypookie.refreshToken';
const PUSH_KEY = 'staypookie.pushToken';
const OPTS: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK };

let access: string | null = null;
let refresh: string | null = null;
let loaded = false;

export const tokens = {
  get access() { return access; },

  async refreshToken(): Promise<string | null> {
    if (!loaded) {
      refresh = await SecureStore.getItemAsync(REFRESH_KEY, OPTS).catch(() => null);
      loaded = true;
    }
    return refresh;
  },

  async set(next: { accessToken?: string; refreshToken?: string }) {
    if (next.accessToken) access = next.accessToken;
    if (next.refreshToken) {
      refresh = next.refreshToken;
      loaded = true;
      await SecureStore.setItemAsync(REFRESH_KEY, next.refreshToken, OPTS);
    }
  },

  async clear() {
    access = null;
    refresh = null;
    loaded = true;
    await SecureStore.deleteItemAsync(REFRESH_KEY, OPTS).catch(() => undefined);
  },

  pushToken: () => SecureStore.getItemAsync(PUSH_KEY, OPTS).catch(() => null),
  setPushToken: (t: string | null) =>
    (t ? SecureStore.setItemAsync(PUSH_KEY, t, OPTS) : SecureStore.deleteItemAsync(PUSH_KEY, OPTS)).catch(() => undefined),
};

/** Seconds until the in-memory access token expires (0 if none or unreadable). */
export function accessTokenTtl(now = Date.now()): number {
  if (!access) return 0;
  try {
    const part = access.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(part.padEnd(part.length + ((4 - (part.length % 4)) % 4), '='))) as { exp?: number };
    return payload.exp ? Math.max(0, payload.exp - Math.floor(now / 1000)) : 0;
  } catch {
    return 0;
  }
}
