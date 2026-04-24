import { useState, useMemo, useCallback } from "react"
import { api } from "@/lib/api"
import {
  Activity,
  Play,
  RotateCcw,
  Info,
  TrendingUp,
  Clock,
  Layers,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Cpu,
  BarChart3,
  GitBranch,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Lightbulb,
  ShieldAlert,
  ListChecks,
  Server,
  Network,
} from "lucide-react"
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from "recharts"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"

// ─── Chart color constants (dark-mode optimised) ───────────────────────────────
const C = {
  primary:  "#60a5fa",   // blue-400 — visible on dark backgrounds
  success:  "#4ade80",   // green-400
  warn:     "#fbbf24",   // amber-400
  damaged:  "#f87171",   // red-400
  muted:    "#9ca3af",   // gray-400
  grid:     "#2d2d2d",   // subtle dark grid lines
  text:     "#a3a3a3",   // neutral-400
}

// ─── M/M/1 Engine (frontend port of backend simulation.service.ts) ─────────────

class LCG {
  private state: number
  private readonly A = 6364136223846793005n
  private readonly C = 1442695040888963407n
  private readonly M = 2n ** 64n

  constructor(seed: number) { this.state = seed }

  next(): number {
    const s = BigInt(this.state)
    const next = (this.A * s + this.C) % this.M
    this.state = Number(next & BigInt(0xffffffff))
    return this.state / 0x100000000
  }

  exponential(rate: number): number {
    return -Math.log(1 - this.next()) / rate
  }
}

interface SimParams {
  arrival_rate:             number
  service_rate:             number
  defect_rate:              number
  shift_hours:              number
  replications:             number
  queue_overflow_threshold: number
}

interface MM1Result {
  rho:        number
  L:          number
  Lq:         number
  W:          number
  Wq:         number
  throughput: number
  is_stable:  boolean
}

interface MCResult {
  overflow_probability:     number
  avg_queue_length:         number
  avg_waiting_time_s:       number
  avg_utilization:          number
  avg_throughput:           number
  avg_false_positive_rate:  number
  service_time_histogram:   { bin: string; count: number }[]
  queue_over_time:          { t: string; q: number }[]
  replications_run:         number
}

function computeTheoretical(p: SimParams): MM1Result {
  const rho = p.arrival_rate / p.service_rate
  if (rho >= 1) return { rho, L: Infinity, Lq: Infinity, W: Infinity, Wq: Infinity, throughput: p.service_rate, is_stable: false }
  const L  = rho / (1 - rho)
  const Lq = rho ** 2 / (1 - rho)
  const W  = L  / p.arrival_rate
  const Wq = Lq / p.arrival_rate
  return { rho, L, Lq, W, Wq, throughput: p.arrival_rate, is_stable: true }
}

// ─── M/M/c Theoretical (partial — Erlang C pending) ───────────────────────────

interface MMCTheoretical {
  rho_per_server: number   // λ / (c · µ)
  rho_total:      number   // λ / µ  — traffic intensity in Erlangs
  is_stable:      boolean  // rho_per_server < 1
  c:              number
}

function computeMMCTheoretical(p: SimParams & { servers: number }): MMCTheoretical {
  const c              = Math.max(1, Math.floor(p.servers))
  const rho_per_server = p.arrival_rate / (c * p.service_rate)
  return {
    rho_per_server,
    rho_total: p.arrival_rate / p.service_rate,
    is_stable: rho_per_server < 1,
    c,
  }
}

function runSimReplication(p: SimParams, seed: number): {
  overflowed: boolean; maxQ: number; avgWait: number; served: number;
  serviceTimes: number[]; falsePositives: number; queueHistory: { t: number; q: number }[]
} {
  const rng             = new LCG(seed)
  const shiftSec        = p.shift_hours * 3600
  const arrRate         = p.arrival_rate / 3600
  const svcRate         = p.service_rate / 3600

  type Ev = { t: number; type: "ARR" | "SVC_START" | "SVC_END"; id: number }
  const eq: Ev[]  = []
  const schedule  = (ev: Ev) => { eq.push(ev); eq.sort((a, b) => a.t - b.t) }

  let clock = 0, serverBusy = false, nextId = 0, maxQ = 0
  let totalServed = 0, falsePositives = 0
  const waitQ: number[]           = []        // package IDs in queue
  const arrivalTime               = new Map<number, number>()
  const waitTimes: number[]       = []
  const serviceTimes: number[]    = []
  const qHistory: { t: number; q: number }[] = []
  const sampleInterval            = shiftSec / 120  // ~120 samples

  let lastSample = 0
  const sampleQ = () => {
    if (clock - lastSample >= sampleInterval) {
      qHistory.push({ t: clock, q: waitQ.length + (serverBusy ? 1 : 0) })
      lastSample = clock
    }
  }

  const firstArr = rng.exponential(arrRate)
  schedule({ t: firstArr, type: "ARR", id: nextId++ })

  while (eq.length > 0) {
    const ev = eq.shift()!
    if (ev.t > shiftSec) break
    clock = ev.t
    sampleQ()

    if (ev.type === "ARR") {
      arrivalTime.set(ev.id, clock)
      if (!serverBusy) {
        schedule({ t: clock, type: "SVC_START", id: ev.id })
      } else {
        waitQ.push(ev.id)
        if (waitQ.length > maxQ) maxQ = waitQ.length
      }
      const nextT = clock + rng.exponential(arrRate)
      if (nextT < shiftSec) schedule({ t: nextT, type: "ARR", id: nextId++ })

    } else if (ev.type === "SVC_START") {
      serverBusy = true
      const arr = arrivalTime.get(ev.id) ?? clock
      waitTimes.push(clock - arr)
      const svcTime = rng.exponential(svcRate)
      serviceTimes.push(svcTime)
      schedule({ t: clock + svcTime, type: "SVC_END", id: ev.id })

    } else {
      serverBusy = false
      totalServed++
      const isDefect = rng.next() < p.defect_rate
      if (!isDefect && rng.next() < 0.02) falsePositives++
      if (waitQ.length > 0) schedule({ t: clock, type: "SVC_START", id: waitQ.shift()! })
    }
  }

  const avgWait = waitTimes.length ? waitTimes.reduce((a, b) => a + b, 0) / waitTimes.length : 0
  return {
    overflowed: maxQ > p.queue_overflow_threshold,
    maxQ, avgWait, served: totalServed,
    serviceTimes, falsePositives,
    queueHistory: qHistory,
  }
}

