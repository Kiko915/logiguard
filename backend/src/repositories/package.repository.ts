import { BaseRepository } from "./base.repository.js";

// ─── Package Repository ────────────────────────────────────────────────────────
export class PackageRepository extends BaseRepository<"packages"> {
  constructor() {
    super("packages");
  }

  async findByBarcode(barcode: string) {
    const { data, error } = await this.query
      .select("*")
      .eq("barcode", barcode)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data ?? [];
  }

  async updateBlockchainInfo(
    packageId: string,
    txHash: string,
    loggedAt: string
  ) {
    return this.update(packageId, {
      blockchain_tx_hash: txHash,
      blockchain_logged_at: loggedAt,
    });
  }

  async findDamagedPackages(options: { page: number; per_page: number }) {
    const { page, per_page } = options;
    const offset = (page - 1) * per_page;

    const { data, error, count } = await this.query
      .select("*", { count: "exact" })
      .eq("status", "damaged")
      .order("created_at", { ascending: false })
      .range(offset, offset + per_page - 1);

    if (error) throw error;
    return { data: data ?? [], total: count ?? 0 };
  }
}
