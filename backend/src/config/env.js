import dotenv from "dotenv";
dotenv.config();

function required(name) {
  const v = process.env[name];
  if (!v || !v.trim()) throw new Error(`Missing required env var: ${name} (see .env.example)`);
  return v;
}

export const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT || 4000),
  corsOrigins: (process.env.CORS_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean),
  databaseUrl: required("DATABASE_URL"),
  // Business dates (today, billing period, receipt year) follow this IANA zone, not the server's.
  timezone: process.env.APP_TIMEZONE || "Asia/Kolkata",
  jwt: {
    accessSecret: required("JWT_ACCESS_SECRET"),
    refreshSecret: required("JWT_REFRESH_SECRET"),
    accessTtl: process.env.ACCESS_TOKEN_TTL || "15m",
    refreshTtlDays: Number(process.env.REFRESH_TOKEN_TTL_DAYS || 30),
  },
  payments: {
    mode: process.env.PAYMENT_MODE || "disabled", // validated below
    // Live (rzp_live_) keys move real money; they are refused unless this is explicitly true.
    liveEnabled: process.env.PAYMENTS_LIVE_ENABLED === "true",
    razorpayKeyId: process.env.RAZORPAY_KEY_ID || "",
    razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET || "",
    razorpayWebhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || "",
  },
};
export const isProd = env.nodeEnv === "production";

// ── Configuration guards ─────────────────────────────────────────────────────
// Misconfiguration must stop the server at boot, not surface later as a quiet
// security hole. Messages name the variables, never print their values.
const PAYMENT_MODES = ["disabled", "simulated", "razorpay"];
const PLACEHOLDER_SECRET = /^replace_me|^changeme|^secret$|^test$/i;

export function configProblems(e = env, production = isProd) {
  const problems = [];
  try { new Intl.DateTimeFormat("en-CA", { timeZone: e.timezone }); }
  catch { problems.push("APP_TIMEZONE must be a valid IANA time zone, e.g. Asia/Kolkata"); }
  if (!PAYMENT_MODES.includes(e.payments.mode)) {
    problems.push(`PAYMENT_MODE must be one of: ${PAYMENT_MODES.join(", ")}`);
  }
  if (e.payments.razorpayKeyId.startsWith("rzp_live_") && !e.payments.liveEnabled) {
    problems.push("Live Razorpay keys are configured but PAYMENTS_LIVE_ENABLED is not 'true'. Verify webhook, amount checks and reconciliation in test mode first");
  }
  if (!production) return problems;

  if (e.payments.mode === "simulated") {
    problems.push("PAYMENT_MODE=simulated records payments without moving money and is not allowed in production");
  }
  if (e.payments.mode === "razorpay") {
    for (const [name, v] of [["RAZORPAY_KEY_ID", e.payments.razorpayKeyId], ["RAZORPAY_KEY_SECRET", e.payments.razorpayKeySecret], ["RAZORPAY_WEBHOOK_SECRET", e.payments.razorpayWebhookSecret]]) {
      if (!v) problems.push(`${name} is required when PAYMENT_MODE=razorpay`);
    }
  }
  const { accessSecret, refreshSecret } = e.jwt;
  for (const [name, v] of [["JWT_ACCESS_SECRET", accessSecret], ["JWT_REFRESH_SECRET", refreshSecret]]) {
    if (v.length < 32 || PLACEHOLDER_SECRET.test(v)) problems.push(`${name} must be a random value of at least 32 characters (not the .env.example placeholder)`);
  }
  if (accessSecret === refreshSecret) problems.push("JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different");
  if (e.corsOrigins.length === 0) problems.push("CORS_ORIGINS must list the deployed frontend origin(s)");
  if (e.corsOrigins.includes("*")) problems.push("CORS_ORIGINS must not contain '*' in production");
  return problems;
}

const problems = configProblems();
if (problems.length) {
  throw new Error(`Invalid configuration:\n - ${problems.join("\n - ")}`);
}
