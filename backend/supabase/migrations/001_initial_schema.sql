-- ─────────────────────────────────────────────────────────────────────────────
-- LogiGuard Initial Schema
-- Migration: 001_initial_schema
-- ─────────────────────────────────────────────────────────────────────────────

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Enum Types ───────────────────────────────────────────────────────────────
CREATE TYPE package_status AS ENUM ('good', 'damaged', 'empty');
CREATE TYPE blockchain_event_type AS ENUM ('SCAN_COMPLETE', 'DEFECT_FLAGGED');

-- ─── packages ─────────────────────────────────────────────────────────────────
CREATE TABLE packages (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barcode               TEXT,
  status                package_status NOT NULL,
  confidence            NUMERIC(5, 4) NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  scan_time_ms          INTEGER NOT NULL CHECK (scan_time_ms > 0),
  blockchain_tx_hash    TEXT UNIQUE,
  blockchain_logged_at  TIMESTAMPTZ,
  scanned_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_packages_status        ON packages(status);
CREATE INDEX idx_packages_scanned_at    ON packages(scanned_at DESC);
CREATE INDEX idx_packages_barcode       ON packages(barcode) WHERE barcode IS NOT NULL;

-- ─── scan_logs ────────────────────────────────────────────────────────────────
-- Append-only audit log. No UPDATE or DELETE permitted via RLS.
CREATE TABLE scan_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id      UUID NOT NULL REFERENCES packages(id) ON DELETE CASCADE,
  status          package_status NOT NULL,
  confidence      NUMERIC(5, 4) NOT NULL,
  scan_time_ms    INTEGER NOT NULL,
  frame_data_url  TEXT,                         -- Optional base64 image snapshot
  metadata        JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_scan_logs_package_id  ON scan_logs(package_id);
CREATE INDEX idx_scan_logs_status      ON scan_logs(status);
CREATE INDEX idx_scan_logs_created_at  ON scan_logs(created_at DESC);

-- ─── blockchain_transactions ──────────────────────────────────────────────────
CREATE TABLE blockchain_transactions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id      UUID NOT NULL REFERENCES packages(id) ON DELETE RESTRICT,
  tx_hash         TEXT NOT NULL UNIQUE,
  block_number    INTEGER NOT NULL,
  gas_used        INTEGER NOT NULL,
  from_address    TEXT NOT NULL,
  to_address      TEXT NOT NULL,
  event_type      blockchain_event_type NOT NULL,
  payload_hash    TEXT NOT NULL,              -- keccak256 of package data
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_btx_package_id  ON blockchain_transactions(package_id);
CREATE INDEX idx_btx_tx_hash     ON blockchain_transactions(tx_hash);

-- ─── simulation_runs ──────────────────────────────────────────────────────────
CREATE TABLE simulation_runs (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parameters            JSONB NOT NULL,
  theoretical_metrics   JSONB NOT NULL,
  monte_carlo_results   JSONB NOT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sim_runs_created_at ON simulation_runs(created_at DESC);

-- ─── Stored Function: Scan Statistics ────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_scan_stats(start_date TIMESTAMPTZ, end_date TIMESTAMPTZ)
RETURNS TABLE (
  total_scans       BIGINT,
  good_count        BIGINT,
  damaged_count     BIGINT,
  empty_count       BIGINT,
  avg_scan_time_ms  NUMERIC
)
LANGUAGE sql STABLE AS $$
  SELECT
    COUNT(*)                                      AS total_scans,
    COUNT(*) FILTER (WHERE status = 'good')       AS good_count,
    COUNT(*) FILTER (WHERE status = 'damaged')    AS damaged_count,
    COUNT(*) FILTER (WHERE status = 'empty')      AS empty_count,
    ROUND(AVG(scan_time_ms), 2)                   AS avg_scan_time_ms
  FROM scan_logs
  WHERE created_at BETWEEN start_date AND end_date;
$$;

-- ─── Row Level Security ───────────────────────────────────────────────────────
-- Enable RLS on all tables. The service role key bypasses this on the backend.
-- These policies protect direct Supabase client (anon key) access.

ALTER TABLE packages                ENABLE ROW LEVEL SECURITY;
ALTER TABLE scan_logs               ENABLE ROW LEVEL SECURITY;
ALTER TABLE blockchain_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE simulation_runs         ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read all records
CREATE POLICY "Authenticated read packages"
  ON packages FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated read scan_logs"
  ON scan_logs FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated read blockchain_transactions"
  ON blockchain_transactions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated read simulation_runs"
  ON simulation_runs FOR SELECT TO authenticated USING (true);

-- Only the service role (backend) can write — no direct client writes
-- (enforced by only using the service role key on the backend)
