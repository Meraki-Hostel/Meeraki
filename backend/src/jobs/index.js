import { prisma } from "../config/prisma.js";
import { env } from "../config/env.js";
import { todayISO, currentPeriod, withBalance, iso } from "../utils/money.js";
import { ledgerRows } from "../utils/ledger.js";
import { notifyStudentUsers } from "../utils/sideEffects.js";
import { generateRent, applyLateFees } from "../modules/payments/charge.service.js";
import { purgeAbandoned } from "../modules/uploads/upload.service.js";
import { snapshotMonth } from "../modules/analytics/analytics.service.js";
import { storageEnabled } from "../services/storage.js";
import { dispatchPending } from "../modules/devices/push.dispatch.js";

const inr = (n) => `₹${Number(n).toLocaleString("en-IN")}`;
const DAY = 864e5;
const addDays = (isoDate, n) => new Date(Date.parse(`${isoDate}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);
const previousPeriod = (p) => {
  const idx = Number(p.slice(0, 4)) * 12 + Number(p.slice(5, 7)) - 2;
  return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, "0")}`;
};

// Reminders go out 2 days before the due date and 3 and 10 days after it, not daily.
async function sendDueReminders() {
  const today = todayISO();
  const days = [addDays(today, 2), addDays(today, -3), addDays(today, -10)].map((d) => new Date(`${d}T00:00:00.000Z`));
  const charges = await prisma.rentCharge.findMany({ where: { dueDate: { in: days } } });
  if (!charges.length) return 0;
  const rows = await ledgerRows(prisma, { chargeId: { in: charges.map((c) => c.id) } });
  let sent = 0;
  for (const c of charges) {
    const { balance } = withBalance(c, rows, today);
    if (balance <= 0) continue;
    const upcoming = iso(c.dueDate) > today;
    await notifyStudentUsers(prisma, c.studentId, upcoming ? "Rent due soon" : "Rent overdue",
      upcoming ? `${inr(balance)} is due on ${iso(c.dueDate)}.` : `${inr(balance)} was due on ${iso(c.dueDate)}. Please pay as soon as possible.`,
      "payment", "/student/rent");
    sent++;
  }
  return sent;
}

async function cleanup() {
  const now = new Date();
  const [tokens, resets, invites] = await Promise.all([
    prisma.refreshToken.deleteMany({ where: { expiresAt: { lt: new Date(now.getTime() - 7 * DAY) } } }),
    prisma.passwordResetToken.deleteMany({ where: { expiresAt: { lt: new Date(now.getTime() - DAY) } } }),
    prisma.invitation.updateMany({ where: { status: "pending", expiresAt: { lt: now } }, data: { status: "expired" } }),
  ]);
  const uploads = storageEnabled() ? await purgeAbandoned() : 0;
  return { refreshTokens: tokens.count, resetTokens: resets.count, invitationsExpired: invites.count, abandonedUploads: uploads };
}

/**
 * Every job is safe to run more than once: charges and late fees are protected
 * by unique indexes, snapshots are upserts, reminders go to fixed days.
 * `cron` is in APP_TIMEZONE; `slot` names one run so only one instance does it.
 */
export const JOBS = {
  "generate-rent": { cron: "30 0 * * *", slot: () => todayISO(), run: () => generateRent({ period: currentPeriod() }).then((created) => ({ created })) },
  "late-fees": { cron: "0 1 * * *", slot: () => todayISO(), run: () => applyLateFees().then((created) => ({ created })) },
  "due-reminders": { cron: "0 9 * * *", slot: () => todayISO(), run: () => sendDueReminders().then((sent) => ({ sent })) },
  "monthly-snapshot": { cron: "0 2 1 * *", slot: () => currentPeriod(), run: () => snapshotMonth(previousPeriod(currentPeriod())) },
  cleanup: { cron: "0 3 * * *", slot: () => todayISO(), run: cleanup },
  // Not scheduled here: the API process sweeps every 15 s on its own. This entry is
  // for hosts that sleep idle instances (external cron, `npm run job push`). It
  // claims no slot and keeps no JobRun row — overlapping runs are safe and it may
  // run every minute.
  push: { cron: null, slot: null, run: () => dispatchPending() },
};

/** Claims the run slot (one instance wins), runs the job and records the outcome. */
export async function runJob(name, { force = false } = {}) {
  const job = JOBS[name];
  if (!job) throw new Error(`Unknown job "${name}". Known: ${Object.keys(JOBS).join(", ")}`);
  if (!job.slot) return job.run();
  if (!force) {
    const claimed = await prisma.$executeRaw`
      INSERT INTO "Counter" ("key", "value") VALUES (${`job:${name}:${job.slot()}`}, 1) ON CONFLICT DO NOTHING`;
    if (!claimed) return { skipped: "already ran in this slot" };
  }
  const run = await prisma.jobRun.create({ data: { name } });
  try {
    const result = await job.run();
    await prisma.jobRun.update({ where: { id: run.id }, data: { finishedAt: new Date(), ok: true, result } });
    return result;
  } catch (err) {
    await prisma.jobRun.update({ where: { id: run.id }, data: { finishedAt: new Date(), ok: false, error: String(err?.stack ?? err).slice(0, 4000) } });
    throw err;
  }
}

let tasks = [];
export async function startScheduler() {
  if (!env.jobs.enabled) return;
  const cron = (await import("node-cron")).default;
  tasks = Object.entries(JOBS).filter(([, job]) => job.cron).map(([name, job]) =>
    cron.schedule(job.cron, () => {
      runJob(name).catch((err) => console.error(`[job ${name}] failed:`, err.message));
    }, { timezone: env.timezone }));
  // Catch up after a restart or deploy: billing for today must not wait until tomorrow.
  for (const name of ["generate-rent", "late-fees"]) runJob(name).catch((err) => console.error(`[job ${name}] failed:`, err.message));
  console.log(`Scheduler on (${env.timezone}): ${Object.keys(JOBS).filter((n) => JOBS[n].cron).join(", ")}`);
}
export function stopScheduler() {
  for (const t of tasks) t.stop();
  tasks = [];
}
