import Groq from "groq-sdk";
import { config } from "../config/index.js";
import { logger } from "../lib/logger.js";

// ─── Payload sent from frontend for analysis ───────────────────────────────────
export interface SimAnalysisInput {
  model_type: "mm1" | "mmc";
  parameters: {
    arrival_rate:             number;
    service_rate:             number;
    defect_rate:              number;  // 0–1
    shift_hours:              number;
    replications:             number;
    queue_overflow_threshold: number;
    servers?:                 number;  // M/M/c only
  };
  theoretical: {
    rho:       number;
    is_stable: boolean;
    L?:        number;
    Lq?:       number;
    W?:        number;
    Wq?:       number;
    Pq?:       number;  // M/M/c Erlang C
    P0?:       number;
  };
  monte_carlo: {
    overflow_probability:    number;
    avg_queue_length:        number;
    avg_waiting_time_s:      number;
    avg_utilization:         number;
    avg_throughput:          number;
    avg_false_positive_rate: number;
    replications_run:        number;
  };
}

// ─── Structured analysis returned to frontend ──────────────────────────────────
export interface SimAnalysisResult {
  summary:         string;
  findings:        { color: "success" | "warning" | "danger" | "info"; text: string }[];
  recommendations: { title: string; description: string }[];
  risk_level:      "low" | "medium" | "high";
  risk_rationale:  string;
}

// ─── Groq Service ──────────────────────────────────────────────────────────────
export class GroqService {
  private readonly client: Groq;

  constructor() {
    if (!config.GROQ_API_KEY) throw new Error("GROQ_API_KEY is not configured");
    this.client = new Groq({ apiKey: config.GROQ_API_KEY });
  }

  async analyzeSimulation(input: SimAnalysisInput): Promise<SimAnalysisResult> {
    const { model_type, parameters: p, theoretical: th, monte_carlo: mc } = input;

    const modelLabel = model_type === "mm1"
      ? "M/M/1 (single-server)"
      : `M/M/c (${p.servers ?? 2}-server)`;

    const rhoDisplay  = (th.rho * 100).toFixed(1);
    const utilDisplay = (mc.avg_utilization * 100).toFixed(1);
    const overflowPct = (mc.overflow_probability * 100).toFixed(1);
    const fpPct       = (mc.avg_false_positive_rate * 100).toFixed(2);
    const wqDisplay   = mc.avg_waiting_time_s.toFixed(2);

    const theoreticalLines = model_type === "mm1" ? [
      `  - Avg items in system (L): ${th.L?.toFixed(3) ?? "∞"}`,
      `  - Avg items in queue (Lq): ${th.Lq?.toFixed(3) ?? "∞"}`,
      `  - Avg system time (W): ${th.W != null ? (th.W * 3600).toFixed(2) + "s" : "∞"}`,
      `  - Avg wait in queue (Wq): ${th.Wq != null ? (th.Wq * 3600).toFixed(2) + "s" : "∞"}`,
    ] : [
      `  - P(wait) — Erlang C: ${th.Pq != null ? (th.Pq * 100).toFixed(1) + "%" : "N/A"}`,
      `  - P(all servers idle): ${th.P0 != null ? (th.P0 * 100).toFixed(1) + "%" : "N/A"}`,
      `  - Avg items in queue (Lq): ${th.Lq?.toFixed(3) ?? "∞"}`,
      `  - Avg wait in queue (Wq): ${th.Wq != null ? (th.Wq * 3600).toFixed(2) + "s" : "∞"}`,
    ];

    const prompt = `
You are an expert operations research analyst for LogiGuard, an automated logistics quality-control system.
A queue simulation has just been run. Interpret the results clearly for a warehouse operations manager
who understands logistics but is not a mathematician.

## Simulation Parameters
- Model: ${modelLabel}
- Arrival rate (λ): ${p.arrival_rate} packages/hour
- Service rate (µ): ${p.service_rate} packages/hour per server${p.servers ? `\n- Servers (c): ${p.servers}` : ""}
- Defect rate: ${(p.defect_rate * 100).toFixed(1)}%
- Shift duration: ${p.shift_hours} hours
- Overflow threshold: ${p.queue_overflow_threshold} items
- Replications: ${mc.replications_run}

## Theoretical Metrics (Closed-Form)
- Server utilization (ρ): ${rhoDisplay}%
- System stability: ${th.is_stable ? "STABLE" : "UNSTABLE (ρ ≥ 1 — queue grows without bound)"}
${theoreticalLines.join("\n")}

## Monte Carlo Simulation Results
- Avg server utilization: ${utilDisplay}%
- Queue overflow probability: ${overflowPct}%
- Avg max queue length: ${mc.avg_queue_length.toFixed(1)} items
- Avg wait time in queue: ${wqDisplay}s
- Avg throughput: ${mc.avg_throughput.toFixed(0)} packages/hour
- False positive rate: ${fpPct}% (good packages flagged as damaged)

## Your Task
Respond ONLY with valid JSON matching this exact schema — no markdown, no extra text:
{
  "summary": "<2-3 sentence plain-language summary of the system state and key risk>",
  "findings": [
    { "color": "success" | "warning" | "danger" | "info", "text": "<one specific, quantified finding>" },
    { "color": "success" | "warning" | "danger" | "info", "text": "<finding>" },
    { "color": "success" | "warning" | "danger" | "info", "text": "<finding>" },
    { "color": "success" | "warning" | "danger" | "info", "text": "<finding>" }
  ],
  "recommendations": [
    { "title": "<short action title>", "description": "<1-2 sentence concrete recommendation>" },
    { "title": "<short action title>", "description": "<1-2 sentence concrete recommendation>" },
    { "title": "<short action title>", "description": "<1-2 sentence concrete recommendation>" }
  ],
  "risk_level": "low" | "medium" | "high",
  "risk_rationale": "<one sentence explaining the overall risk verdict>"
}

Color guide: "success" = performing well, "warning" = moderate concern, "danger" = critical issue, "info" = neutral observation.
Be specific with numbers from the simulation. Avoid generic advice.
`.trim();

    const start = Date.now();

    const chat = await this.client.chat.completions.create({
      model:       "llama-3.3-70b-versatile",
      temperature: 0.3,
      max_tokens:  1024,
      messages:    [{ role: "user", content: prompt }],
    });

    const elapsed = Date.now() - start;
    const raw     = chat.choices[0]?.message?.content?.trim() ?? "";
    const cleaned = raw.replace(/^```json\s*/i, "").replace(/\s*```$/, "").trim();

    let parsed: SimAnalysisResult;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      logger.error({ raw }, "Groq returned non-JSON response");
      throw new Error("Analysis model returned an unparseable response.");
    }

    logger.info({ elapsed_ms: elapsed, risk_level: parsed.risk_level }, "Groq simulation analysis complete");
    return parsed;
  }
}