function buildHistogram(values: number[], bins: number): { bin: string; count: number }[] {
  if (!values.length) return Array.from({ length: bins }, (_, i) => ({ bin: `${i}`, count: 0 }))
  const min = Math.min(...values)
  const max = Math.max(...values)
  const w   = (max - min) / bins || 1
  const counts = new Array(bins).fill(0)
  for (const v of values) counts[Math.min(Math.floor((v - min) / w), bins - 1)]++
  return counts.map((count, i) => ({
    bin: ((min + i * w) * 1000).toFixed(0) + "ms",
    count,
  }))
}

function runMonteCarlo(p: SimParams): MCResult {
  let overflows = 0
  let sumQ = 0, sumWait = 0, sumUtil = 0, sumThroughput = 0, sumFP = 0
  const allServiceTimes: number[] = []
  let medianHistory: { t: number; q: number }[] = []
  const mid = Math.floor(p.replications / 2)

  for (let i = 0; i < p.replications; i++) {
    const r = runSimReplication(p, i * 31337)
    if (r.overflowed) overflows++
    sumQ         += r.maxQ
    sumWait      += r.avgWait
    sumUtil      += p.arrival_rate / p.service_rate
    sumThroughput += r.served / p.shift_hours
    sumFP        += r.falsePositives / Math.max(r.served, 1)
    allServiceTimes.push(...r.serviceTimes.slice(0, 50))  // cap per-rep contribution
    if (i === mid) medianHistory = r.queueHistory
  }

  const n = p.replications

  // Downsample queue history to ~80 points
  const step = Math.max(1, Math.floor(medianHistory.length / 80))
  const qOverTime = medianHistory
    .filter((_, i) => i % step === 0)
    .map(d => ({ t: (d.t / 3600).toFixed(2), q: d.q }))

  return {
    overflow_probability:     overflows / n,
    avg_queue_length:         sumQ / n,
    avg_waiting_time_s:       sumWait / n,
    avg_utilization:          sumUtil / n,
    avg_throughput:           sumThroughput / n,
    avg_false_positive_rate:  sumFP / n,
    service_time_histogram:   buildHistogram(allServiceTimes, 16),
    queue_over_time:          qOverTime,
    replications_run:         n,
  }
}

// ─── Backend simulation result shape ──────────────────────────────────────────

interface BackendSimResult {
  monte_carlo: {
    replications:              number
    overflow_probability:      number
    avg_queue_length:          number
    avg_waiting_time_s:        number
    avg_utilization:           number
    avg_throughput:            number
    avg_false_positive_impact: number
    service_time_histogram:    number[]               // counts only, no labels
    queue_length_over_time:    { time_s: number; queue_length: number }[]
  }
}

/**
 * Maps a BackendSimResult to the MCResult shape expected by the charts.
 * Histogram bin labels are derived from an expected service-time distribution
 * (3 × mean service time spread across the bin count).
 */
function mapBackendResult(data: BackendSimResult, serviceRate: number): MCResult {
  const mc         = data.monte_carlo
  const avgSvcMs   = 3600_000 / serviceRate                                  // mean ms
  const binCount   = mc.service_time_histogram.length
  const binWidth   = (avgSvcMs * 3) / binCount                               // rough 3σ spread

  const histogram: MCResult["service_time_histogram"] = mc.service_time_histogram.map((count, i) => ({
    bin:   `${Math.round((i + 0.5) * binWidth)}ms`,
    count,
  }))

  const raw  = mc.queue_length_over_time
  const step = Math.max(1, Math.floor(raw.length / 80))
  const qOverTime: MCResult["queue_over_time"] = raw
    .filter((_, i) => i % step === 0)
    .map(pt => ({ t: (pt.time_s / 3600).toFixed(2), q: pt.queue_length }))

  return {
    overflow_probability:    mc.overflow_probability,
    avg_queue_length:        mc.avg_queue_length,
    avg_waiting_time_s:      mc.avg_waiting_time_s,
    avg_utilization:         mc.avg_utilization,
    avg_throughput:          mc.avg_throughput,
    avg_false_positive_rate: mc.avg_false_positive_impact,
    service_time_histogram:  histogram,
    queue_over_time:         qOverTime,
    replications_run:        mc.replications,
  }
}

// ─── Default parameters ────────────────────────────────────────────────────────

const DEFAULTS = {
  arrival_rate:             500,
  service_rate:             600,
  defect_rate:              5,
  shift_hours:              8,
  replications:             100,
  queue_overflow_threshold: 10,
  servers:                  2,
}

// ─── Tooltip components ────────────────────────────────────────────────────────

function LineTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-card border border-border px-3 py-2 text-xs shadow-md">
      <p className="text-muted-foreground mb-0.5">Time: <span className="font-mono">{label}h</span></p>
      <p className="font-semibold tabular-nums">Queue length: {payload[0].value}</p>
    </div>
  )
}

function HistTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-card border border-border px-3 py-2 text-xs shadow-md">
      <p className="text-muted-foreground mb-0.5 font-mono">{label}</p>
      <p className="font-semibold tabular-nums">{payload[0].value} samples</p>
    </div>
  )
}

// ─── Simulation Page ───────────────────────────────────────────────────────────

