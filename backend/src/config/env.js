import dotenv from "dotenv";
dotenv.config();

function required(name) {
  const v = process.env[name];
  if (!v || !v.trim()) throw new Error(`Missing required env var: ${name} (see .env.example)`);
  return v;
}

const nodeEnv = process.env.NODE_ENV || "development";
const devDefault = (devValue) => (nodeEnv === "production" ? "disabled" : devValue);

export const env = {
  nodeEnv,
  port: Number(process.env.PORT || 4000),
  // Where links in emails (invitations, password reset) point: the web app.
  appUrl: (process.env.APP_URL || "http://localhost:5173").replace(/\/+$/, ""),
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
  // Email for invitations, password reset and receipts.
  //   disabled = nothing is sent; features that need email say so (production default)
  //   console  = printed to the server log (development default; refused in production)
  //   resend   = sent through Resend (https://resend.com)
  mail: {
    mode: process.env.MAIL_MODE || devDefault("console"),
    from: process.env.MAIL_FROM || "StayPookie <no-reply@staypookie.local>",
    resendApiKey: process.env.RESEND_API_KEY || "",
  },
  // File storage for student documents and complaint photos.
  //   disabled = uploads say "not set up" (production default)
  //   local    = files in backend/uploads (development default; refused in production)
  //   r2       = Cloudflare R2, private bucket, presigned URLs
  storage: {
    mode: process.env.STORAGE_MODE || devDefault("local"),
    localDir: process.env.STORAGE_LOCAL_DIR || "uploads",
    publicApiUrl: (process.env.PUBLIC_API_URL || `http://localhost:${process.env.PORT || 4000}`).replace(/\/+$/, ""),
    r2AccountId: process.env.R2_ACCOUNT_ID || "",
    r2AccessKeyId: process.env.R2_ACCESS_KEY_ID || "",
    r2SecretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
    r2Bucket: process.env.R2_BUCKET || "",
    maxMb: Number(process.env.UPLOAD_MAX_MB || 5),
    signedUrlTtl: Number(process.env.SIGNED_URL_TTL_SECONDS || 300),
  },
  // Push notifications to the mobile app.
  //   disabled = devices cannot register; the app hides push (production default)
  //   console  = pushes are kept in memory and logged (development default; refused in production)
  //   expo     = sent through the Expo Push Service (FCM + APNs)
  push: {
    mode: process.env.PUSH_MODE || devDefault("console"),
    // Optional: only needed when "enhanced push security" is on for the Expo project.
    expoAccessToken: process.env.EXPO_ACCESS_TOKEN || "",
  },
  // Mobile app versions. Below minVersion the app must update before it can be used.
  mobile: {
    minVersion: process.env.MOBILE_MIN_VERSION || "0.0.0",
    latestVersion: process.env.MOBILE_LATEST_VERSION || process.env.MOBILE_MIN_VERSION || "0.0.0",
  },
  // In-process scheduler (monthly charges, late fees, reminders, cleanup). Turn it
  // off when an external cron runs `npm run job <name>` instead (e.g. a host whose
  // instances sleep). Never on in tests.
  jobs: {
    enabled: process.env.JOBS_ENABLED ? process.env.JOBS_ENABLED === "true" : nodeEnv !== "test",
  },
};
export const isProd = env.nodeEnv === "production";

// ── Configuration guards ─────────────────────────────────────────────────────
// Misconfiguration must stop the server at boot, not surface later as a quiet
// security hole. Messages name the variables, never print their values.
const PAYMENT_MODES = ["disabled", "simulated", "razorpay"];
const MAIL_MODES = ["disabled", "console", "resend"];
const STORAGE_MODES = ["disabled", "local", "r2"];
const PUSH_MODES = ["disabled", "console", "expo"];
const SEMVER = /^\d+\.\d+\.\d+$/;
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
  if (!MAIL_MODES.includes(e.mail.mode)) problems.push(`MAIL_MODE must be one of: ${MAIL_MODES.join(", ")}`);
  if (e.mail.mode === "resend" && !e.mail.resendApiKey) problems.push("RESEND_API_KEY is required when MAIL_MODE=resend");
  if (!STORAGE_MODES.includes(e.storage.mode)) problems.push(`STORAGE_MODE must be one of: ${STORAGE_MODES.join(", ")}`);
  if (e.storage.mode === "r2") {
    for (const [name, v] of [["R2_ACCOUNT_ID", e.storage.r2AccountId], ["R2_ACCESS_KEY_ID", e.storage.r2AccessKeyId], ["R2_SECRET_ACCESS_KEY", e.storage.r2SecretAccessKey], ["R2_BUCKET", e.storage.r2Bucket]]) {
      if (!v) problems.push(`${name} is required when STORAGE_MODE=r2`);
    }
  }
  if (!PUSH_MODES.includes(e.push.mode)) problems.push(`PUSH_MODE must be one of: ${PUSH_MODES.join(", ")}`);
  for (const [name, v] of [["MOBILE_MIN_VERSION", e.mobile.minVersion], ["MOBILE_LATEST_VERSION", e.mobile.latestVersion]]) {
    if (!SEMVER.test(v)) problems.push(`${name} must look like 1.2.3`);
  }
  if (!(e.storage.maxMb > 0 && e.storage.maxMb <= 50)) problems.push("UPLOAD_MAX_MB must be between 1 and 50");
  if (!production) return problems;

  if (e.mail.mode === "console") {
    problems.push("MAIL_MODE=console only prints emails to the log and is not allowed in production (use resend, or disabled)");
  }
  if (e.push.mode === "console") {
    problems.push("PUSH_MODE=console only logs push notifications and is not allowed in production (use expo, or disabled)");
  }
  if (e.storage.mode === "local") {
    problems.push("STORAGE_MODE=local keeps files on the server's disk and is not allowed in production (use r2, or disabled)");
  }

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
