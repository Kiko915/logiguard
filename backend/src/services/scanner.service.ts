import { randomUUID } from "crypto";
import { ScanLogRepository } from "../repositories/scan-log.repository.js";
import { PackageRepository } from "../repositories/package.repository.js";
import { BlockchainService } from "./blockchain.service.js";
import { logger } from "../lib/logger.js";
import type { SubmitScanInput } from "../validators/scanner.validator.js";
import type { Package, ScanLog } from "../types/index.js";

// ─── Scanner Service ───────────────────────────────────────────────────────────
// Orchestrates the full scan pipeline:
// 1. Persist package record
// 2. Persist scan log (audit trail)
// 3. Log to blockchain (async, non-blocking)
export class ScannerService {
  constructor(
    private readonly scanLogRepo: ScanLogRepository,
    private readonly packageRepo: PackageRepository,
    private readonly blockchainService: BlockchainService
  ) {}

  async processScan(input: SubmitScanInput): Promise<{ package: Package; scanLog: ScanLog }> {
    const now = new Date().toISOString();
    const packageId = randomUUID();

    // 1. Create package record
    // documentId is passed separately — Appwrite uses $id, not a data field.
    const pkgPayload = {
      barcode: input.barcode ?? null,
      status: input.status,
      confidence: input.confidence,
      scan_time_ms: input.scan_time_ms,
      blockchain_tx_hash: null,
      blockchain_logged_at: null,
      scanned_at: now,
    };

    const pkg = (await this.packageRepo.create(pkgPayload, packageId)) as unknown as Package;

    // 2. Create immutable scan log (append-only audit trail).
    // frame_data_url is intentionally excluded: raw base64 frames can be
    // 100–200 KB as text and will silently exceed Appwrite's per-attribute
    // string size limit, causing the entire document write to fail.
    // Frames should be stored in Appwrite Storage (files) separately if needed.
    const scanLogPayload = {
      package_id: packageId,
      status: input.status,
      confidence: input.confidence,
      scan_time_ms: input.scan_time_ms,
      frame_data_url: null,
      // Appwrite stores metadata as a plain string attribute — serialize to JSON
      metadata: input.metadata ? JSON.stringify(input.metadata) : null,
    };

    const scanLog = (await this.scanLogRepo.create(scanLogPayload)) as unknown as ScanLog;

    logger.info({ packageId, status: input.status }, "Scan processed");

    // 3. Blockchain logging — fire and forget (non-blocking)
    // Updates package record with tx hash when resolved
    this.logToBlockchainAsync(pkg).catch((err) =>
      logger.error({ err, packageId }, "Async blockchain log failed")
    );

    return { package: pkg, scanLog };
  }

  private async logToBlockchainAsync(pkg: Package): Promise<void> {
    const txRecord = await this.blockchainService.logPackage(pkg);
    if (txRecord) {
      await this.packageRepo.updateBlockchainInfo(
        pkg.id,
        txRecord.tx_hash,
        txRecord.created_at
      );
    }
  }

  async getAverageServiceRate(): Promise<number | null> {
    const avgMs = await this.scanLogRepo.getAverageScanTime();
    if (avgMs === null) return null;
    // Convert ms to packages/hour
    return 3600 / (avgMs / 1000);
  }
}
