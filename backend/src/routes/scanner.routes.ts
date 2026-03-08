import { Hono } from "hono";
import { ScannerService } from "../services/scanner.service.js";
import { ScanLogRepository } from "../repositories/scan-log.repository.js";
import { PackageRepository } from "../repositories/package.repository.js";
import { BlockchainService } from "../services/blockchain.service.js";
import { submitScanSchema, getScanLogsQuerySchema } from "../validators/scanner.validator.js";
import { validateBody, validateQuery } from "../middleware/validate.middleware.js";
import { authMiddleware } from "../middleware/auth.middleware.js";
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
