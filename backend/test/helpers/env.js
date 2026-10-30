// Import this FIRST in every test file, before anything under src/.
//
// It pins every setting the app reads, so a developer's backend/.env can never
// leak into a test run (dotenv does not override variables that are already
// set), and it refuses to run against anything but a local *_test database.

const DEFAULT_URL = "postgresql://meraki:meraki@127.0.0.1:55432/meraki_test";

export function assertDisposableDb(raw) {
  let u;
  try { u = new URL(raw); } catch { throw new Error("TEST_DATABASE_URL is not a valid URL"); }
  const local = ["localhost", "127.0.0.1", "::1", "[::1]"].includes(u.hostname);
  const name = u.pathname.replace(/^\//, "");
  if (!local || !name.endsWith("_test")) {
    throw new Error(
      `Refusing to run tests: database must be local and its name must end in "_test" (got host "${u.hostname}", database "${name}").`,
    );
  }
}

export const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || DEFAULT_URL;
assertDisposableDb(TEST_DATABASE_URL);

// A server in UTC is the common hosting default; it also makes the
// time-zone defect tests deterministic on any developer machine.
process.env.TZ = "UTC";

Object.assign(process.env, {
  NODE_ENV: "test",
  PORT: "0",
  APP_TIMEZONE: "Asia/Kolkata",
  CORS_ORIGINS: "http://localhost:5173",
  DATABASE_URL: TEST_DATABASE_URL,
  DIRECT_URL: TEST_DATABASE_URL,
  JWT_ACCESS_SECRET: "test-access-secret-not-for-production",
  JWT_REFRESH_SECRET: "test-refresh-secret-not-for-production",
  ACCESS_TOKEN_TTL: "15m",
  REFRESH_TOKEN_TTL_DAYS: "30",
  // Deliberately different from TEST_PASSWORD so a demo-password backdoor is detectable.
  DEMO_PASSWORD: "demo-backdoor-password",
  PAYMENT_MODE: "simulated",
  RAZORPAY_KEY_ID: "rzp_test_placeholder",
  RAZORPAY_KEY_SECRET: "test-key-secret",
  RAZORPAY_WEBHOOK_SECRET: "test-webhook-secret",
});

export const DEMO_BACKDOOR_PASSWORD = process.env.DEMO_PASSWORD;
export const WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET;
