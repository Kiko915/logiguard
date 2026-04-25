import { randomUUID } from "crypto";
import type {
  SimulationParameters,
  SimulationResult,
  MM1Metrics,
  MonteCarloReplication,
  TimeSeriesPoint,
} from "../types/index.js";
import { logger } from "../lib/logger.js";

// ─── Pseudorandom Number Generator ────────────────────────────────────────────
// Linear Congruential Generator — satisfies FR-06.
// Deterministic and seedable for reproducible simulation runs.
class LCG {
  private state: number;
  // Knuth MMIX constants
  private readonly A = 6364136223846793005n;
  private readonly C = 1442695040888963407n;
  private readonly M = 2n ** 64n;

  constructor(seed?: number) {
    this.state = seed ?? Date.now();
  }

  // Returns a float in [0, 1)
  next(): number {
    const s = BigInt(this.state);
    const next = (this.A * s + this.C) % this.M;
    this.state = Number(next & BigInt(0xffffffff));
    return this.state / 0x100000000;
  }

  // Poisson-distributed random variate using Knuth's algorithm
  poisson(lambda: number): number {
    const L = Math.exp(-lambda);
    let k = 0;
    let p = 1;
    do {
      k++;
      p *= this.next();
    } while (p > L);
    return k - 1;
  }

  // Exponential random variate via inverse transform
  exponential(rate: number): number {
    return -Math.log(1 - this.next()) / rate;
  }
}

// ─── Discrete-Event Simulation Engine ─────────────────────────────────────────
// Implements an M/M/1 queue using event-driven simulation.
// Events: ARRIVAL → SERVICE_START → SERVICE_END

type EventType = "ARRIVAL" | "SERVICE_START" | "SERVICE_END";

interface SimEvent {
  time: number;
  type: EventType;
  packageId: number;
}

class DiscreteEventSimulator {
  private eventQueue: SimEvent[] = [];
  private clock = 0;
  private serverBusy = false;
  private queue: number[] = [];             // Packages waiting
  private packageArrivalTimes = new Map<number, number>();
  private packageServiceStartTimes = new Map<number, number>();

  readonly queueLengthHistory: TimeSeriesPoint[] = [];
  readonly serviceTimes: number[] = [];
  readonly waitingTimes: number[] = [];

  private maxQueueLength = 0;
  private totalServed = 0;
  private totalDefects = 0;
  private falsePositives = 0;
  private nextPackageId = 0;

  constructor(
    private readonly params: SimulationParameters,
    private readonly rng: LCG
  ) {}

  private schedule(event: SimEvent) {
    this.eventQueue.push(event);
    this.eventQueue.sort((a, b) => a.time - b.time);
  }

  private recordQueueLength() {
    this.queueLengthHistory.push({
      time_s: this.clock,
      queue_length: this.queue.length + (this.serverBusy ? 1 : 0),
    });
  }

  run(): MonteCarloReplication & { queueLengthHistory: TimeSeriesPoint[] } {
    const shiftSeconds = this.params.shift_hours * 3600;
    const arrivalRatePerSecond = this.params.arrival_rate / 3600;

    // Seed first arrival
    const firstArrival = this.rng.exponential(arrivalRatePerSecond);
    this.schedule({ time: firstArrival, type: "ARRIVAL", packageId: this.nextPackageId++ });

    while (this.eventQueue.length > 0) {
      const event = this.eventQueue.shift()!;
      if (event.time > shiftSeconds) break;

      this.clock = event.time;
      this.processEvent(event, arrivalRatePerSecond, shiftSeconds);
    }

    const overflowThreshold = this.params.queue_overflow_threshold;
    const avgWaiting =
      this.waitingTimes.length > 0
        ? this.waitingTimes.reduce((a, b) => a + b, 0) / this.waitingTimes.length
        : 0;

    return {
      replication_id: 0, // Set by caller
      total_arrivals: this.nextPackageId,
      total_served: this.totalServed,
      total_defects: this.totalDefects,
      max_queue_length: this.maxQueueLength,
      overflow_occurred: this.maxQueueLength > overflowThreshold,
      avg_waiting_time_s: avgWaiting,
      system_utilization:
        this.totalServed > 0
          ? (this.params.arrival_rate / this.params.service_rate)
          : 0,
      false_positive_count: this.falsePositives,
      queueLengthHistory: this.queueLengthHistory,
    };
  }

