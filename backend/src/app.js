import express from "express";
import helmet from "helmet";
import cors from "cors";
import morgan from "morgan";
import { env, isProd } from "./config/env.js";
import { requestId } from "./middleware/requestId.js";
import { globalLimiter } from "./middleware/rateLimit.js";
import { notFound, errorHandler } from "./middleware/errorHandler.js";
import apiRoutes from "./routes/index.js";

export function createApp() {
  const app = express();
  app.set("trust proxy", 1);
  app.use(helmet());
  app.use(cors({
    origin(origin, cb) {
      // No Origin = mobile app / curl → allow. Else must be allowlisted.
      if (!origin || env.corsOrigins.includes(origin)) return cb(null, true);
      cb(new Error("Not allowed by CORS"));
    },
    credentials: true,
  }));

  // NB: the Razorpay webhook needs the raw body; its route attaches a raw
  // parser itself and is matched before this JSON parser touches it.
  app.use(express.json({ limit: "1mb" }));
  app.use(requestId);
  app.use(morgan(isProd ? "combined" : "dev"));
  app.use(globalLimiter);

  app.get("/health", (_req, res) => res.json({ status: "ok", uptime: process.uptime() }));
  app.use("/api/v1", apiRoutes);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
