// Runs one job now, for hosts that use an external cron instead of the in-process
// scheduler (JOBS_ENABLED=false):   npm run job generate-rent
// --force ignores the "already ran in this slot" guard.
import { runJob, JOBS } from "./index.js";
import { prisma } from "../config/prisma.js";

const [name, flag] = process.argv.slice(2);
if (!name || !JOBS[name]) {
  console.error(`usage: npm run job <${Object.keys(JOBS).join("|")}> [--force]`);
  process.exit(2);
}
try {
  const result = await runJob(name, { force: flag === "--force" });
  console.log(JSON.stringify({ job: name, result }));
} catch (err) {
  console.error(`Job ${name} failed:`, err.message);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
