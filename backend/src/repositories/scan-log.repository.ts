import { BaseRepository } from "./base.repository.js";
import type { GetScanLogsQuery } from "../validators/scanner.validator.js";

// ─── Scan Log Repository ───────────────────────────────────────────────────────
export class ScanLogRepository extends BaseRepository<"scan_logs"> {
  constructor() {
    super("scan_logs");
  }

  async findWithFilters(filters: GetScanLogsQuery) {
    const { page, per_page, status, from, to } = filters;
    const offset = (page - 1) * per_page;

    let q = this.query
      .select("*, packages(barcode, blockchain_tx_hash)", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + per_page - 1);

    if (status) q = q.eq("status", status);
    if (from) q = q.gte("created_at", from);
    if (to) q = q.lte("created_at", to);

    const { data, error, count } = await q;
    if (error) throw error;
    return { data: data ?? [], total: count ?? 0 };
  }

  // Returns average scan_time_ms from the last N scans — fed into µ for M/M/1
  async getAverageScanTime(limit = 100): Promise<number | null> {
    const { data, error } = await this.query
      .select("scan_time_ms")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw error;
    if (!data || data.length === 0) return null;

    const avg = data.reduce((sum, r) => sum + r.scan_time_ms, 0) / data.length;
    return avg;
  }

  async getStatusDistribution() {
    const { data, error } = await this.client
      .rpc("get_scan_stats", {
        start_date: new Date(Date.now() - 86400000).toISOString(),
        end_date: new Date().toISOString(),
      });

    if (error) throw error;
    return data;
  }
}
