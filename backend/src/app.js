import express from "express";
import helmet from "helmet";
import cors from "cors";
import morgan from "morgan";
import { env, isProd } from "./config/env.js";
import { requestId } from "./middleware/requestId.js";
import { globalLimiter } from "./middleware/rateLimit.js";
import { notFound, errorHandler } from "./middleware/errorHandler.js";
import apiRoutes from "./routes/index.js";
import { webhook as razorpayWebhook } from "./modules/payments/payment.controller.js";

export function createApp() {
  const app = express();
  app.set("trust proxy", 1);
  app.use(helmet());
  app.use(cors({
    origin(origin, cb) {
      // No Origin = mobile app / curl / server-to-server → allow.
      // Else must match CORS_ORIGINS list or '*'
      if (!origin || env.corsOrigins.includes("*") || env.corsOrigins.includes(origin)) {
        return cb(null, true);
      }
      cb(new Error(`Origin ${origin} not allowed by CORS`));
    },
    credentials: true,
  }));

  app.use(requestId);
  app.use(morgan(isProd ? "combined" : "dev"));
  app.use(globalLimiter);

  // The Razorpay webhook must see the exact signed bytes and needs no login, so it
  // is registered before the JSON parser and before every authenticated router.
  app.post("/api/v1/payments/webhook", express.raw({ type: "*/*", limit: "1mb" }), razorpayWebhook);

  app.use(express.json({ limit: "1mb" }));

  app.get("/health", (_req, res) => res.json({ status: "ok", uptime: process.uptime() }));
  app.use("/api/v1", apiRoutes);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