export function SimulationPage() {
  const [form, setForm]           = useState(DEFAULTS)
  const [results, setResults]     = useState<MCResult | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const [showAssumptions, setShowAssumptions] = useState(false)
  const [runCount, setRunCount]   = useState(0)
  const [aiState, setAiState]     = useState<"idle" | "loading" | "ready">("idle")
  const [modelType, setModelType] = useState<"mm1" | "mmc">("mm1")

  const theoretical = useMemo<MM1Result>(() => computeTheoretical({
    ...form,
    defect_rate: form.defect_rate / 100,
  }), [form])

  const mmcTheoretical = useMemo<MMCTheoretical>(() => computeMMCTheoretical({
    ...form,
    defect_rate: form.defect_rate / 100,
  }), [form])

  const setField = useCallback((key: keyof typeof DEFAULTS, raw: string) => {
    const v = parseFloat(raw)
    if (!isNaN(v) && v > 0) setForm(f => ({ ...f, [key]: v }))
  }, [])

  const handleRun = useCallback(async () => {
    setIsRunning(true)
    try {
      const res = await api.post<{ success: true; data: BackendSimResult }>(
        "/api/v1/simulation/run",
        {
          arrival_rate:             form.arrival_rate,
          service_rate:             form.service_rate,
          defect_rate:              form.defect_rate / 100,
          shift_hours:              form.shift_hours,
          replications:             Math.min(form.replications, 300),
          queue_overflow_threshold: form.queue_overflow_threshold,
        },
      )
      setResults(mapBackendResult(res.data, form.service_rate))
      setRunCount(c => c + 1)
    } catch (err) {
      console.error("Simulation run failed:", err)
    } finally {
      setIsRunning(false)
    }
  }, [form])

  const handleReset = () => {
    setForm(DEFAULTS)
    setResults(null)
    setRunCount(0)
    setAiState("idle")
  }

  const rhoColor =
    theoretical.rho >= 1   ? "text-destructive" :
    theoretical.rho >= 0.8 ? "text-warning"     : "text-success"

  const rhoBarColor =
    theoretical.rho >= 1   ? "bg-destructive" :
    theoretical.rho >= 0.8 ? "bg-warning"     : "bg-success"

  const stabilityBadge = theoretical.is_stable
    ? <Badge variant="stable">Stable System</Badge>
    : <Badge variant="unstable">Unstable — ρ ≥ 1</Badge>

  const mmcRhoColor =
    mmcTheoretical.rho_per_server >= 1   ? "text-destructive" :
    mmcTheoretical.rho_per_server >= 0.8 ? "text-warning"     : "text-success"

  const mmcRhoBarColor =
    mmcTheoretical.rho_per_server >= 1   ? "bg-destructive" :
    mmcTheoretical.rho_per_server >= 0.8 ? "bg-warning"     : "bg-success"

  const mmcStabilityBadge = mmcTheoretical.is_stable
    ? <Badge variant="stable">Stable System</Badge>
    : <Badge variant="unstable">Unstable — ρ ≥ 1</Badge>

  return (
    <div className="flex flex-col gap-4 max-w-[1400px]">

      {/* ── Page Heading ───────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-base font-semibold text-foreground tracking-tight flex items-center gap-2">
            <Activity className="w-4 h-4 text-muted-foreground" strokeWidth={1.5} />
            Queue Simulation
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {modelType === "mm1"
              ? "M/M/1 theoretical analysis + Monte Carlo discrete-event simulation · LCG-seeded, deterministic per replication"
              : "M/M/c multi-server theoretical analysis · Erlang C model · discrete-event simulation coming soon"
            }
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleReset} className="gap-1.5">
            <RotateCcw className="w-3.5 h-3.5" />
            Reset
          </Button>
          <Button
            size="sm"
            onClick={handleRun}
            disabled={isRunning || modelType === "mmc"}
            className="gap-1.5 min-w-[120px]"
          >
            {isRunning
              ? <><span className="w-3 h-3 border border-primary-foreground/50 border-t-primary-foreground animate-spin shrink-0" />Running…</>
              : <><Play className="w-3.5 h-3.5" />Run Simulation</>
            }
          </Button>
        </div>
      </div>

      {/* ── Model Selector ──────────────────────────────────────────────────── */}
      <div className="flex items-center gap-0 border border-border w-fit">
        <button
          onClick={() => { setModelType("mm1"); setResults(null) }}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
            modelType === "mm1"
              ? "bg-foreground text-background"
              : "bg-card text-muted-foreground hover:text-foreground hover:bg-muted/50"
          }`}
        >
          <GitBranch className="w-3 h-3" />
          M/M/1 · Single Server
        </button>
        <div className="w-px self-stretch bg-border" />
        <button
          onClick={() => { setModelType("mmc"); setResults(null) }}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
            modelType === "mmc"
              ? "bg-foreground text-background"
              : "bg-card text-muted-foreground hover:text-foreground hover:bg-muted/50"
          }`}
        >
          <Network className="w-3 h-3" />
          M/M/c · Multi-Server
          {modelType !== "mmc" && (
            <Badge variant="warning" className="text-2xs ml-0.5">Preview</Badge>
          )}
        </button>
      </div>

      {/* ── Row 1: Parameters + Theoretical ────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-3">

        {/* Parameters */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Cpu className="w-3.5 h-3.5" />
              Parameters
            </CardTitle>
            <CardDescription>
              {modelType === "mm1"
                ? "Configure the M/M/1 queue model"
                : "Configure the M/M/c multi-server queue model"
              }
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">

            <ParamField
              id="lambda"
              label="Arrival Rate (λ)"
              unit="pkg/hr"
              value={form.arrival_rate}
              min={1}
              onChange={v => setField("arrival_rate", v)}
              hint="Average packages arriving per hour"
            />
            <ParamField
              id="mu"
              label="Service Rate (µ)"
              unit="pkg/hr"
              value={form.service_rate}
              min={1}
              onChange={v => setField("service_rate", v)}
              hint={modelType === "mmc" ? "Throughput per server per hour" : "Scanner throughput capacity per hour"}
            />

            {modelType === "mmc" && (
              <ParamField
                id="servers"
                label="Number of Servers (c)"
                unit="servers"
                value={form.servers}
                min={2}
                max={50}
                step={1}
                onChange={v => setField("servers", v)}
                hint="Parallel scanner stations handling the shared queue"
              />
            )}
            <ParamField
              id="defect"
              label="Defect Rate"
              unit="%"
              value={form.defect_rate}
              min={0}
              max={100}
              step={0.1}
              onChange={v => setField("defect_rate", v)}
              hint="Expected fraction of damaged packages"
            />

            <Separator />

            <ParamField
              id="shift"
              label="Shift Duration"
              unit="hours"
              value={form.shift_hours}
              min={1}
              max={24}
              onChange={v => setField("shift_hours", v)}
              hint="Simulation time window"
            />
            <ParamField
              id="reps"
              label="Replications"
              unit="runs"
              value={form.replications}
              min={10}
              max={300}
              step={10}
              onChange={v => setField("replications", v)}
              hint="Monte Carlo independent replications (max 300)"
            />
            <ParamField
              id="overflow"
              label="Overflow Threshold"
              unit="items"
              value={form.queue_overflow_threshold}
              min={1}
              onChange={v => setField("queue_overflow_threshold", v)}
              hint="Queue length that triggers overflow flag"
            />

            <Button
              className="w-full mt-1 gap-1.5"
              onClick={handleRun}
              disabled={isRunning || modelType === "mmc"}
            >
              {isRunning
                ? <><span className="w-3 h-3 border border-primary-foreground/50 border-t-primary-foreground animate-spin" />Running…</>
                : modelType === "mmc"
                  ? <><Server className="w-3.5 h-3.5" />Simulation Coming Soon</>
                  : <><Play className="w-3.5 h-3.5" />Run Simulation</>
              }
            </Button>
          </CardContent>
        </Card>

        {/* Theoretical Panel — M/M/1 */}
        {modelType === "mm1" && (
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between w-full">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <GitBranch className="w-3.5 h-3.5" />
                    Theoretical M/M/1 Metrics
                  </CardTitle>
                  <CardDescription>Closed-form results — updates live as parameters change</CardDescription>
                </div>
                {stabilityBadge}
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">

              {/* Utilization ρ — hero metric */}
              <div className="border border-border p-3 bg-muted/20">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Server Utilization (ρ = λ/µ)
                  </span>
                  <span className={`text-lg font-semibold tabular-nums font-mono ${rhoColor}`}>
                    {(theoretical.rho * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="w-full h-1.5 bg-muted">
                  <div
                    className={`h-full transition-all duration-300 ${rhoBarColor}`}
                    style={{ width: `${Math.min(theoretical.rho * 100, 100)}%` }}
                  />
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-2xs text-muted-foreground">0%</span>
                  <span className="text-2xs text-warning">Warn 80%</span>
                  <span className="text-2xs text-muted-foreground">100%</span>
                </div>
              </div>

              {/* Metrics grid */}
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                <MetricTile
                  label="Avg Items in System (L)"
                  value={theoretical.is_stable ? theoretical.L.toFixed(3) : "∞"}
                  unit="packages"
                  color={theoretical.L > 5 ? "warn" : undefined}
                />
                <MetricTile
                  label="Avg Items in Queue (Lq)"
                  value={theoretical.is_stable ? theoretical.Lq.toFixed(3) : "∞"}
                  unit="packages"
                  color={theoretical.Lq > 3 ? "warn" : undefined}
                />
                <MetricTile
                  label="Throughput"
                  value={theoretical.is_stable ? theoretical.throughput.toFixed(0) : "—"}
                  unit="pkg/hr"
                />
                <MetricTile
                  label="Avg Time in System (W)"
                  value={theoretical.is_stable ? (theoretical.W * 3600).toFixed(2) : "∞"}
                  unit="seconds"
                  color={theoretical.W * 3600 > 30 ? "warn" : undefined}
                />
                <MetricTile
                  label="Avg Wait in Queue (Wq)"
                  value={theoretical.is_stable ? (theoretical.Wq * 3600).toFixed(2) : "∞"}
                  unit="seconds"
                  color={theoretical.Wq * 3600 > 20 ? "warn" : undefined}
                />
                <MetricTile
                  label="P(idle)"
                  value={theoretical.is_stable ? ((1 - theoretical.rho) * 100).toFixed(1) + "%" : "0%"}
                  unit="server idle prob."
                />
              </div>

              {/* Unstable warning */}
              {!theoretical.is_stable && (
                <div className="flex items-start gap-2 border border-destructive/30 bg-destructive/5 p-3">
                  <AlertTriangle className="w-3.5 h-3.5 text-destructive shrink-0 mt-0.5" />
                  <p className="text-xs text-destructive">
                    System is <strong>unstable</strong> — arrival rate exceeds service capacity (ρ ≥ 1).
                    The queue will grow without bound. Increase µ or decrease λ to stabilize.
                  </p>
                </div>
              )}

              {/* Formula reference */}
              <div className="border border-border bg-muted/30 p-3">
                <p className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">M/M/1 Formulas</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                  {[
                    ["ρ = λ / µ", "Utilization"],
                    ["L = ρ / (1−ρ)", "Avg in system"],
                    ["Lq = ρ² / (1−ρ)", "Avg in queue"],
                    ["W = L / λ", "Avg system time"],
                    ["Wq = Lq / λ", "Avg wait time"],
                    ["P₀ = 1 − ρ", "Idle probability"],
                  ].map(([f, d]) => (
                    <div key={f} className="flex items-baseline gap-1.5">
                      <span className="font-mono text-2xs text-foreground">{f}</span>
                      <span className="text-2xs text-muted-foreground">— {d}</span>
                    </div>
                  ))}
                </div>
              </div>

            </CardContent>
          </Card>
        )}

        {/* Theoretical Panel — M/M/c */}
        {modelType === "mmc" && (
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between w-full">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Server className="w-3.5 h-3.5" />
                    Theoretical M/M/c Metrics
                  </CardTitle>
                  <CardDescription>
                    Multi-server Erlang C model · c = {mmcTheoretical.c} servers · updates live
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  {mmcStabilityBadge}
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">

              {/* Per-server utilization ρ — hero metric */}
              <div className="border border-border p-3 bg-muted/20">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Per-Server Utilization (ρ = λ / c·µ)
                  </span>
                  <span className={`text-lg font-semibold tabular-nums font-mono ${mmcRhoColor}`}>
                    {(mmcTheoretical.rho_per_server * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="w-full h-1.5 bg-muted">
                  <div
                    className={`h-full transition-all duration-300 ${mmcRhoBarColor}`}
                    style={{ width: `${Math.min(mmcTheoretical.rho_per_server * 100, 100)}%` }}
                  />
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-2xs text-muted-foreground">0%</span>
                  <span className="text-2xs text-warning">Warn 80%</span>
                  <span className="text-2xs text-muted-foreground">100%</span>
                </div>
              </div>

              {/* Metrics grid */}
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                <MetricTile
                  label="Traffic Intensity (a = λ/µ)"
                  value={mmcTheoretical.rho_total.toFixed(3)}
                  unit="Erlangs"
                  color={mmcTheoretical.rho_total >= mmcTheoretical.c ? "destructive" : undefined}
                />
                <MetricTile
                  label="Active Servers (c)"
                  value={mmcTheoretical.c.toString()}
                  unit="parallel stations"
                />
                <MetricTile
                  label="System Capacity (c·µ)"
                  value={(mmcTheoretical.c * form.service_rate).toLocaleString()}
                  unit="pkg/hr total"
                />
                {/* Erlang C derived — pending */}
                <MetricTile label="P(wait) — Erlang C" value="—" unit="pending" />
                <MetricTile label="Avg Queue Length (Lq)" value="—" unit="pending" />
                <MetricTile label="Avg Wait in Queue (Wq)" value="—" unit="pending" />
              </div>

              {/* Pending Erlang C notice */}
              <div className="flex items-start gap-2 border border-border bg-muted/20 p-3">
                <Info className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground">
                  <strong className="text-foreground">Erlang C computation pending.</strong>{" "}
                  P₀, Pq, Lq, Wq, L, and W require the Erlang C formula and will be available once the
                  M/M/c simulation engine is implemented. Per-server utilization ρ = λ/(c·µ) is computed above.
                </p>
              </div>

              {/* Unstable warning */}
              {!mmcTheoretical.is_stable && (
                <div className="flex items-start gap-2 border border-destructive/30 bg-destructive/5 p-3">
                  <AlertTriangle className="w-3.5 h-3.5 text-destructive shrink-0 mt-0.5" />
                  <p className="text-xs text-destructive">
                    System is <strong>unstable</strong> — arrival rate exceeds total service capacity (ρ ≥ 1).
                    The queue will grow without bound. Increase µ, c, or decrease λ.
                  </p>
                </div>
              )}

              {/* Formula reference */}
              <div className="border border-border bg-muted/30 p-3">
                <p className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">M/M/c Formulas</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                  {[
                    ["ρ = λ / (c·µ)", "Per-server utilization"],
                    ["a = λ / µ", "Traffic intensity (Erlangs)"],
                    ["C(c,a) = Erlang-C", "Probability of waiting"],
                    ["Lq = C(c,a)·ρ / (1−ρ)²", "Avg items in queue"],
                    ["Wq = Lq / λ", "Avg wait in queue"],
                    ["P₀ = [Σaⁿ/n! + aᶜ/(c!(1−ρ))]⁻¹", "Idle probability"],
                  ].map(([f, d]) => (
                    <div key={f} className="flex items-baseline gap-1.5">
                      <span className="font-mono text-2xs text-foreground">{f}</span>
                      <span className="text-2xs text-muted-foreground">— {d}</span>
                    </div>
                  ))}
                </div>
              </div>

            </CardContent>
          </Card>
        )}
      </div>

      {/* ── M/M/c Coming Soon ──────────────────────────────────────────────── */}
      {modelType === "mmc" && (
        <div className="border border-dashed border-border bg-muted/20 flex flex-col items-center justify-center py-14 gap-3">
          <div className="w-12 h-12 border border-border bg-card flex items-center justify-center">
            <Network className="w-6 h-6 text-muted-foreground/40" strokeWidth={1.5} />
          </div>
          <p className="text-sm font-medium text-muted-foreground">M/M/c Simulation Engine Coming Soon</p>
          <p className="text-xs text-muted-foreground/70 text-center max-w-sm">
            The multi-server discrete-event simulation (Erlang C, parallel queues, per-server metrics) is
            under active development. Theoretical parameters above update live.
          </p>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="warning" className="text-xs gap-1">
              <span className="w-1.5 h-1.5 bg-warning inline-block animate-pulse" />
              In Development
            </Badge>
            <Badge variant="stable" className="text-xs">UI Preview Active</Badge>
          </div>
          <div className="border border-border bg-card p-4 mt-2 w-full max-w-sm">
            <p className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Planned M/M/c Features
            </p>
            <div className="flex flex-col gap-2">
              {[
                { icon: CheckCircle2, label: "Per-server utilization (ρ = λ/c·µ)", done: true },
                { icon: CheckCircle2, label: "Traffic intensity display (Erlangs)", done: true },
                { icon: CheckCircle2, label: "Stability condition check", done: true },
                { icon: AlertTriangle, label: "Erlang C probability computation", done: false },
                { icon: AlertTriangle, label: "Lq, Wq, L, W closed-form metrics", done: false },
                { icon: AlertTriangle, label: "Multi-server discrete-event engine", done: false },
                { icon: AlertTriangle, label: "Monte Carlo multi-server replications", done: false },
              ].map(({ icon: Icon, label, done }) => (
                <div key={label} className="flex items-center gap-2">
                  <Icon
                    className={`w-3 h-3 shrink-0 ${done ? "text-success" : "text-muted-foreground/50"}`}
                    strokeWidth={1.5}
                  />
                  <span className={`text-xs ${done ? "text-foreground" : "text-muted-foreground"}`}>{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Monte Carlo Results ─────────────────────────────────────────────── */}
      {modelType === "mm1" && results && (
        <>
          {/* Section header */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-success" />
              <span className="text-sm font-semibold text-foreground">Monte Carlo Results</span>
            </div>
            <span className="text-xs text-muted-foreground font-mono">
              Run #{runCount} · {results.replications_run} replications · LCG seed 31337×i
            </span>
            <Badge variant="stable" className="text-2xs">Complete</Badge>
          </div>

          {/* KPI summary row */}
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
            <MCKpiCard
              label="Overflow Probability"
              value={`${(results.overflow_probability * 100).toFixed(1)}%`}
              icon={AlertTriangle}
              sub={`threshold: >${form.queue_overflow_threshold} items`}
              color={results.overflow_probability > 0.2 ? "destructive" : results.overflow_probability > 0.05 ? "warn" : "success"}
            />
            <MCKpiCard
              label="Avg Max Queue"
              value={results.avg_queue_length.toFixed(1)}
              icon={Layers}
              sub="items (peak)"
              color={results.avg_queue_length > form.queue_overflow_threshold ? "warn" : undefined}
            />
            <MCKpiCard
              label="Avg Waiting Time"
              value={`${results.avg_waiting_time_s.toFixed(2)}s`}
              icon={Clock}
              sub="per package in queue"
              color={results.avg_waiting_time_s > 30 ? "warn" : undefined}
            />
            <MCKpiCard
              label="Avg Utilization"
              value={`${(results.avg_utilization * 100).toFixed(1)}%`}
              icon={Activity}
              sub="simulated server load"
              color={results.avg_utilization > 0.9 ? "destructive" : results.avg_utilization > 0.75 ? "warn" : "success"}
            />
            <MCKpiCard
              label="Avg Throughput"
              value={results.avg_throughput.toFixed(0)}
              icon={TrendingUp}
              sub="packages served / hr"
            />
            <MCKpiCard
              label="False Positive Rate"
              value={`${(results.avg_false_positive_rate * 100).toFixed(2)}%`}
              icon={XCircle}
              sub="good pkgs flagged as damaged"
              color={results.avg_false_positive_rate > 0.03 ? "warn" : undefined}
            />
          </div>

          {/* Charts row */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-3">

            {/* Queue length over time */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="w-3.5 h-3.5" />
                  Queue Length Over Time
                </CardTitle>
                <CardDescription>
                  Discrete-event trace · median replication · x-axis in shift hours
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4">
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={results.queue_over_time} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="2 4" stroke={C.grid} vertical={false} />
                    <XAxis
                      dataKey="t"
                      tick={{ fontSize: 10, fill: C.text }}
                      axisLine={false} tickLine={false}
                      label={{ value: "hours", position: "insideBottomRight", offset: -4, style: { fontSize: 9, fill: C.text } }}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: C.text }}
                      axisLine={false} tickLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip content={<LineTooltip />} cursor={{ stroke: C.grid, strokeWidth: 1 }} />
                    <ReferenceLine
                      y={form.queue_overflow_threshold}
                      stroke={C.damaged}
                      strokeDasharray="4 3"
                      strokeWidth={1}
                      label={{ value: "overflow threshold", position: "insideTopRight", style: { fontSize: 9, fill: C.damaged } }}
                    />
                    <Line
                      type="stepAfter"
                      dataKey="q"
                      stroke={C.primary}
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4, fill: C.primary, strokeWidth: 0 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Service time histogram */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-3.5 h-3.5" />
                  Service Time Distribution
                </CardTitle>
                <CardDescription>
                  Histogram of sampled service times · all replications
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4">
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={results.service_time_histogram} margin={{ top: 4, right: 4, left: -28, bottom: 0 }} barSize={14}>
                    <CartesianGrid strokeDasharray="2 4" stroke={C.grid} vertical={false} />
                    <XAxis
                      dataKey="bin"
                      tick={{ fontSize: 9, fill: C.text }}
                      axisLine={false} tickLine={false}
                      interval={3}
                      angle={-30}
                      textAnchor="end"
                      height={30}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: C.text }}
                      axisLine={false} tickLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip content={<HistTooltip />} cursor={{ fill: "#ffffff14" }} />
                    <Bar dataKey="count" radius={[0, 0, 0, 0]}>
                      {results.service_time_histogram.map((_, i) => (
                        <Cell
                          key={i}
                          fill={i < 4 ? C.success : i > 11 ? C.damaged : C.primary}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <p className="text-2xs text-muted-foreground mt-2">
                  Exponential distribution expected · µ = {form.service_rate}/hr → mean ≈ {(3600 / form.service_rate).toFixed(2)}s
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Comparison: theoretical vs simulated */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Info className="w-3.5 h-3.5" />
                Theoretical vs. Simulated Comparison
              </CardTitle>
              <CardDescription>
                Closed-form M/M/1 formulas vs. Monte Carlo discrete-event averages
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/60 border-b border-border">
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Metric</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Theoretical</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Simulated</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Δ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {[
                    {
                      label:  "Utilization (ρ)",
                      theory: `${(theoretical.rho * 100).toFixed(2)}%`,
                      sim:    `${(results.avg_utilization * 100).toFixed(2)}%`,
                      delta:  Math.abs(theoretical.rho - results.avg_utilization) < 0.05,
                    },
                    {
                      label:  "Avg Wait in Queue (Wq)",
                      theory: theoretical.is_stable ? `${(theoretical.Wq * 3600).toFixed(2)}s` : "∞",
                      sim:    `${results.avg_waiting_time_s.toFixed(2)}s`,
                      delta:  theoretical.is_stable && Math.abs(theoretical.Wq * 3600 - results.avg_waiting_time_s) < 5,
                    },
                    {
                      label:  "Overflow Probability",
                      theory: "N/A (formula)",
                      sim:    `${(results.overflow_probability * 100).toFixed(1)}%`,
                      delta:  null,
                    },
                    {
                      label:  "Throughput",
                      theory: theoretical.is_stable ? `${theoretical.throughput.toFixed(0)} pkg/hr` : "—",
                      sim:    `${results.avg_throughput.toFixed(0)} pkg/hr`,
                      delta:  theoretical.is_stable && Math.abs(theoretical.throughput - results.avg_throughput) / theoretical.throughput < 0.1,
                    },
                  ].map(row => (
                    <tr key={row.label} className="hover:bg-accent/40">
                      <td className="px-3 py-2 text-xs text-foreground font-medium">{row.label}</td>
                      <td className="px-3 py-2 text-xs text-right font-mono text-muted-foreground">{row.theory}</td>
                      <td className="px-3 py-2 text-xs text-right font-mono font-medium">{row.sim}</td>
                      <td className="px-3 py-2 text-right">
                        {row.delta === null
                          ? <span className="text-2xs text-muted-foreground">—</span>
                          : row.delta
                            ? <span className="text-2xs text-success flex items-center justify-end gap-0.5"><CheckCircle2 className="w-2.5 h-2.5" />Converging</span>
                            : <span className="text-2xs text-warning flex items-center justify-end gap-0.5"><AlertTriangle className="w-2.5 h-2.5" />Diverging</span>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          {/* ── AI Analysis ──────────────────────────────────────────────────── */}
          <AIAnalysisSection
            aiState={aiState}
            onGenerate={() => {
              setAiState("loading")
              // Logic will be implemented later — simulate a delay for UI preview
              setTimeout(() => setAiState("ready"), 1800)
            }}
          />
        </>
      )}

      {/* ── Empty state (no run yet, M/M/1 only) ──────────────────────────── */}
      {modelType === "mm1" && !results && !isRunning && (
        <div className="border border-dashed border-border bg-muted/20 flex flex-col items-center justify-center py-14 gap-3">
          <Activity className="w-8 h-8 text-muted-foreground/40" strokeWidth={1.5} />
          <p className="text-sm font-medium text-muted-foreground">No simulation run yet</p>
          <p className="text-xs text-muted-foreground/70">Configure parameters above and click <strong>Run Simulation</strong>.</p>
          <Button size="sm" onClick={handleRun} className="gap-1.5 mt-1">
            <Play className="w-3.5 h-3.5" />
            Run Simulation
          </Button>
        </div>
      )}

      {/* ── Model Assumptions ──────────────────────────────────────────────── */}
      <div className="border border-border">
        <button
          onClick={() => setShowAssumptions(v => !v)}
          className="w-full flex items-center justify-between px-4 py-2.5 bg-muted/30 hover:bg-muted/50 transition-colors text-left"
        >
          <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Info className="w-3.5 h-3.5" />
            Model Assumptions &amp; Notes
          </span>
          {showAssumptions
            ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
            : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
          }
        </button>
        {showAssumptions && (
          <div className="p-4 flex flex-col gap-4">
            {modelType === "mm1" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-3">
                {[
                  ["Single server (M/M/1)", "One scanner station handles the queue. For multi-server systems, switch to M/M/c above."],
                  ["Poisson arrivals", "Package arrivals follow a Poisson process with rate λ. Inter-arrival times are exponential."],
                  ["Exponential service times", "Each package scan time is exponentially distributed with mean 1/µ seconds."],
                  ["FCFS discipline", "First-come, first-served queue ordering. No priority classes."],
                  ["Infinite queue capacity", "No hard queue limit — overflow threshold only triggers a probability flag."],
                  ["Independent replications", "Each Monte Carlo run uses a different LCG seed (seed = 31337 × i), ensuring statistical independence."],
                  ["False positives (2%)", "2% of non-defective packages are incorrectly classified as damaged by the AI model."],
                  ["Deterministic LCG", "Linear Congruential Generator with Knuth MMIX constants ensures reproducibility."],
                  ["Median time-series", "Queue length chart shows the median replication — not averaged — to avoid smoothing artifacts."],
                ].map(([title, body]) => (
                  <div key={title}>
                    <p className="text-xs font-semibold text-foreground mb-0.5">{title}</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">{body}</p>
                  </div>
                ))}
              </div>
            )}
            {modelType === "mmc" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-3">
                {[
                  ["Multi-server (M/M/c)", "c identical servers draw from a single shared queue. Stability requires ρ = λ/(c·µ) < 1."],
                  ["Poisson arrivals", "Package arrivals follow a Poisson process with rate λ. Inter-arrival times are exponential."],
                  ["Exponential service times", "Each scanner's service time is exponentially distributed with mean 1/µ seconds per server."],
                  ["Shared FCFS queue", "All arriving packages join a single queue and are dispatched to the next free server (FCFS)."],
                  ["Homogeneous servers", "All c servers have identical service rates µ. Heterogeneous rates require M/M/c(k) extensions."],
                  ["Erlang C model", "Erlang C gives the probability that an arrival must wait (Pq). Requires solving P₀ iteratively."],
                  ["Stability condition", "System is stable only when ρ = λ/(c·µ) < 1, i.e., total offered load is below total capacity."],
                  ["Infinite queue capacity", "No hard queue limit — overflow threshold only triggers a probability flag."],
                  ["Simulation pending", "M/M/c discrete-event simulation and Erlang C metrics will be added in a future update."],
                ].map(([title, body]) => (
                  <div key={title}>
                    <p className="text-xs font-semibold text-foreground mb-0.5">{title}</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">{body}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

    </div>
  )
}

// ─── Parameter Field ───────────────────────────────────────────────────────────

function ParamField({
  id, label, unit, value, min, max, step = 1, onChange, hint,
}: {
  id: string; label: string; unit: string; value: number
  min?: number; max?: number; step?: number
  onChange: (v: string) => void; hint?: string
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <Label htmlFor={id} className="text-xs font-medium">{label}</Label>
        <span className="text-2xs text-muted-foreground">{unit}</span>
      </div>
      <Input
        id={id}
        type="number"
        defaultValue={value}
        key={value}        // reset input when reset is clicked
        min={min}
        max={max}
        step={step}
        onChange={e => onChange(e.target.value)}
        className="h-8 text-sm font-mono"
      />
      {hint && <p className="text-2xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

// ─── Metric Tile ───────────────────────────────────────────────────────────────

function MetricTile({
  label, value, unit, color,
}: {
  label: string; value: string; unit: string; color?: "warn" | "success" | "destructive"
}) {
  const valClass =
    color === "destructive" ? "text-destructive" :
    color === "warn"        ? "text-warning"     :
    color === "success"     ? "text-success"     :
                              "text-foreground"

  return (
    <div className="border border-border p-2.5 bg-card flex flex-col gap-1">
      <span className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground leading-tight">{label}</span>
      <span className={`text-md font-semibold tabular-nums font-mono ${valClass}`}>{value}</span>
      <span className="text-2xs text-muted-foreground">{unit}</span>
    </div>
  )
}

// ─── Monte Carlo KPI Card ──────────────────────────────────────────────────────

function MCKpiCard({
  label, value, icon: Icon, sub, color,
}: {
  label: string; value: string; icon: React.ElementType; sub: string
  color?: "success" | "warn" | "destructive"
}) {
  const valClass =
    color === "destructive" ? "stat-card-value text-destructive" :
    color === "warn"        ? "stat-card-value text-warning"     :
    color === "success"     ? "stat-card-value text-success"     :
                              "stat-card-value"

  return (
    <div className="stat-card">
      <div className="flex items-start justify-between gap-2">
        <span className="stat-card-label">{label}</span>
        <Icon className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" strokeWidth={1.5} />
      </div>
      <span className={valClass}>{value}</span>
      <span className="text-2xs text-muted-foreground">{sub}</span>
    </div>
  )
}

// ─── AI Analysis Section ───────────────────────────────────────────────────────

function AIAnalysisSection({
  aiState,
  onGenerate,
}: {
  aiState:    "idle" | "loading" | "ready"
  onGenerate: () => void
}) {
  return (
    <Card className="border-border">
      <CardHeader>
        <div className="flex items-start justify-between w-full">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-warning" />
              AI Analysis
            </CardTitle>
            <CardDescription>
              Claude-powered interpretation of your simulation results — plain-language insights and recommendations
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {aiState === "ready" && (
              <Badge variant="stable" className="text-2xs">Analysis Ready</Badge>
            )}
            {aiState === "loading" && (
              <Badge variant="warning" className="text-2xs">
                <span className="w-1.5 h-1.5 bg-warning inline-block mr-1 animate-pulse" />
                Generating…
              </Badge>
            )}
            <Button
              variant={aiState === "ready" ? "outline" : "default"}
              size="sm"
              onClick={onGenerate}
              disabled={aiState === "loading"}
              className="gap-1.5"
            >
              {aiState === "loading"
                ? <><span className="w-3 h-3 border border-primary-foreground/40 border-t-primary-foreground animate-spin shrink-0" />Generating…</>
                : aiState === "ready"
                  ? <><RotateCcw className="w-3.5 h-3.5" />Regenerate</>
                  : <><Sparkles className="w-3.5 h-3.5" />Generate Analysis</>
              }
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">

        {/* ── Idle state ────────────────────────────────────────────────────── */}
        {aiState === "idle" && (
          <div className="flex flex-col items-center justify-center py-12 gap-3 border-t border-border bg-muted/10">
            <div className="w-10 h-10 border border-border bg-card flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-muted-foreground/40" strokeWidth={1.5} />
            </div>
            <p className="text-sm font-medium text-muted-foreground">No analysis generated yet</p>
            <p className="text-xs text-muted-foreground/70 text-center max-w-sm">
              Click <strong>Generate Analysis</strong> to get a plain-language breakdown of your simulation results, key findings, and actionable recommendations.
            </p>
            <Button size="sm" onClick={onGenerate} className="gap-1.5 mt-1">
              <Sparkles className="w-3.5 h-3.5" />
              Generate Analysis
            </Button>
          </div>
        )}

        {/* ── Loading skeleton ──────────────────────────────────────────────── */}
        {aiState === "loading" && (
          <div className="border-t border-border p-4 flex flex-col gap-4">
            {/* Skeleton header */}
            <div className="flex items-center gap-2">
              <div className="w-3.5 h-3.5 bg-muted animate-pulse" />
              <div className="h-3 w-32 bg-muted animate-pulse" />
            </div>
            {/* Skeleton lines */}
            <div className="flex flex-col gap-2">
              <div className="h-3 w-full bg-muted animate-pulse" />
              <div className="h-3 w-[92%] bg-muted animate-pulse" />
              <div className="h-3 w-[78%] bg-muted animate-pulse" />
            </div>
            <Separator />
            <div className="flex items-center gap-2">
              <div className="w-3.5 h-3.5 bg-muted animate-pulse" />
              <div className="h-3 w-28 bg-muted animate-pulse" />
            </div>
            <div className="flex flex-col gap-2">
              {[85, 70, 90, 60].map(w => (
                <div key={w} className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 bg-muted animate-pulse mt-1.5 shrink-0" />
                  <div className={`h-3 bg-muted animate-pulse`} style={{ width: `${w}%` }} />
                </div>
              ))}
            </div>
            <Separator />
            <div className="flex items-center gap-2">
              <div className="w-3.5 h-3.5 bg-muted animate-pulse" />
              <div className="h-3 w-36 bg-muted animate-pulse" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="border border-border p-3 flex flex-col gap-2">
                  <div className="h-3 w-24 bg-muted animate-pulse" />
                  <div className="h-3 w-full bg-muted animate-pulse" />
                  <div className="h-3 w-[80%] bg-muted animate-pulse" />
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-warning inline-block animate-pulse" />
              Analyzing simulation parameters and results…
            </p>
          </div>
        )}

        {/* ── Analysis output ───────────────────────────────────────────────── */}
        {aiState === "ready" && (
          <div className="border-t border-border divide-y divide-border">

            {/* Summary */}
            <div className="p-4 flex flex-col gap-2">
              <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <Activity className="w-3.5 h-3.5" />
                Summary
              </h3>
              <div className="h-3 w-full bg-muted/60" />
              <div className="h-3 w-[88%] bg-muted/60" />
              <div className="h-3 w-[74%] bg-muted/60" />
              <p className="text-xs text-muted-foreground italic mt-1">
                AI-generated summary will appear here once the Claude API is connected.
              </p>
            </div>

            {/* Key Findings */}
            <div className="p-4 flex flex-col gap-2.5">
              <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <Lightbulb className="w-3.5 h-3.5" />
                Key Findings
              </h3>
              {[
                { color: "bg-success",     label: "Queue stability assessment based on ρ value" },
                { color: "bg-warning",     label: "Overflow risk analysis across all replications" },
                { color: "bg-primary",     label: "Service time distribution interpretation" },
                { color: "bg-muted-foreground", label: "False positive impact on quality metrics" },
              ].map(({ color, label }) => (
                <div key={label} className="flex items-start gap-2.5">
                  <span className={`w-1.5 h-1.5 ${color} shrink-0 mt-1.5`} />
                  <div className="flex-1 flex flex-col gap-1">
                    <div className="h-2.5 bg-muted/60 w-full" />
                    <p className="text-2xs text-muted-foreground italic">{label}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Recommendations */}
            <div className="p-4 flex flex-col gap-2.5">
              <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <ListChecks className="w-3.5 h-3.5" />
                Recommendations
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { icon: TrendingUp,  label: "Throughput Optimization",  desc: "Parameter tuning suggestions to improve scanner utilization" },
                  { icon: ShieldAlert, label: "Risk Mitigation",           desc: "Actions to reduce overflow probability and queue buildup" },
                  { icon: Cpu,         label: "Capacity Planning",         desc: "Staffing and equipment recommendations based on λ/µ ratio" },
                ].map(({ icon: Icon, label, desc }) => (
                  <div key={label} className="border border-border p-3 bg-muted/10 flex flex-col gap-1.5">
                    <div className="flex items-center gap-1.5">
                      <Icon className="w-3.5 h-3.5 text-muted-foreground" strokeWidth={1.5} />
                      <span className="text-xs font-semibold text-foreground">{label}</span>
                    </div>
                    <div className="h-2.5 bg-muted/60 w-full" />
                    <div className="h-2.5 bg-muted/60 w-[80%]" />
                    <p className="text-2xs text-muted-foreground italic mt-0.5">{desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Risk assessment footer */}
            <div className="px-4 py-2.5 bg-muted/20 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-3.5 h-3.5 text-muted-foreground" strokeWidth={1.5} />
                <span className="text-xs text-muted-foreground">Overall Risk Level</span>
                <div className="h-2.5 w-20 bg-muted/70" />
              </div>
              <p className="text-2xs text-muted-foreground italic">
                Powered by Claude · Analysis reflects current run parameters only
              </p>
            </div>

          </div>
        )}

      </CardContent>
    </Card>
  )
}
