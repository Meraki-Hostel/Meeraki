import { prisma } from "../../config/prisma.js";
import { env } from "../../config/env.js";
import { pushEnabled, sendPush } from "../../services/push.js";

// Push is an outbox over the Notification table. Notifications are written in
// the same transaction as the change they describe (utils/sideEffects.js), so
// pushing from there would push for changes that later roll back. Instead the
// dispatcher claims rows that are already committed (`pushedAt IS NULL`), sends
// them, and runs:
//   - shortly after any notification is written (kickPush, debounced), and
//   - on a sweep interval, which catches rows whose transaction committed after
//     the kick, and rows released after a failed send.
// Claiming uses FOR UPDATE SKIP LOCKED, so several API instances never send the
// same notification twice. A row older than MAX_AGE is never pushed: a push
// about something from hours ago is noise.

const MAX_AGE_MINUTES = 60;
const BATCH = 500;
const KICK_DELAY_MS = 1500;
const SWEEP_MS = 15_000;

export async function dispatchPending({ limit = BATCH } = {}) {
  if (!pushEnabled()) return { claimed: 0, sent: 0, removedDevices: 0 };
  // Prisma stores DateTime as UTC in `timestamp` (no zone) columns. now() and a
  // bound JS Date (sent as timestamptz) would both be shifted by the database
  // session's time zone, so times go in as naive UTC text cast to timestamp.
  const utc = (d) => d.toISOString().replace("T", " ").replace("Z", "");
  const now = new Date();
  const cutoff = new Date(now.getTime() - MAX_AGE_MINUTES * 60_000);
  const claimed = await prisma.$queryRaw`
    UPDATE "Notification" SET "pushedAt" = ${utc(now)}::timestamp
    WHERE "id" IN (
      SELECT "id" FROM "Notification"
      WHERE "pushedAt" IS NULL AND "createdAt" > ${utc(cutoff)}::timestamp
      ORDER BY "createdAt"
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED)
    RETURNING "id", "recipientUserId", "title", "body", "category", "link"`;
  if (!claimed.length) return { claimed: 0, sent: 0, removedDevices: 0 };

  const userIds = [...new Set(claimed.map((n) => n.recipientUserId))];
  const [devices, unread] = await Promise.all([
    prisma.device.findMany({ where: { userId: { in: userIds }, user: { disabledAt: null } }, select: { userId: true, pushToken: true } }),
    prisma.notification.groupBy({ by: ["recipientUserId"], where: { recipientUserId: { in: userIds }, read: false }, _count: { _all: true } }),
  ]);
  const badge = new Map(unread.map((u) => [u.recipientUserId, u._count._all]));
  const byUser = new Map();
  for (const d of devices) byUser.set(d.userId, [...(byUser.get(d.userId) ?? []), d.pushToken]);

  const messages = [];
  for (const n of claimed) {
    for (const to of byUser.get(n.recipientUserId) ?? []) {
      messages.push({
        to, title: n.title, body: n.body, badge: badge.get(n.recipientUserId) ?? 0,
        data: { notificationId: n.id, category: n.category, link: n.link ?? null },
      });
    }
  }

  let tickets;
  try {
    tickets = await sendPush(messages);
  } catch (err) {
    // Nothing was delivered: release the rows so the next sweep tries again.
    await prisma.notification.updateMany({ where: { id: { in: claimed.map((n) => n.id) } }, data: { pushedAt: null } });
    throw err;
  }

  // A token the platform no longer knows (app uninstalled, token rotated) is removed.
  const dead = messages.filter((_, i) => tickets[i]?.error === "DeviceNotRegistered").map((m) => m.to);
  const removed = dead.length ? (await prisma.device.deleteMany({ where: { pushToken: { in: dead } } })).count : 0;
  return { claimed: claimed.length, sent: tickets.filter((t) => t.status === "ok").length, removedDevices: removed };
}

// ── Triggers ─────────────────────────────────────────────────────────────────
// Neither runs in tests: tests call dispatchPending() directly, so nothing is
// left running after a test file ends.
const triggersOn = () => pushEnabled() && env.nodeEnv !== "test";
const report = (err) => console.error("[push] dispatch failed:", err.message);

let kickTimer = null;
/** Called after notifications are written; runs one dispatch shortly after. */
export function kickPush() {
  if (!triggersOn() || kickTimer) return;
  kickTimer = setTimeout(() => {
    kickTimer = null;
    dispatchPending().catch(report);
  }, KICK_DELAY_MS);
  kickTimer.unref?.();
}

let sweepTimer = null;
export function startPushSweep() {
  if (!triggersOn() || sweepTimer) return;
  sweepTimer = setInterval(() => dispatchPending().catch(report), SWEEP_MS);
  sweepTimer.unref?.();
}
export function stopPushSweep() {
  clearInterval(sweepTimer);
  sweepTimer = null;
}
