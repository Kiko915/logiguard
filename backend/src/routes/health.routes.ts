import { Hono } from "hono";
import { supabase } from "../lib/supabase.js";
import { checkBlockchainConnection } from "../lib/blockchain.js";
import type { ApiSuccess } from "../types/index.js";

const router = new Hono();

// ─── GET /health ───────────────────────────────────────────────────────────────
// Lightweight liveness probe — used by Docker/K8s health checks
router.get("/", (c) => {
  return c.json({ success: true, status: "ok", timestamp: new Date().toISOString() });
});

// ─── GET /health/ready ─────────────────────────────────────────────────────────
// Readiness probe — checks downstream dependencies
router.get("/ready", async (c) => {
  const [dbOk, blockchainOk] = await Promise.allSettled([
    supabase.from("packages").select("id").limit(1).then(() => true),
    checkBlockchainConnection(),
  ]);

  const checks = {
    database: dbOk.status === "fulfilled" && dbOk.value === true,
    blockchain: blockchainOk.status === "fulfilled" && blockchainOk.value === true,
  };

  const allHealthy = Object.values(checks).every(Boolean);

  const body: ApiSuccess<typeof checks> = {
    success: true,
    data: checks,
  };

  return c.json(body, allHealthy ? 200 : 503);
});

export { router as healthRouter };
