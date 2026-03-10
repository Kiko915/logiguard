// ─── Domain Types ──────────────────────────────────────────────────────────────

// ── Package Classification ─────────────────────────────────────────────────────
export type PackageStatus = "good" | "damaged" | "empty";

export interface Package {
  id: string;
  barcode: string | null;
  status: PackageStatus;
  confidence: number;           // TF.js model confidence score (0–1)
  scan_time_ms: number;         // Real-world service time in milliseconds
  blockchain_tx_hash: string | null;
  blockchain_logged_at: string | null;
  scanned_at: string;
  created_at: string;
}

// ── Scan Log ───────────────────────────────────────────────────────────────────
export interface ScanLog {
  id: string;
  package_id: string;
  status: PackageStatus;
  confidence: number;
  scan_time_ms: number;
  frame_data_url: string | null;  // Optional base64 snapshot
  metadata: Record<string, unknown> | null;
  created_at: string;
}

// ── Simulation ─────────────────────────────────────────────────────────────────
export interface SimulationParameters {
  arrival_rate: number;           // λ — packages per hour
  service_rate: number;           // µ — packages per hour (derived from scan_time_ms)
  defect_rate: number;            // Fraction (0–1)
  shift_hours: number;            // Simulation duration
  replications: number;           // Monte Carlo replications
  queue_overflow_threshold: number; // Default: 10 items
}

export interface MM1Metrics {
  rho: number;                    // ρ = λ/µ — utilization factor
  L: number;                      // Avg items in system
  Lq: number;                     // Avg items in queue
  W: number;                      // Avg time in system (hours)
  Wq: number;                     // Avg waiting time in queue (hours)
  throughput: number;             // Effective throughput rate
  is_stable: boolean;             // ρ < 1
}

export interface MonteCarloReplication {
  replication_id: number;
  total_arrivals: number;
  total_served: number;
  total_defects: number;
  max_queue_length: number;
  overflow_occurred: boolean;
  avg_waiting_time_s: number;
  system_utilization: number;
  false_positive_count: number;
}

export interface SimulationResult {
  id: string;
  parameters: SimulationParameters;
  theoretical: MM1Metrics;         // Closed-form M/M/1 formulas
  monte_carlo: {
    replications: number;
    overflow_probability: number;   // P(queue > threshold)
    avg_queue_length: number;
    avg_waiting_time_s: number;
    avg_utilization: number;
    avg_throughput: number;
    avg_false_positive_impact: number;
    service_time_histogram: number[]; // Bucketed distribution
    queue_length_over_time: TimeSeriesPoint[];
  };
  created_at: string;
}

export interface TimeSeriesPoint {
  time_s: number;
  queue_length: number;
}

// ── Blockchain ─────────────────────────────────────────────────────────────────
export interface BlockchainTransaction {
  id: string;
  package_id: string;
  tx_hash: string;
  block_number: number;
  gas_used: number;
  from_address: string;
  to_address: string;
  event_type: "SCAN_COMPLETE" | "DEFECT_FLAGGED";
  payload_hash: string;           // Keccak256 of package data
  created_at: string;
}

// ── API Response Wrappers ──────────────────────────────────────────────────────
export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta?: {
    total?: number;
    page?: number;
    per_page?: number;
  };
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

// ── Auth ───────────────────────────────────────────────────────────────────────
// Appwrite-authenticated user extracted from JWT in auth middleware.
// Role is stored as the first entry in Appwrite user labels.
export interface AppwriteUser {
  $id: string;
  email: string;
  name: string;
  role: "admin" | "operator" | "viewer";
}
