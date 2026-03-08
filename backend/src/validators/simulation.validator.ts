import { z } from "zod";

// ─── Simulation Validators ─────────────────────────────────────────────────────

export const runSimulationSchema = z.object({
  arrival_rate: z
    .number()
    .min(1)
    .max(10000)
    .describe("λ — packages per hour"),
  service_rate: z
    .number()
    .min(1)
    .max(10000)
    .optional()
    .describe("µ — packages per hour. If omitted, derived from recent scan data."),
  defect_rate: z
    .number()
    .min(0)
    .max(1)
    .default(0.05)
    .describe("Fraction of packages expected to be defective"),
  shift_hours: z
    .number()
    .min(1)
    .max(24)
    .default(12)
    .describe("Duration of the simulated shift in hours"),
  replications: z
    .number()
    .int()
    .min(100)
    .max(10000)
    .default(1000)
    .describe("Number of Monte Carlo replications"),
  queue_overflow_threshold: z
    .number()
    .int()
    .min(1)
    .default(10)
    .describe("Queue length considered an overflow event"),
});

export const getSimulationResultsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  per_page: z.coerce.number().int().min(1).max(50).default(10),
});

export type RunSimulationInput = z.infer<typeof runSimulationSchema>;
export type GetSimulationResultsQuery = z.infer<typeof getSimulationResultsQuerySchema>;
