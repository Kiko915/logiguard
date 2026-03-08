import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import { logger as honoLogger } from "hono/logger";
import { config } from "./config/index.js";
import { logger } from "./lib/logger.js";
import { BlockchainService } from "./services/blockchain.service.js";
import { registerRoutes } from "./routes/index.js";
import { errorHandler, notFoundHandler } from "./middleware/error.middleware.js";
import { rateLimitMiddleware } from "./middleware/rate-limit.middleware.js";

// ─── App Bootstrap ─────────────────────────────────────────────────────────────
const app = new Hono();

// ── Global Middleware (order matters) ─────────────────────────────────────────
app.use("*", secureHeaders());                          // HSTS, X-Frame-Options, etc.
app.use("*", cors({
  origin: config.NODE_ENV === "production"
    ? ["https://logiguard.app"]
    : ["http://localhost:5173", "http://localhost:3000"],
  allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization"],
  credentials: true,
}));
app.use("*", honoLogger());                             // HTTP access log
app.use("*", rateLimitMiddleware);                      // Rate limiting

// ── Routes ────────────────────────────────────────────────────────────────────
registerRoutes(app);

// ── Error Handling ────────────────────────────────────────────────────────────
app.notFound(notFoundHandler);
app.onError(errorHandler);

// ─── Startup ───────────────────────────────────────────────────────────────────
async function start() {
  // Initialize blockchain connection (non-fatal if Ganache is not running)
  const blockchainService = new BlockchainService();
  await blockchainService.initialize();

  serve({ fetch: app.fetch, port: config.PORT }, () => {
    logger.info(
      { port: config.PORT, env: config.NODE_ENV },
      `LogiGuard API running on http://localhost:${config.PORT}`
    );
    logger.info("Available routes:");
    logger.info("  GET  /health");
    logger.info("  GET  /health/ready");
    logger.info("  POST /api/v1/scanner/scan");
    logger.info("  GET  /api/v1/scanner/logs");
    logger.info("  GET  /api/v1/scanner/stats");
    logger.info("  GET  /api/v1/scanner/packages/:id");
    logger.info("  GET  /api/v1/scanner/packages/:id/verify");
    logger.info("  POST /api/v1/simulation/run");
    logger.info("  GET  /api/v1/simulation/theoretical");
    logger.info("  GET  /api/v1/simulation/results");
    logger.info("  GET  /api/v1/simulation/results/:id");
  });
}

start().catch((err) => {
  logger.fatal({ err }, "Failed to start server");
  process.exit(1);
});
