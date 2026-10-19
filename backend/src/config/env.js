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
  demoPassword: process.env.DEMO_PASSWORD || "meraki@123",
  jwt: {
    accessSecret: required("JWT_ACCESS_SECRET"),
    refreshSecret: required("JWT_REFRESH_SECRET"),
    accessTtl: process.env.ACCESS_TOKEN_TTL || "15m",
    refreshTtlDays: Number(process.env.REFRESH_TOKEN_TTL_DAYS || 30),
  },
  payments: {
    mode: process.env.PAYMENT_MODE || "simulated",
    razorpayKeyId: process.env.RAZORPAY_KEY_ID || "",
    razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET || "",
    razorpayWebhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || "",
  },
};
export const isProd = env.nodeEnv === "production";
