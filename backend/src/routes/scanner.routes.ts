import { Hono } from "hono";
import { ScannerService } from "../services/scanner.service.js";
import { ScanLogRepository } from "../repositories/scan-log.repository.js";
import { PackageRepository } from "../repositories/package.repository.js";
import { BlockchainService } from "../services/blockchain.service.js";
import { submitScanSchema, getScanLogsQuerySchema, analyzeFrameSchema } from "../validators/scanner.validator.js";
import { validateBody, validateQuery } from "../middleware/validate.middleware.js";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { VisionService } from "../services/vision.service.js";
import type { ApiSuccess } from "../types/index.js";

const router = new Hono();

// ─── Dependency Construction ───────────────────────────────────────────────────
// In a larger app, use a DI container (e.g., tsyringe, inversify).
const blockchainService = new BlockchainService();
const scannerService = new ScannerService(
  new ScanLogRepository(),
  new PackageRepository(),
  blockchainService
);
const visionService = new VisionService();

// ─── POST /scanner/analyze ────────────────────────────────────────────────────
// Sends a captured frame to Gemini Vision and returns the classification.
// Does NOT persist to DB — that happens via /scan after the UI confirms.
router.post("/analyze", authMiddleware, async (c) => {
  const validated = await validateBody(c, analyzeFrameSchema);
  if (validated instanceof Response) return validated;

  try {
    const result = await visionService.analyzeFrame(validated.data.frame_data_url);
    const body: ApiSuccess<typeof result> = { success: true, data: result };
    return c.json(body);
  } catch (err: unknown) {
    // Surface Gemini rate-limit errors as 429 so the frontend can handle them
    const msg = err instanceof Error ? err.message : String(err);
    const isQuota = msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED") || msg.includes("quota");
    if (isQuota) {
      // Extract retry delay from Gemini error if present (e.g. "retry in 36s")
      const retryMatch = msg.match(/retry[^0-9]*(\d+)/i);
      const retryAfter = retryMatch ? parseInt(retryMatch[1], 10) : 60;
      return c.json(
        { success: false, error: { code: "RATE_LIMITED", message: "Gemini API rate limit reached. Please wait before scanning again.", retry_after_s: retryAfter } },
        429,
      );
    }
    throw err; // let the global error handler deal with anything else
  }
});

// ─── POST /scanner/scan ────────────────────────────────────────────────────────
// Receives a scan result from the TF.js frontend (FR-01, FR-02, FR-03)
router.post("/scan", authMiddleware, async (c) => {
  const validated = await validateBody(c, submitScanSchema);
  if (validated instanceof Response) return validated;

  const result = await scannerService.processScan(validated.data);

  const body: ApiSuccess<typeof result> = { success: true, data: result };
  return c.json(body, 201);
});

// ─── GET /scanner/logs ─────────────────────────────────────────────────────────
// Returns paginated scan logs with optional filters
router.get("/logs", authMiddleware, async (c) => {
  const validated = validateQuery(c, getScanLogsQuerySchema);
  if (validated instanceof Response) return validated;

  const repo = new ScanLogRepository();
  const { data, total } = await repo.findWithFilters(validated.data);

  const body: ApiSuccess<typeof data> = {
    success: true,
    data,
    meta: { total, page: validated.data.page, per_page: validated.data.per_page },
  };
  return c.json(body);
});

// ─── GET /scanner/stats ────────────────────────────────────────────────────────
// Returns 24-hour scan statistics + derived µ for the simulation
router.get("/stats", authMiddleware, async (c) => {
  const repo = new ScanLogRepository();
  const [stats, serviceRate] = await Promise.all([
    repo.getStatusDistribution(),
    scannerService.getAverageServiceRate(),
  ]);

  const body: ApiSuccess<{ stats: typeof stats; derived_service_rate: number | null }> = {
    success: true,
    data: { stats, derived_service_rate: serviceRate },
  };
  return c.json(body);
});

// ─── GET /scanner/packages/:id ────────────────────────────────────────────────
router.get("/packages/:id", authMiddleware, async (c) => {
  const id = c.req.param("id");
  const repo = new PackageRepository();
  const pkg = await repo.findById(id);

  const body: ApiSuccess<typeof pkg> = { success: true, data: pkg };
  return c.json(body);
});

// ─── GET /scanner/packages/:id/verify ─────────────────────────────────────────
// Verifies a package's record against the Ganache blockchain
router.get("/packages/:id/verify", authMiddleware, async (c) => {
  const id = c.req.param("id");
  const verification = await blockchainService.verifyPackage(id);

  const body: ApiSuccess<typeof verification> = { success: true, data: verification };
  return c.json(body);
});

export { router as scannerRouter };
