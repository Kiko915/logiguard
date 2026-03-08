import { ethers } from "ethers";
import { getWallet } from "../lib/blockchain.js";
import { logger } from "../lib/logger.js";
import { config } from "../config/index.js";
import type { BlockchainTransaction, Package } from "../types/index.js";
import { randomUUID } from "crypto";

// ─── LogiGuard Smart Contract ABI (minimal) ────────────────────────────────────
// Deploy this contract via Truffle/Hardhat to Ganache before running.
const CONTRACT_ABI = [
  "event PackageLogged(string indexed packageId, bytes32 payloadHash, string status, uint256 timestamp)",
  "function logPackage(string packageId, bytes32 payloadHash, string status) external",
  "function getPackageLog(string packageId) external view returns (bytes32, string, uint256)",
];

// ─── Blockchain Service ────────────────────────────────────────────────────────
export class BlockchainService {
  private contract: ethers.Contract | null = null;
  private isAvailable = false;

  async initialize(): Promise<void> {
    try {
      const wallet = getWallet();
      this.contract = new ethers.Contract(config.CONTRACT_ADDRESS, CONTRACT_ABI, wallet);
      // Ping the contract to verify it's deployed
      await wallet.provider!.getCode(config.CONTRACT_ADDRESS);
      this.isAvailable = true;
      logger.info({ contract: config.CONTRACT_ADDRESS }, "Blockchain service initialized");
    } catch (err) {
      this.isAvailable = false;
      logger.warn({ err }, "Blockchain service unavailable — logging skipped");
    }
  }

  // ── Log a completed scan to Ganache (FR-03) ───────────────────────────────
  async logPackage(pkg: Package): Promise<BlockchainTransaction | null> {
    if (!this.isAvailable || !this.contract) {
      logger.debug({ packageId: pkg.id }, "Blockchain unavailable — skip logging");
      return null;
    }

    // Only log good packages as "Service Completion" events per FR-03
    if (pkg.status === "empty") return null;

    try {
      const payloadHash = this.hashPayload(pkg);
      const eventType = pkg.status === "damaged" ? "DEFECT_FLAGGED" : "SCAN_COMPLETE";

      const tx: ethers.TransactionResponse = await this.contract.logPackage(
        pkg.id,
        payloadHash,
        pkg.status
      );

      const receipt = await tx.wait();
      if (!receipt) throw new Error("Transaction receipt is null");

      const wallet = getWallet();
      const fromAddress = await wallet.getAddress();

      const record: BlockchainTransaction = {
        id: randomUUID(),
        package_id: pkg.id,
        tx_hash: receipt.hash,
        block_number: receipt.blockNumber,
        gas_used: Number(receipt.gasUsed),
        from_address: fromAddress,
        to_address: config.CONTRACT_ADDRESS,
        event_type: eventType,
        payload_hash: payloadHash,
        created_at: new Date().toISOString(),
      };

      logger.info({ txHash: receipt.hash, packageId: pkg.id }, "Package logged to blockchain");
      return record;
    } catch (err) {
      logger.error({ err, packageId: pkg.id }, "Blockchain transaction failed");
      return null;
    }
  }

  async verifyPackage(packageId: string): Promise<{ verified: boolean; payloadHash: string; status: string; timestamp: number } | null> {
    if (!this.isAvailable || !this.contract) return null;

    try {
      const [payloadHash, status, timestamp] = await this.contract.getPackageLog(packageId);
      return {
        verified: payloadHash !== ethers.ZeroHash,
        payloadHash,
        status,
        timestamp: Number(timestamp),
      };
    } catch (err) {
      logger.error({ err, packageId }, "Blockchain verification failed");
      return null;
    }
  }

  // Keccak256 hash of package data for tamper-proof logging
  private hashPayload(pkg: Package): string {
    const payload = JSON.stringify({
      id: pkg.id,
      barcode: pkg.barcode,
      status: pkg.status,
      confidence: pkg.confidence,
      scan_time_ms: pkg.scan_time_ms,
      scanned_at: pkg.scanned_at,
    });
    return ethers.keccak256(ethers.toUtf8Bytes(payload));
  }
}
