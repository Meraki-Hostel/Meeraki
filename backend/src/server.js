import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { prisma } from "./config/prisma.js";
import { startScheduler, stopScheduler } from "./jobs/index.js";

const app = createApp();
const server = app.listen(env.port, () => {
  console.log(`Meraki API on http://localhost:${env.port} (${env.nodeEnv}) · payments: ${env.payments.mode} · mail: ${env.mail.mode} · storage: ${env.storage.mode}`);
  startScheduler().catch((err) => console.error("Scheduler failed to start:", err.message));
});
async function shutdown(sig) {
  console.log(`\n${sig} received, shutting down...`);
  stopScheduler();
  server.close(async () => { await prisma.$disconnect(); process.exit(0); });
}
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
