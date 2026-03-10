import { Query } from "node-appwrite";
import { BaseRepository } from "./base.repository.js";
import type { GetScanLogsQuery } from "../validators/scanner.validator.js";

// ─── Scan Log Repository ───────────────────────────────────────────────────────
export class ScanLogRepository extends BaseRepository {
  constructor() {
    super("scan_logs");
  }

  async findWithFilters(filters: GetScanLogsQuery) {
    const { page, per_page, status, from, to } = filters;
    const offset = (page - 1) * per_page;

    const queries = [
      Query.limit(per_page),
      Query.offset(offset),
      Query.orderDesc("$createdAt"),
    ];

    if (status) queries.push(Query.equal("status", status));
    if (from)   queries.push(Query.greaterThanEqual("$createdAt", from));
    if (to)     queries.push(Query.lessThanEqual("$createdAt", to));

    const result = await this.db.listDocuments(this.dbId, this.collectionId, queries);

    return {
      data:  result.documents.map((d) => this.mapDoc(d as unknown as Record<string, unknown>)),
      total: result.total,
    };
  }

  // Returns average scan_time_ms from the last N scans — fed into µ for M/M/1
  async getAverageScanTime(limit = 100): Promise<number | null> {
    const result = await this.db.listDocuments(this.dbId, this.collectionId, [
      Query.limit(limit),
      Query.orderDesc("$createdAt"),
      Query.select(["scan_time_ms"]),
    ]);

    if (result.documents.length === 0) return null;

    const avg =
      result.documents.reduce((sum, r) => sum + (r["scan_time_ms"] as number), 0) /
      result.documents.length;

    return avg;
  }

  async getStatusDistribution() {
    const since = new Date(Date.now() - 86400000).toISOString();

    const [total, good, damaged, empty] = await Promise.all([
      this.db.listDocuments(this.dbId, this.collectionId, [
        Query.greaterThanEqual("$createdAt", since),
        Query.limit(1),
      ]),
      this.db.listDocuments(this.dbId, this.collectionId, [
        Query.greaterThanEqual("$createdAt", since),
        Query.equal("status", "good"),
        Query.limit(1),
      ]),
      this.db.listDocuments(this.dbId, this.collectionId, [
        Query.greaterThanEqual("$createdAt", since),
        Query.equal("status", "damaged"),
        Query.limit(1),
      ]),
      this.db.listDocuments(this.dbId, this.collectionId, [
        Query.greaterThanEqual("$createdAt", since),
        Query.equal("status", "empty"),
        Query.limit(1),
      ]),
    ]);

    return {
      total_scans:     total.total,
      good_count:      good.total,
      damaged_count:   damaged.total,
      empty_count:     empty.total,
      avg_scan_time_ms: await this.getAverageScanTime(),
    };
  }
}
