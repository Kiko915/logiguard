// ─── Supabase Database Type Map ────────────────────────────────────────────────
// Keep this in sync with supabase/migrations/001_initial_schema.sql
// Run `npx supabase gen types typescript` to auto-regenerate after migrations.

export interface Database {
  public: {
    Tables: {
      packages: {
        Row: {
          id: string;
          barcode: string | null;
          status: "good" | "damaged" | "empty";
          confidence: number;
          scan_time_ms: number;
          blockchain_tx_hash: string | null;
          blockchain_logged_at: string | null;
          scanned_at: string;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["packages"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["packages"]["Insert"]>;
      };
      scan_logs: {
        Row: {
          id: string;
          package_id: string;
          status: "good" | "damaged" | "empty";
          confidence: number;
          scan_time_ms: number;
          frame_data_url: string | null;
          metadata: Record<string, unknown> | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["scan_logs"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["scan_logs"]["Insert"]>;
      };
      blockchain_transactions: {
        Row: {
          id: string;
          package_id: string;
          tx_hash: string;
          block_number: number;
          gas_used: number;
          from_address: string;
          to_address: string;
          event_type: "SCAN_COMPLETE" | "DEFECT_FLAGGED";
          payload_hash: string;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["blockchain_transactions"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["blockchain_transactions"]["Insert"]>;
      };
      simulation_runs: {
        Row: {
          id: string;
          parameters: Record<string, unknown>;
          theoretical_metrics: Record<string, unknown>;
          monte_carlo_results: Record<string, unknown>;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["simulation_runs"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["simulation_runs"]["Insert"]>;
      };
    };
    Views: Record<string, never>;
    Functions: {
      get_scan_stats: {
        Args: { start_date: string; end_date: string };
        Returns: {
          total_scans: number;
          good_count: number;
          damaged_count: number;
          empty_count: number;
          avg_scan_time_ms: number;
        };
      };
    };
  };
}
