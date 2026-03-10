// ─── Appwrite Collection Document Types ────────────────────────────────────────
// Represents the shape of documents stored in each Appwrite collection.
// System fields ($id, $createdAt, etc.) are added by Appwrite automatically.
// Collection IDs: packages | scan_logs | simulation_runs | blockchain_transactions

export interface AppwriteDocument {
  $id: string;
  $createdAt: string;
  $updatedAt: string;
  $collectionId: string;
  $databaseId: string;
  $permissions: string[];
}

export interface PackageDocument extends AppwriteDocument {
  barcode: string | null;
  status: "good" | "damaged" | "empty";
  confidence: number;
  scan_time_ms: number;
  blockchain_tx_hash: string | null;
  blockchain_logged_at: string | null;
  scanned_at: string;
}

export interface ScanLogDocument extends AppwriteDocument {
  package_id: string;
  status: "good" | "damaged" | "empty";
  confidence: number;
  scan_time_ms: number;
  frame_data_url: string | null;
  metadata: string | null; // JSON-stringified Record<string, unknown>
}

export interface BlockchainTransactionDocument extends AppwriteDocument {
  package_id: string;
  tx_hash: string;
  block_number: number;
  gas_used: number;
  from_address: string;
  to_address: string;
  event_type: "SCAN_COMPLETE" | "DEFECT_FLAGGED";
  payload_hash: string;
}

export interface SimulationRunDocument extends AppwriteDocument {
  parameters: string;          // JSON-stringified SimulationParameters
  theoretical_metrics: string; // JSON-stringified MM1Metrics
  monte_carlo_results: string; // JSON-stringified MonteCarloResult
}
