import { prisma } from "../../config/prisma.js";
import { invalid } from "../../utils/ApiError.js";
import { isExpoPushToken, requirePush } from "../../services/push.js";

const view = (d) => ({ id: d.id, platform: d.platform, appVersion: d.appVersion, registeredAt: d.createdAt.toISOString(), lastSeenAt: d.lastSeenAt.toISOString() });

/**
 * Registers this phone for push. Idempotent: the app calls it on every sign-in
 * and app start. A token already on another account (the phone changed hands,
 * or signed out without unregistering) moves to the caller, so a push for the
 * previous user never reaches the new one.
 */
export async function register(auth, { pushToken, platform, appVersion = "" }) {
  requirePush();
  if (!isExpoPushToken(pushToken)) throw invalid({ pushToken: "Not an Expo push token" });
  const d = await prisma.device.upsert({
    where: { pushToken },
    create: { userId: auth.userId, pushToken, platform, appVersion },
    update: { userId: auth.userId, platform, appVersion, lastSeenAt: new Date() },
  });
  return view(d);
}

/** Stops pushes to this phone for the caller. Only the caller's own token is removed. */
export async function unregister(auth, pushToken) {
  const { count } = await prisma.device.deleteMany({ where: { pushToken, userId: auth.userId } });
  return { removed: count };
}

export async function list(auth) {
  const rows = await prisma.device.findMany({ where: { userId: auth.userId }, orderBy: { lastSeenAt: "desc" } });
  return rows.map(view);
}
