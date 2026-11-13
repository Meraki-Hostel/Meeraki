import { env, isProd } from "../config/env.js";
import { notConfigured } from "../utils/ApiError.js";

// Push notifications to the mobile app. PUSH_MODE (see config/env.js):
//   disabled → pushEnabled() is false; device registration says "not set up"
//   console  → kept in `pushOutbox` and logged (development and tests)
//   expo     → sent through the Expo Push Service, which delivers via FCM / APNs

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const EXPO_BATCH = 100; // Expo accepts at most 100 messages per request.

/** Pushes "sent" in console mode, newest last. Tests read them from here. */
export const pushOutbox = [];

export const pushEnabled = () => env.push.mode !== "disabled";

export function requirePush() {
  if (!pushEnabled()) throw notConfigured("Push notifications are not set up on this server yet.");
}

/** Expo push tokens look like ExponentPushToken[xxxx] (or ExpoPushToken[xxxx]). */
export const isExpoPushToken = (t) => typeof t === "string" && /^Expo(nent)?PushToken\[[^\]]{8,200}\]$/.test(t);

/**
 * Sends messages `{ to, title, body, data, badge }` and returns one ticket per
 * message, in order: `{ status: "ok" }` or `{ status: "error", error }` where
 * `error` is Expo's code (e.g. "DeviceNotRegistered"). Throws when the whole
 * request fails, so the caller can retry the batch later.
 */
export async function sendPush(messages) {
  if (!messages.length) return [];
  if (env.push.mode === "console") {
    for (const m of messages) {
      pushOutbox.push({ ...m, at: new Date() });
      if (pushOutbox.length > 200) pushOutbox.shift();
      if (!isProd && env.nodeEnv !== "test") console.log(`[push] to ${m.to}: ${m.title}`);
    }
    return messages.map(() => ({ status: "ok" }));
  }
  if (env.push.mode !== "expo") return messages.map(() => ({ status: "error", error: "PushDisabled" }));

  const tickets = [];
  for (let i = 0; i < messages.length; i += EXPO_BATCH) {
    const batch = messages.slice(i, i + EXPO_BATCH).map((m) => ({
      to: m.to, title: m.title, body: m.body, data: m.data, badge: m.badge,
      sound: "default", priority: "high", channelId: "default",
    }));
    const res = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(env.push.expoAccessToken && { Authorization: `Bearer ${env.push.expoAccessToken}` }),
      },
      body: JSON.stringify(batch),
    });
    if (!res.ok) throw new Error(`Expo push refused the batch: ${res.status} ${(await res.text()).slice(0, 300)}`);
    const json = await res.json();
    for (const t of json.data ?? []) {
      tickets.push(t.status === "ok" ? { status: "ok" } : { status: "error", error: t.details?.error ?? "Unknown", message: t.message });
    }
  }
  return tickets;
}