  private processEvent(
    event: SimEvent,
    arrivalRatePerSecond: number,
    shiftSeconds: number
  ) {
    switch (event.type) {
      case "ARRIVAL": {
        this.packageArrivalTimes.set(event.packageId, this.clock);
        this.recordQueueLength();

        if (!this.serverBusy) {
          this.schedule({ time: this.clock, type: "SERVICE_START", packageId: event.packageId });
        } else {
          this.queue.push(event.packageId);
          if (this.queue.length > this.maxQueueLength) {
            this.maxQueueLength = this.queue.length;
          }
        }

        // Schedule next arrival
        const nextArrivalTime = this.clock + this.rng.exponential(arrivalRatePerSecond);
        if (nextArrivalTime < shiftSeconds) {
          this.schedule({
            time: nextArrivalTime,
            type: "ARRIVAL",
            packageId: this.nextPackageId++,
          });
        }
        break;
      }

      case "SERVICE_START": {
        this.serverBusy = true;
        this.packageServiceStartTimes.set(event.packageId, this.clock);

        const arrivalTime = this.packageArrivalTimes.get(event.packageId) ?? this.clock;
        this.waitingTimes.push(this.clock - arrivalTime);

        const serviceRatePerSecond = this.params.service_rate / 3600;
        const serviceTime = this.rng.exponential(serviceRatePerSecond);
        this.serviceTimes.push(serviceTime);

        this.schedule({
          time: this.clock + serviceTime,
          type: "SERVICE_END",
          packageId: event.packageId,
        });
        break;
      }

      case "SERVICE_END": {
        this.serverBusy = false;
        this.totalServed++;
        this.recordQueueLength();

        // Determine if package is defective (FR-06)
        const isDefect = this.rng.next() < this.params.defect_rate;
        if (isDefect) this.totalDefects++;

        // False positive: classified as damaged but actually good
        // Modeled as 2% of good packages being incorrectly flagged
        const isFalsePositive = !isDefect && this.rng.next() < 0.02;
        if (isFalsePositive) this.falsePositives++;

        // Serve next in queue
        if (this.queue.length > 0) {
          const nextPackageId = this.queue.shift()!;
          this.schedule({ time: this.clock, type: "SERVICE_START", packageId: nextPackageId });
        }
        break;
      }
    }
  }
}

// ─── Simulation Service ────────────────────────────────────────────────────────
export class SimulationService {
  // ── Closed-Form M/M/1 Metrics (FR-04) ─────────────────────────────────────
  computeTheoretical(params: SimulationParameters): MM1Metrics {
    const { arrival_rate: lambda, service_rate: mu } = params;
    const rho = lambda / mu;
    const isStable = rho < 1;

    if (!isStable) {
      // Unstable system: theoretical values are unbounded
      return { rho, L: Infinity, Lq: Infinity, W: Infinity, Wq: Infinity, throughput: mu, is_stable: false };
    }

    const L = rho / (1 - rho);
    const Lq = rho ** 2 / (1 - rho);
    const W = L / lambda;
    const Wq = Lq / lambda;

    return { rho, L, Lq, W, Wq, throughput: lambda, is_stable: true };
  }

  // ── Monte Carlo Simulation (FR-05) ────────────────────────────────────────
  runMonteCarlo(params: SimulationParameters): SimulationResult {
    logger.info(
      { arrival_rate: params.arrival_rate, replications: params.replications },
      "Starting Monte Carlo simulation"
    );

    const replications: MonteCarloReplication[] = [];
    let combinedQueueHistory: TimeSeriesPoint[] = [];
    const allServiceTimes: number[] = [];

    for (let i = 0; i < params.replications; i++) {
      const rng = new LCG(i * 31337); // Deterministic per replication
      const sim = new DiscreteEventSimulator(params, rng);
      const result = sim.run();

      replications.push({ ...result, replication_id: i + 1 });
      allServiceTimes.push(...sim.serviceTimes);

      // Only store time-series from the median replication to avoid huge payloads
      if (i === Math.floor(params.replications / 2)) {
        combinedQueueHistory = result.queueLengthHistory;
      }
    }

    const overflowCount = replications.filter((r) => r.overflow_occurred).length;
    const avg = (fn: (r: MonteCarloReplication) => number) =>
      replications.reduce((s, r) => s + fn(r), 0) / replications.length;

    const theoretical = this.computeTheoretical(params);
    const histogram = this.buildHistogram(allServiceTimes, 20);

    const result: SimulationResult = {
      id: randomUUID(),
      parameters: params,
      theoretical,
      monte_carlo: {
        replications: params.replications,
        overflow_probability: overflowCount / params.replications,
        avg_queue_length: avg((r) => r.max_queue_length),
        avg_waiting_time_s: avg((r) => r.avg_waiting_time_s),
        avg_utilization: avg((r) => r.system_utilization),
        avg_throughput: avg((r) => r.total_served / params.shift_hours),
        avg_false_positive_impact: avg((r) => r.false_positive_count / Math.max(r.total_served, 1)),
        service_time_histogram: histogram,
        queue_length_over_time: combinedQueueHistory,
      },
      created_at: new Date().toISOString(),
    };

    logger.info({ id: result.id, overflow_probability: result.monte_carlo.overflow_probability }, "Simulation complete");
    return result;
  }

  // Derive µ (service rate) from average scan time in milliseconds
  deriveServiceRate(avgScanTimeMs: number): number {
    const avgScanTimeSec = avgScanTimeMs / 1000;
    return 3600 / avgScanTimeSec; // packages per hour
  }

  private buildHistogram(values: number[], bins: number): number[] {
    if (values.length === 0) return new Array(bins).fill(0);
    // Avoid Math.min/max spread — call stack overflow on large arrays
    let min = values[0], max = values[0];
    for (const v of values) { if (v < min) min = v; if (v > max) max = v; }
    const binWidth = (max - min) / bins || 1;
    const histogram = new Array(bins).fill(0);

    for (const v of values) {
      const bin = Math.min(Math.floor((v - min) / binWidth), bins - 1);
      histogram[bin]++;
    }
    return histogram;
  }
}
