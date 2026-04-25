import { Hono } from "hono";
import { SimulationService } from "../services/simulation.service.js";
import { GroqService } from "../services/groq.service.js";
import { SimulationRepository } from "../repositories/simulation.repository.js";
import { ScanLogRepository } from "../repositories/scan-log.repository.js";
import {
  runSimulationSchema,
  getSimulationResultsQuerySchema,
  analyzeSimulationSchema,
} from "../validators/simulation.validator.js";
import { validateBody, validateQuery } from "../middleware/validate.middleware.js";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { config } from "../config/index.js";
import type { ApiSuccess, SimulationParameters } from "../types/index.js";

const router = new Hono();
const simulationService = new SimulationService();

// ─── POST /simulation/run ──────────────────────────────────────────────────────
// Runs a full M/M/1 + Monte Carlo simulation (FR-04, FR-05, FR-06)
// If service_rate is omitted, derives µ from the last 100 real scan records (FR-02)
router.post("/run", authMiddleware, async (c) => {
  const validated = await validateBody(c, runSimulationSchema);
  if (validated instanceof Response) return validated;

  const { service_rate: inputServiceRate, ...rest } = validated.data;

  // Derive µ from real scan data if not explicitly provided
  let serviceRate = inputServiceRate;
  if (!serviceRate) {
    const scanLogRepo = new ScanLogRepository();
    const avgMs = await scanLogRepo.getAverageScanTime();
    if (avgMs) {
      serviceRate = simulationService.deriveServiceRate(avgMs);
    } else {
      serviceRate = config.DEFAULT_SERVICE_RATE;
    }
  }

  const params: SimulationParameters = {
    ...rest,
    service_rate: serviceRate,
  };

  const result = simulationService.runMonteCarlo(params);

  // Persist to DB asynchronously
  const simRepo = new SimulationRepository();
  simRepo.saveResult(result).catch(() => {/* non-blocking */});

  const body: ApiSuccess<typeof result> = { success: true, data: result };
  return c.json(body, 201);
});

// ─── GET /simulation/theoretical ──────────────────────────────────────────────
// Returns closed-form M/M/1 metrics without running a full simulation.
// Useful for the real-time dashboard sliders.
router.get("/theoretical", authMiddleware, async (c) => {
  const lambdaRaw = c.req.query("arrival_rate");
  const muRaw = c.req.query("service_rate");

  const lambda = parseFloat(lambdaRaw ?? "");
  const mu = parseFloat(muRaw ?? "");

  if (isNaN(lambda) || isNaN(mu) || lambda <= 0 || mu <= 0) {
    return c.json(
      {
        success: false,
        error: { code: "VALIDATION_ERROR", message: "arrival_rate and service_rate must be positive numbers" },
      },
      422
    );
  }

  const metrics = simulationService.computeTheoretical({
    arrival_rate: lambda,
    service_rate: mu,
    defect_rate: 0,
    shift_hours: 12,
    replications: 1,
    queue_overflow_threshold: 10,
  });

  const body: ApiSuccess<typeof metrics> = { success: true, data: metrics };
  return c.json(body);
});

// ─── GET /simulation/results ───────────────────────────────────────────────────
// Returns paginated list of past simulation runs
router.get("/results", authMiddleware, async (c) => {
  const validated = validateQuery(c, getSimulationResultsQuerySchema);
  if (validated instanceof Response) return validated;

  const simRepo = new SimulationRepository();
  const results = await simRepo.getRecentRuns(validated.data.per_page);

  const body: ApiSuccess<typeof results> = { success: true, data: results };
  return c.json(body);
});

// ─── GET /simulation/results/:id ──────────────────────────────────────────────
router.get("/results/:id", authMiddleware, async (c) => {
  const id = c.req.param("id");
  const simRepo = new SimulationRepository();
  const result = await simRepo.findById(id);

  const body: ApiSuccess<typeof result> = { success: true, data: result };
  return c.json(body);
});

// ─── POST /simulation/analyze ──────────────────────────────────────────────────
// Sends simulation results to Groq for plain-language interpretation.
router.post("/analyze", authMiddleware, async (c) => {
  const validated = await validateBody(c, analyzeSimulationSchema);
  if (validated instanceof Response) return validated;

  const groq = new GroqService();
  const analysis = await groq.analyzeSimulation(validated.data);

  const body: ApiSuccess<typeof analysis> = { success: true, data: analysis };
  return c.json(body);
});

export { router as simulationRouter };
