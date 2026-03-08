import { BaseRepository } from "./base.repository.js";
import type { SimulationResult } from "../types/index.js";

// ─── Simulation Repository ─────────────────────────────────────────────────────
export class SimulationRepository extends BaseRepository<"simulation_runs"> {
  constructor() {
    super("simulation_runs");
  }

  async saveResult(result: SimulationResult) {
    const { data, error } = await this.query
      .insert({
        id: result.id,
        parameters: result.parameters as never,
        theoretical_metrics: result.theoretical as never,
        monte_carlo_results: result.monte_carlo as never,
      })
      .select("*")
      .single();

    if (error) throw error;
    return data;
  }

  async getRecentRuns(limit = 10) {
    const { data, error } = await this.query
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data ?? [];
  }
}
