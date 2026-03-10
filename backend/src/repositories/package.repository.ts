import { Query } from "node-appwrite";
import { BaseRepository } from "./base.repository.js";

// ─── Package Repository ────────────────────────────────────────────────────────
export class PackageRepository extends BaseRepository {
  constructor() {
    super("packages");
  }

  async findByBarcode(barcode: string) {
    const result = await this.db.listDocuments(this.dbId, this.collectionId, [
      Query.equal("barcode", barcode),
      Query.orderDesc("$createdAt"),
    ]);
    return result.documents.map((d) => this.mapDoc(d as unknown as Record<string, unknown>));
  }

  async updateBlockchainInfo(packageId: string, txHash: string, loggedAt: string) {
    return this.update(packageId, {
      blockchain_tx_hash:     txHash,
      blockchain_logged_at:   loggedAt,
    });
  }

  async findDamagedPackages(options: { page: number; per_page: number }) {
    const { page, per_page } = options;
    const offset = (page - 1) * per_page;

    const result = await this.db.listDocuments(this.dbId, this.collectionId, [
      Query.equal("status", "damaged"),
      Query.limit(per_page),
      Query.offset(offset),
      Query.orderDesc("$createdAt"),
    ]);

    return {
      data:  result.documents.map((d) => this.mapDoc(d as unknown as Record<string, unknown>)),
      total: result.total,
    };
  }
}
