import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

import authRoutes from "./routes/auth.routes";
import meterRoutes from "./routes/meter.routes";
import purchaseRoutes from "./routes/purchase.routes";
import tokenRoutes from "./routes/token.routes";
import transactionRoutes from "./routes/transaction.routes";
import usageRoutes from "./routes/usage.routes";
import alertRoutes from "./routes/alert.routes";
import budgetRoutes from "./routes/budget.routes";
import supportRoutes from "./routes/support.routes";
import notificationRoutes from "./routes/notification.routes";
import adminRoutes from "./routes/admin.routes";
import webhookRoutes from "./routes/webhook.routes";

import { errorHandler, notFoundHandler } from "./middleware/errorHandler";

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors());

  // Webhooks need the raw-ish parsed body but must be mounted before any
  // body-size assumptions elsewhere; fine to share json() here since we
  // re-stringify for signature checking in the handler itself.
  app.use(express.json({ limit: "1mb" }));

  const apiLimiter = rateLimit({ windowMs: 60 * 1000, max: 120 });
  app.use("/api", apiLimiter);

  app.get("/health", (_req, res) => res.json({ status: "ok", time: new Date().toISOString() }));

  app.use("/api/auth", authRoutes);
  app.use("/api/meters", meterRoutes);
  app.use("/api/purchases", purchaseRoutes);
  app.use("/api/tokens", tokenRoutes);
  app.use("/api/transactions", transactionRoutes);
  app.use("/api/usage", usageRoutes);
  app.use("/api/alerts", alertRoutes);
  app.use("/api/budget", budgetRoutes);
  app.use("/api/support", supportRoutes);
  app.use("/api/notifications", notificationRoutes);
  app.use("/api/admin", adminRoutes);
  app.use("/api/webhooks", webhookRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
