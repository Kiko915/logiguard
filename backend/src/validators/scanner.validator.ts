import { z } from "zod";

// ─── Scanner Validators ────────────────────────────────────────────────────────

export const submitScanSchema = z.object({
  barcode: z.string().max(128).nullable().optional(),
  status: z.enum(["good", "damaged", "empty"]),
  confidence: z.number().min(0).max(1),
  scan_time_ms: z.number().int().min(1).max(60000),
  frame_data_url: z
    .string()
    .startsWith("data:image/")
    .nullable()
    .optional(),
  metadata: z.record(z.unknown()).nullable().optional(),
});

export const getScanLogsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  per_page: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(["good", "damaged", "empty"]).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

export type SubmitScanInput = z.infer<typeof submitScanSchema>;
export type GetScanLogsQuery = z.infer<typeof getScanLogsQuerySchema>;
