import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { prisma } from "./config/prisma.js";

const app = createApp();
const server = app.listen(env.port, () => {
  console.log(`StayPookie API on http://localhost:${env.port} (${env.nodeEnv}) · payments: ${env.payments.mode}`);
});
async function shutdown(sig) {
  console.log(`\n${sig} received, shutting down...`);
  server.close(async () => { await prisma.$disconnect(); process.exit(0); });
}
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
