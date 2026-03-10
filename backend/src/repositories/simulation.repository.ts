import { Query } from "node-appwrite";
import { BaseRepository } from "./base.repository.js";
import type { SimulationResult } from "../types/index.js";

// ─── Simulation Repository ─────────────────────────────────────────────────────
export class SimulationRepository extends BaseRepository {
  constructor() {
    super("simulation_runs");
  }

  async saveResult(result: SimulationResult) {
    // JSON-stringify nested objects — Appwrite stores attributes as flat types.
    // Deserialise on read in the service layer.
    return this.db.createDocument(this.dbId, this.collectionId, result.id, {
      parameters:          JSON.stringify(result.parameters),
      theoretical_metrics: JSON.stringify(result.theoretical),
      monte_carlo_results: JSON.stringify(result.monte_carlo),
    }).then((doc) => this.mapDoc(doc as unknown as Record<string, unknown>));
  }

  async getRecentRuns(limit = 10) {
    const result = await this.db.listDocuments(this.dbId, this.collectionId, [
      Query.limit(limit),
      Query.orderDesc("$createdAt"),
    ]);
    return result.documents.map((d) => this.mapDoc(d as unknown as Record<string, unknown>));
  }
}
