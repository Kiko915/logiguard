import { Hono } from "hono";
import { scannerRouter } from "./scanner.routes.js";
import { simulationRouter } from "./simulation.routes.js";
import { healthRouter } from "./health.routes.js";

// ─── API Router ────────────────────────────────────────────────────────────────
// Central route registry. All routes are versioned under /api/v1.
export function registerRoutes(app: Hono) {
  app.route("/health", healthRouter);
  app.route("/api/v1/scanner", scannerRouter);
  app.route("/api/v1/simulation", simulationRouter);
}
