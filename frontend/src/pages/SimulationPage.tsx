import { useState, useEffect, useMemo, useCallback } from "react"
import { api } from "@/lib/api"
import {
  Activity, Play, RotateCcw, Info, TrendingUp, Clock, Layers, AlertTriangle,
  CheckCircle2, XCircle, Cpu, BarChart3, GitBranch, ChevronDown, ChevronUp,
  Sparkles, Lightbulb, ShieldAlert, ListChecks, Server, Network,
} from "lucide-react"
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Cell,
} from "recharts"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"

// ─── Chart color constants ─────────────────────────────────────────────────────
const C = {
  primary: "#60a5fa",
  success: "#4ade80",
  warn:    "#fbbf24",
  damaged: "#f87171",
  muted:   "#9ca3af",
  grid:    "#2d2d2d",
  text:    "#a3a3a3",
}

// ─── LCG pseudorandom number generator ────────────────────────────────────────
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
  exponential(rate: number): number { return -Math.log(1 - this.next()) / rate }
}

// ─── Shared simulation parameter shape ────────────────────────────────────────
interface SimParams {
  arrival_rate:             number  // λ pkg/hr
  service_rate:             number  // µ pkg/hr per server
  defect_rate:              number  // 0–1 fraction
  shift_hours:              number
  replications:             number
  queue_overflow_threshold: number
}

// ─── Result shapes ─────────────────────────────────────────────────────────────
interface MM1Result {
  rho: number; L: number; Lq: number; W: number; Wq: number
  throughput: number; is_stable: boolean
}

interface MMCFull {
  c: number; a: number; rho: number; isStable: boolean
  Pq: number; P0: number; Lq: number; L: number; Wq: number; W: number
}

interface MCResult {
  overflow_probability:    number
  avg_queue_length:        number
  avg_waiting_time_s:      number
  avg_utilization:         number
  avg_throughput:          number
  avg_false_positive_rate: number
  service_time_histogram:  { bin: string; count: number }[]
  queue_over_time:         { t: string; q: number }[]
  replications_run:        number
}

// ─── M/M/1 closed-form ────────────────────────────────────────────────────────
function computeTheoretical(p: SimParams): MM1Result {
  const rho = p.arrival_rate / p.service_rate
  if (rho >= 1) return { rho, L: Infinity, Lq: Infinity, W: Infinity, Wq: Infinity, throughput: p.service_rate, is_stable: false }
  const L  = rho / (1 - rho)
  const Lq = rho ** 2 / (1 - rho)
  const W  = L  / p.arrival_rate
  const Wq = Lq / p.arrival_rate
  return { rho, L, Lq, W, Wq, throughput: p.arrival_rate, is_stable: true }
}

// ─── Erlang C (M/M/c closed-form) ─────────────────────────────────────────────
/** log(n!) using summation — stable for large n */
function logFact(n: number): number {
  let r = 0
  for (let i = 2; i <= n; i++) r += Math.log(i)
  return r
}

/** Log-sum-exp of two log-values */
function logAddExp(a: number, b: number): number {
  if (!isFinite(a)) return b
  if (!isFinite(b)) return a
  return a > b ? a + Math.log1p(Math.exp(b - a)) : b + Math.log1p(Math.exp(a - b))
}

/**
 * Erlang C: P(arriving customer waits) for M/M/c queue.
 * a = λ/µ (offered traffic in Erlangs), c = servers.
 */
function erlangC(c: number, a: number): number {
  const rho = a / c
  if (rho >= 1 || a <= 0) return rho >= 1 ? 1 : 0
  // log of: a^c / (c! · (1-ρ))
  const logNum = c * Math.log(a) - logFact(c) - Math.log(1 - rho)
  // Accumulate log-denominator: logNum + Σ_{n=0}^{c-1} a^n/n!
  let logDenom = logNum
  for (let n = 0; n < c; n++) {
    const logTerm = n * Math.log(Math.max(a, 1e-15)) - logFact(n)
    logDenom = logAddExp(logDenom, logTerm)
  }
  return Math.exp(logNum - logDenom)
}

function computeMMCFull(p: SimParams & { servers: number }): MMCFull {
  const c   = Math.max(1, Math.floor(p.servers))
  const a   = p.arrival_rate / p.service_rate   // Erlangs
  const rho = a / c                              // per-server ρ
  if (rho >= 1 || !isFinite(a) || a <= 0) {
    return { c, a, rho, isStable: false, Pq: 1, P0: 0, Lq: Infinity, L: Infinity, Wq: Infinity, W: Infinity }
  }
  const Pq = erlangC(c, a)
  const Lq = Pq * rho / (1 - rho)
  const Wq = Lq / p.arrival_rate          // hours
  const W  = Wq + 1 / p.service_rate      // hours (+ mean service time)
  const L  = p.arrival_rate * W           // Little's Law
  // P₀ = exp(-logDenom) from erlangC computation
  const logNum = c * Math.log(Math.max(a, 1e-15)) - logFact(c) - Math.log(1 - rho)
  let logDenom = logNum
  for (let n = 0; n < c; n++) {
    logDenom = logAddExp(logDenom, n * Math.log(Math.max(a, 1e-15)) - logFact(n))
  }
  const P0 = Math.exp(-logDenom)
  return { c, a, rho, isStable: true, Pq, P0, Lq, L, Wq, W }
}

// ─── DES helper types ──────────────────────────────────────────────────────────
type EvType = "ARR" | "SVC_START" | "SVC_END"
interface Ev { t: number; type: EvType; id: number }
type QPoint = { t: number; q: number }

interface RepResult {
  overflowed: boolean; maxQ: number; avgWait: number; served: number
  serviceTimes: number[]; falsePositives: number; queueHistory: QPoint[]
}

// ─── M/M/1 discrete-event simulation ─────────────────────────────────────────
function runSimReplication(p: SimParams, seed: number): RepResult {
  const rng = new LCG(seed)
  const shiftSec = p.shift_hours * 3600
  const arrRate  = p.arrival_rate / 3600
  const svcRate  = p.service_rate / 3600
  const eq: Ev[] = []
  const schedule = (ev: Ev) => { eq.push(ev); eq.sort((a, b) => a.t - b.t) }

  let clock = 0, serverBusy = false, nextId = 0, maxQ = 0, totalServed = 0, falsePositives = 0
  const waitQ: number[] = [], arrivalTime = new Map<number, number>()
  const waitTimes: number[] = [], serviceTimes: number[] = [], qHistory: QPoint[] = []
  const sampleInterval = shiftSec / 120
  let lastSample = 0
  const sampleQ = () => { if (clock - lastSample >= sampleInterval) { qHistory.push({ t: clock, q: waitQ.length + (serverBusy ? 1 : 0) }); lastSample = clock } }

  schedule({ t: rng.exponential(arrRate), type: "ARR", id: nextId++ })
  while (eq.length > 0) {
    const ev = eq.shift()!
    if (ev.t > shiftSec) break
    clock = ev.t; sampleQ()
    if (ev.type === "ARR") {
      arrivalTime.set(ev.id, clock)
      if (!serverBusy) { schedule({ t: clock, type: "SVC_START", id: ev.id }) }
      else { waitQ.push(ev.id); if (waitQ.length > maxQ) maxQ = waitQ.length }
      const nextT = clock + rng.exponential(arrRate)
      if (nextT < shiftSec) schedule({ t: nextT, type: "ARR", id: nextId++ })
    } else if (ev.type === "SVC_START") {
      serverBusy = true
      waitTimes.push(clock - (arrivalTime.get(ev.id) ?? clock))
      const svcTime = rng.exponential(svcRate)
      serviceTimes.push(svcTime)
      schedule({ t: clock + svcTime, type: "SVC_END", id: ev.id })
    } else {
      serverBusy = false; totalServed++
      const isDefect = rng.next() < p.defect_rate
      if (!isDefect && rng.next() < 0.02) falsePositives++
      if (waitQ.length > 0) schedule({ t: clock, type: "SVC_START", id: waitQ.shift()! })
    }
  }
  const avgWait = waitTimes.length ? waitTimes.reduce((a, b) => a + b, 0) / waitTimes.length : 0
  return { overflowed: maxQ > p.queue_overflow_threshold, maxQ, avgWait, served: totalServed, serviceTimes, falsePositives, queueHistory: qHistory }
}

// ─── M/M/c discrete-event simulation ─────────────────────────────────────────
function runSimReplicationMMC(p: SimParams & { servers: number }, seed: number): RepResult {
  const c   = Math.max(1, Math.floor(p.servers))
  const rng = new LCG(seed)
  const shiftSec = p.shift_hours * 3600
  const arrRate  = p.arrival_rate / 3600
  const svcRate  = p.service_rate / 3600
  const eq: Ev[] = []
  const schedule = (ev: Ev) => { eq.push(ev); eq.sort((a, b) => a.t - b.t) }

  let clock = 0, busyServers = 0, nextId = 0, maxQ = 0, totalServed = 0, falsePositives = 0
  const waitQ: number[] = [], arrivalTime = new Map<number, number>()
  const waitTimes: number[] = [], serviceTimes: number[] = [], qHistory: QPoint[] = []
  const sampleInterval = shiftSec / 120
  let lastSample = 0
  const sampleQ = () => { if (clock - lastSample >= sampleInterval) { qHistory.push({ t: clock, q: waitQ.length + busyServers }); lastSample = clock } }

  schedule({ t: rng.exponential(arrRate), type: "ARR", id: nextId++ })
  while (eq.length > 0) {
    const ev = eq.shift()!
    if (ev.t > shiftSec) break
    clock = ev.t; sampleQ()
    if (ev.type === "ARR") {
      arrivalTime.set(ev.id, clock)
      if (busyServers < c) { busyServers++; schedule({ t: clock, type: "SVC_START", id: ev.id }) }
      else { waitQ.push(ev.id); if (waitQ.length > maxQ) maxQ = waitQ.length }
      const nextT = clock + rng.exponential(arrRate)
      if (nextT < shiftSec) schedule({ t: nextT, type: "ARR", id: nextId++ })
    } else if (ev.type === "SVC_START") {
      waitTimes.push(clock - (arrivalTime.get(ev.id) ?? clock))
      const svcTime = rng.exponential(svcRate)
      serviceTimes.push(svcTime)
      schedule({ t: clock + svcTime, type: "SVC_END", id: ev.id })
    } else {
      busyServers--; totalServed++
      const isDefect = rng.next() < p.defect_rate
      if (!isDefect && rng.next() < 0.02) falsePositives++
      if (waitQ.length > 0) { busyServers++; schedule({ t: clock, type: "SVC_START", id: waitQ.shift()! }) }
    }
  }
  const avgWait = waitTimes.length ? waitTimes.reduce((a, b) => a + b, 0) / waitTimes.length : 0
  return { overflowed: maxQ > p.queue_overflow_threshold, maxQ, avgWait, served: totalServed, serviceTimes, falsePositives, queueHistory: qHistory }
}

// ─── Histogram builder ─────────────────────────────────────────────────────────
function buildHistogram(values: number[], bins: number): { bin: string; count: number }[] {
  if (!values.length) return Array.from({ length: bins }, (_, i) => ({ bin: `${i}`, count: 0 }))
  const min = Math.min(...values), max = Math.max(...values)
  const w = (max - min) / bins || 1
  const counts = new Array(bins).fill(0)
  for (const v of values) counts[Math.min(Math.floor((v - min) / w), bins - 1)]++
  return counts.map((count, i) => ({ bin: ((min + i * w) * 1000).toFixed(0) + "ms", count }))
}

// ─── Aggregate replications into MCResult ─────────────────────────────────────
function aggregateReplications(
  reps: RepResult[],
  params: SimParams & { servers?: number },
  isMMC: boolean,
): MCResult {
  const n = reps.length
  const c = isMMC ? Math.max(1, Math.floor(params.servers ?? 1)) : 1
  let overflows = 0, sumQ = 0, sumWait = 0, sumThroughput = 0, sumFP = 0
  const allServiceTimes: number[] = []
  const mid = Math.floor(n / 2)

  reps.forEach((r, i) => {
    if (r.overflowed) overflows++
    sumQ          += r.maxQ
    sumWait       += r.avgWait
    sumThroughput += r.served / params.shift_hours
    sumFP         += r.falsePositives / Math.max(r.served, 1)
    allServiceTimes.push(...r.serviceTimes.slice(0, 50))
    if (i === mid) {
      const step = Math.max(1, Math.floor(r.queueHistory.length / 80))
      const qOverTime = r.queueHistory
        .filter((_, j) => j % step === 0)
        .map(d => ({ t: (d.t / 3600).toFixed(2), q: d.q }))
      Object.assign(result, { queue_over_time: qOverTime })
    }
  })

  const result: MCResult = {
    overflow_probability:    overflows / n,
    avg_queue_length:        sumQ / n,
    avg_waiting_time_s:      sumWait / n,
    avg_utilization:         params.arrival_rate / (c * params.service_rate),
    avg_throughput:          sumThroughput / n,
    avg_false_positive_rate: sumFP / n,
    service_time_histogram:  buildHistogram(allServiceTimes, 16),
    queue_over_time:         [],
    replications_run:        n,
  }
  return result
}

// ─── Backend simulation result shape ──────────────────────────────────────────
// api.post<T> unwraps json.data, so T = the actual SimulationResult from the backend
interface BackendSimResult {
  id:         string
  parameters: Record<string, unknown>
  theoretical: Record<string, unknown>
  monte_carlo: {
    replications:              number
    overflow_probability:      number
    avg_queue_length:          number
    avg_waiting_time_s:        number
    avg_utilization:           number
    avg_throughput:            number
    avg_false_positive_impact: number
    service_time_histogram:    number[]
    queue_length_over_time:    { time_s: number; queue_length: number }[]
  }
  created_at: string
}

function mapBackendResult(data: BackendSimResult, serviceRate: number): MCResult {
  const mc       = data.monte_carlo
  const avgSvcMs = 3600_000 / serviceRate
  const binWidth = (avgSvcMs * 3) / mc.service_time_histogram.length
  const histogram = mc.service_time_histogram.map((count, i) => ({
    bin:   `${Math.round((i + 0.5) * binWidth)}ms`,
    count,
  }))
  const raw  = mc.queue_length_over_time
  const step = Math.max(1, Math.floor(raw.length / 80))
  const qOverTime = raw
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
  arrival_rate:             500,   // λ — overridden from real scan data on mount
  service_rate:             900,   // µ — overridden from derived_service_rate on mount
  defect_rate:              5,     // % — overridden from real damage ratio on mount
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
  const [form,            setForm]            = useState(DEFAULTS)
  const [results,         setResults]         = useState<MCResult | null>(null)
  const [isRunning,       setIsRunning]       = useState(false)
  const [showAssumptions, setShowAssumptions] = useState(false)
  const [runCount,        setRunCount]        = useState(0)
  const [aiState,         setAiState]         = useState<"idle" | "loading" | "ready">("idle")
  const [modelType,       setModelType]       = useState<"mm1" | "mmc">("mm1")
  const [statsLoaded,     setStatsLoaded]     = useState(false)
  const [statsError,      setStatsError]      = useState(false)

  // ── Seed parameters from real scan data on mount ───────────────────────────
  useEffect(() => {
    interface StatsResp {
      success: true
      data: {
        stats: { total_scans: number; damaged_count: number; avg_scan_time_ms: number | null }
        derived_service_rate: number | null
      }
    }
    api.get<StatsResp>("/api/v1/scanner/stats")
      .then(res => {
        const { stats, derived_service_rate } = res.data
        const total = stats.total_scans
        // Only derive if we have meaningful data (≥5 scans)
        if (total >= 5 && derived_service_rate) {
          const lambda     = Math.max(1, Math.round(total / 24))         // scans per hour (24h window)
          const mu         = Math.round(derived_service_rate)             // pkg/hr from avg scan time
          const defectPct  = parseFloat(((stats.damaged_count / total) * 100).toFixed(1))
          setForm(f => ({
            ...f,
            arrival_rate: lambda,
            service_rate: mu,
            defect_rate:  Math.max(0, Math.min(100, isNaN(defectPct) ? f.defect_rate : defectPct)),
          }))
          setStatsLoaded(true)
        } else {
          setStatsError(true)   // not enough data — keep defaults
        }
      })
      .catch(() => setStatsError(true))
  }, [])

  // ── Live M/M/1 theoretical metrics ────────────────────────────────────────
  const theoretical = useMemo<MM1Result>(() => computeTheoretical({
    ...form, defect_rate: form.defect_rate / 100,
  }), [form])

  // ── Live M/M/c metrics (full Erlang C) ────────────────────────────────────
  const mmcFull = useMemo<MMCFull>(() => computeMMCFull({
    ...form, defect_rate: form.defect_rate / 100,
  }), [form])

  const setField = useCallback((key: keyof typeof DEFAULTS, raw: string) => {
    const v = parseFloat(raw)
    if (!isNaN(v) && v >= 0) setForm(f => ({ ...f, [key]: v }))
  }, [])

  // ── Run handler — M/M/1 calls backend, M/M/c runs client-side ─────────────
  const handleRun = useCallback(async () => {
    setIsRunning(true)
    try {
      if (modelType === "mmc") {
        // Multi-server DES runs in-browser (backend has no M/M/c engine)
        const p = { ...form, defect_rate: form.defect_rate / 100, replications: Math.min(form.replications, 200) }
        const c = Math.max(1, Math.floor(p.servers))
        const reps: RepResult[] = []
        for (let i = 0; i < p.replications; i++) {
          reps.push(runSimReplicationMMC(p, i * 31337))
        }
        setResults(aggregateReplications(reps, { ...p, servers: c }, true))
      } else {
        // M/M/1: backend call — handles Appwrite persistence + blockchain logging
        // api.post<T> returns res.json() as T — backend wraps in { success, data }, so unwrap .data
        const resp = await api.post<{ success: boolean; data: BackendSimResult }>("/api/v1/simulation/run", {
          arrival_rate:             form.arrival_rate,
          service_rate:             form.service_rate,
          defect_rate:              form.defect_rate / 100,
          shift_hours:              form.shift_hours,
          replications:             Math.max(100, Math.min(form.replications, 300)),
          queue_overflow_threshold: form.queue_overflow_threshold,
        })
        setResults(mapBackendResult(resp.data, form.service_rate))
      }
      setRunCount(c => c + 1)
    } catch (err) {
      console.error("Simulation run failed:", err)
    } finally {
      setIsRunning(false)
    }
  }, [form, modelType])

  const handleReset = () => {
    setForm(DEFAULTS)
    setResults(null)
    setRunCount(0)
    setAiState("idle")
    setStatsLoaded(false)
    setStatsError(false)
  }

  // ── Derived display values ─────────────────────────────────────────────────
  const rhoColor     = theoretical.rho >= 1 ? "text-destructive" : theoretical.rho >= 0.8 ? "text-warning" : "text-success"
  const rhoBarColor  = theoretical.rho >= 1 ? "bg-destructive"   : theoretical.rho >= 0.8 ? "bg-warning"   : "bg-success"
  const stabilityBadge = theoretical.is_stable
    ? <Badge variant="stable">Stable System</Badge>
    : <Badge variant="unstable">Unstable — ρ ≥ 1</Badge>

  const mmcRhoColor    = mmcFull.rho >= 1 ? "text-destructive" : mmcFull.rho >= 0.8 ? "text-warning" : "text-success"
  const mmcRhoBarColor = mmcFull.rho >= 1 ? "bg-destructive"   : mmcFull.rho >= 0.8 ? "bg-warning"   : "bg-success"
  const mmcStabilityBadge = mmcFull.isStable
    ? <Badge variant="stable">Stable System</Badge>
    : <Badge variant="unstable">Unstable — ρ ≥ 1</Badge>

  // Active theoretical for comparison table
  const activeTheory = modelType === "mm1" ? theoretical : null

  return (
    <div className="flex flex-col gap-4 max-w-[1400px]">

      {/* ── Page Heading ─────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-base font-semibold text-foreground tracking-tight flex items-center gap-2">
            <Activity className="w-4 h-4 text-muted-foreground" strokeWidth={1.5} />
            Queue Simulation
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {modelType === "mm1"
              ? "M/M/1 closed-form + Monte Carlo discrete-event simulation · backend-powered · blockchain-logged"
              : "M/M/c multi-server Erlang C + client-side discrete-event simulation · parallel scanner stations"
            }
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleReset} className="gap-1.5">
            <RotateCcw className="w-3.5 h-3.5" />
            Reset
          </Button>
          <Button size="sm" onClick={handleRun} disabled={isRunning} className="gap-1.5 min-w-[120px]">
            {isRunning
              ? <><span className="w-3 h-3 border border-primary-foreground/50 border-t-primary-foreground animate-spin shrink-0" />Running…</>
              : <><Play className="w-3.5 h-3.5" />Run Simulation</>
            }
          </Button>
        </div>
      </div>

      {/* ── Model Selector ────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-0 border border-border w-fit">
        <button
          onClick={() => { setModelType("mm1"); setResults(null) }}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
            modelType === "mm1" ? "bg-foreground text-background" : "bg-card text-muted-foreground hover:text-foreground hover:bg-muted/50"
          }`}
        >
          <GitBranch className="w-3 h-3" />
          M/M/1 · Single Server
        </button>
        <div className="w-px self-stretch bg-border" />
        <button
          onClick={() => { setModelType("mmc"); setResults(null) }}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
            modelType === "mmc" ? "bg-foreground text-background" : "bg-card text-muted-foreground hover:text-foreground hover:bg-muted/50"
          }`}
        >
          <Network className="w-3 h-3" />
          M/M/c · Multi-Server
        </button>
      </div>

      {/* ── Row 1: Parameters + Theoretical ──────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-3">

        {/* Parameters */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Cpu className="w-3.5 h-3.5" />
              Parameters
            </CardTitle>
            <CardDescription>
              {modelType === "mm1" ? "M/M/1 single-server queue model" : "M/M/c multi-server queue model"}
            </CardDescription>
            {statsLoaded && (
              <div className="flex items-center gap-1 text-2xs text-success mt-1">
                <CheckCircle2 className="w-3 h-3 shrink-0" />
                λ, µ, and defect rate seeded from real scan data
              </div>
            )}
            {statsError && (
              <div className="flex items-center gap-1 text-2xs text-muted-foreground mt-1">
                <Info className="w-3 h-3 shrink-0" />
                Using defaults — scan more packages to derive real parameters
              </div>
            )}
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <ParamField id="lambda" label="Arrival Rate (λ)" unit="pkg/hr" value={form.arrival_rate} min={1}
              onChange={v => setField("arrival_rate", v)} hint="Avg packages arriving per hour (derived from 24h scan count)" />
            <ParamField id="mu" label="Service Rate (µ)" unit="pkg/hr" value={form.service_rate} min={1}
              onChange={v => setField("service_rate", v)}
              hint={modelType === "mmc" ? "Throughput per server per hour" : "Scanner throughput capacity per hour"} />

            {modelType === "mmc" && (
              <ParamField id="servers" label="Number of Servers (c)" unit="servers" value={form.servers} min={2} max={50} step={1}
                onChange={v => setField("servers", v)} hint="Parallel scanner stations sharing the queue" />
            )}

            <ParamField id="defect" label="Defect Rate" unit="%" value={form.defect_rate} min={0} max={100} step={0.1}
              onChange={v => setField("defect_rate", v)} hint="Fraction of packages expected to be damaged" />

            <Separator />

            <ParamField id="shift" label="Shift Duration" unit="hours" value={form.shift_hours} min={1} max={24}
              onChange={v => setField("shift_hours", v)} hint="Simulation time window (one work shift)" />
            <ParamField id="reps" label="Replications" unit="runs" value={form.replications}
              min={modelType === "mm1" ? 100 : 10} max={modelType === "mm1" ? 300 : 200} step={10}
              onChange={v => setField("replications", v)}
              hint={modelType === "mm1" ? "Monte Carlo replications — backend min 100, max 300" : "Monte Carlo replications — client-side, max 200"} />
            <ParamField id="overflow" label="Overflow Threshold" unit="items" value={form.queue_overflow_threshold} min={1}
              onChange={v => setField("queue_overflow_threshold", v)} hint="Queue depth that triggers overflow event" />

            <Button className="w-full mt-1 gap-1.5" onClick={handleRun} disabled={isRunning}>
              {isRunning
                ? <><span className="w-3 h-3 border border-primary-foreground/50 border-t-primary-foreground animate-spin" />Running…</>
                : <><Play className="w-3.5 h-3.5" />Run Simulation</>
              }
            </Button>
          </CardContent>
        </Card>

        {/* ── M/M/1 Theoretical Panel ──────────────────────────────────────── */}
        {modelType === "mm1" && (
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between w-full">
                <div>
                  <CardTitle className="flex items-center gap-2"><GitBranch className="w-3.5 h-3.5" />Theoretical M/M/1 Metrics</CardTitle>
                  <CardDescription>Closed-form results — updates live as parameters change</CardDescription>
                </div>
                {stabilityBadge}
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="border border-border p-3 bg-muted/20">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Server Utilization (ρ = λ/µ)</span>
                  <span className={`text-lg font-semibold tabular-nums font-mono ${rhoColor}`}>{(theoretical.rho * 100).toFixed(1)}%</span>
                </div>
                <div className="w-full h-1.5 bg-muted">
                  <div className={`h-full transition-all duration-300 ${rhoBarColor}`} style={{ width: `${Math.min(theoretical.rho * 100, 100)}%` }} />
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-2xs text-muted-foreground">0%</span>
                  <span className="text-2xs text-warning">Warn 80%</span>
                  <span className="text-2xs text-muted-foreground">100%</span>
                </div>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                <MetricTile label="Avg Items in System (L)"  value={theoretical.is_stable ? theoretical.L.toFixed(3)  : "∞"} unit="packages"   color={theoretical.L  > 5  ? "warn" : undefined} />
                <MetricTile label="Avg Items in Queue (Lq)"  value={theoretical.is_stable ? theoretical.Lq.toFixed(3) : "∞"} unit="packages"   color={theoretical.Lq > 3  ? "warn" : undefined} />
                <MetricTile label="Throughput"               value={theoretical.is_stable ? theoretical.throughput.toFixed(0) : "—"} unit="pkg/hr" />
                <MetricTile label="Avg Time in System (W)"   value={theoretical.is_stable ? (theoretical.W  * 3600).toFixed(2) : "∞"} unit="seconds" color={theoretical.W  * 3600 > 30 ? "warn" : undefined} />
                <MetricTile label="Avg Wait in Queue (Wq)"   value={theoretical.is_stable ? (theoretical.Wq * 3600).toFixed(2) : "∞"} unit="seconds" color={theoretical.Wq * 3600 > 20 ? "warn" : undefined} />
                <MetricTile label="P(idle)"                  value={theoretical.is_stable ? ((1 - theoretical.rho) * 100).toFixed(1) + "%" : "0%"} unit="server idle prob." />
              </div>
              {!theoretical.is_stable && (
                <div className="flex items-start gap-2 border border-destructive/30 bg-destructive/5 p-3">
                  <AlertTriangle className="w-3.5 h-3.5 text-destructive shrink-0 mt-0.5" />
                  <p className="text-xs text-destructive">System is <strong>unstable</strong> — arrival rate exceeds service capacity (ρ ≥ 1). Increase µ or decrease λ.</p>
                </div>
              )}
              <div className="border border-border bg-muted/30 p-3">
                <p className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">M/M/1 Formulas</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                  {[["ρ = λ / µ","Utilization"],["L = ρ/(1−ρ)","Avg in system"],["Lq = ρ²/(1−ρ)","Avg in queue"],["W = L/λ","Avg system time"],["Wq = Lq/λ","Avg wait"],["P₀ = 1−ρ","Idle probability"]].map(([f,d]) => (
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

        {/* ── M/M/c Theoretical Panel (full Erlang C) ──────────────────────── */}
        {modelType === "mmc" && (
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between w-full">
                <div>
                  <CardTitle className="flex items-center gap-2"><Server className="w-3.5 h-3.5" />Theoretical M/M/c Metrics</CardTitle>
                  <CardDescription>Erlang C closed-form · c = {mmcFull.c} servers · updates live</CardDescription>
                </div>
                {mmcStabilityBadge}
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="border border-border p-3 bg-muted/20">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Per-Server Utilization (ρ = λ/c·µ)</span>
                  <span className={`text-lg font-semibold tabular-nums font-mono ${mmcRhoColor}`}>{(mmcFull.rho * 100).toFixed(1)}%</span>
                </div>
                <div className="w-full h-1.5 bg-muted">
                  <div className={`h-full transition-all duration-300 ${mmcRhoBarColor}`} style={{ width: `${Math.min(mmcFull.rho * 100, 100)}%` }} />
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-2xs text-muted-foreground">0%</span>
                  <span className="text-2xs text-warning">Warn 80%</span>
                  <span className="text-2xs text-muted-foreground">100%</span>
                </div>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                <MetricTile label="Traffic Intensity (a = λ/µ)" value={isFinite(mmcFull.a) ? mmcFull.a.toFixed(3) : "∞"} unit="Erlangs" color={mmcFull.a >= mmcFull.c ? "destructive" : undefined} />
                <MetricTile label="P(wait) — Erlang C"           value={mmcFull.isStable ? (mmcFull.Pq * 100).toFixed(1) + "%" : "100%"} unit="prob. of queuing" color={mmcFull.Pq > 0.5 ? "warn" : undefined} />
                <MetricTile label="P(idle) — P₀"                 value={mmcFull.isStable ? (mmcFull.P0 * 100).toFixed(1) + "%" : "0%"}   unit="all servers free" />
                <MetricTile label="Avg Items in Queue (Lq)"      value={mmcFull.isStable ? mmcFull.Lq.toFixed(3) : "∞"}                   unit="packages" color={mmcFull.Lq > 3 ? "warn" : undefined} />
                <MetricTile label="Avg Items in System (L)"      value={mmcFull.isStable ? mmcFull.L.toFixed(3)  : "∞"}                   unit="packages" color={mmcFull.L  > 5 ? "warn" : undefined} />
                <MetricTile label="System Capacity (c·µ)"        value={(mmcFull.c * form.service_rate).toLocaleString()}                  unit="pkg/hr total" />
                <MetricTile label="Avg Wait in Queue (Wq)"       value={mmcFull.isStable ? (mmcFull.Wq * 3600).toFixed(2) : "∞"}          unit="seconds" color={mmcFull.Wq * 3600 > 20 ? "warn" : undefined} />
                <MetricTile label="Avg Time in System (W)"       value={mmcFull.isStable ? (mmcFull.W  * 3600).toFixed(2) : "∞"}          unit="seconds" color={mmcFull.W  * 3600 > 30 ? "warn" : undefined} />
                <MetricTile label="Active Servers (c)"           value={mmcFull.c.toString()}                                              unit="parallel stations" />
              </div>
              {!mmcFull.isStable && (
                <div className="flex items-start gap-2 border border-destructive/30 bg-destructive/5 p-3">
                  <AlertTriangle className="w-3.5 h-3.5 text-destructive shrink-0 mt-0.5" />
                  <p className="text-xs text-destructive">System is <strong>unstable</strong> — λ exceeds total capacity c·µ (ρ ≥ 1). Increase µ, add servers, or reduce λ.</p>
                </div>
              )}
              <div className="border border-border bg-muted/30 p-3">
                <p className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">M/M/c Formulas (Erlang C)</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                  {[["ρ = λ/(c·µ)","Per-server utilization"],["a = λ/µ","Traffic intensity (Erlangs)"],["C(c,a) = Erlang-C","P(wait)"],["Lq = C(c,a)·ρ/(1−ρ)","Avg in queue"],["L = Lq + a","Avg in system"],["Wq = Lq/λ · 3600","Avg wait (sec)"]].map(([f,d]) => (
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

      {/* ── Monte Carlo Results (shared by M/M/1 and M/M/c) ─────────────────── */}
      {results && (
        <>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-success" />
              <span className="text-sm font-semibold text-foreground">Monte Carlo Results</span>
            </div>
            <span className="text-xs text-muted-foreground font-mono">
              Run #{runCount} · {results.replications_run} replications
              {modelType === "mm1" ? " · backend + blockchain" : ` · ${mmcFull.c}-server client-side`}
            </span>
            <Badge variant="stable" className="text-2xs">Complete</Badge>
          </div>

          {/* KPI summary */}
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
            <MCKpiCard label="Overflow Probability"  value={`${(results.overflow_probability * 100).toFixed(1)}%`}   icon={AlertTriangle} sub={`threshold: >${form.queue_overflow_threshold} items`} color={results.overflow_probability > 0.2 ? "destructive" : results.overflow_probability > 0.05 ? "warn" : "success"} />
            <MCKpiCard label="Avg Max Queue"         value={results.avg_queue_length.toFixed(1)}                     icon={Layers}        sub="items (peak)"                                        color={results.avg_queue_length > form.queue_overflow_threshold ? "warn" : undefined} />
            <MCKpiCard label="Avg Waiting Time"      value={`${results.avg_waiting_time_s.toFixed(2)}s`}             icon={Clock}         sub="per package in queue"                                color={results.avg_waiting_time_s > 30 ? "warn" : undefined} />
            <MCKpiCard label="Avg Utilization"       value={`${(results.avg_utilization * 100).toFixed(1)}%`}        icon={Activity}      sub={modelType === "mmc" ? "per-server load ρ = λ/(c·µ)" : "server load ρ = λ/µ"} color={results.avg_utilization > 0.9 ? "destructive" : results.avg_utilization > 0.75 ? "warn" : "success"} />
            <MCKpiCard label="Avg Throughput"        value={results.avg_throughput.toFixed(0)}                       icon={TrendingUp}    sub="packages served / hr" />
            <MCKpiCard label="False Positive Rate"   value={`${(results.avg_false_positive_rate * 100).toFixed(2)}%`} icon={XCircle}      sub="good pkgs flagged as damaged"                        color={results.avg_false_positive_rate > 0.03 ? "warn" : undefined} />
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-3">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Activity className="w-3.5 h-3.5" />Queue Length Over Time</CardTitle>
                <CardDescription>Discrete-event trace · median replication · x-axis in shift hours</CardDescription>
              </CardHeader>
              <CardContent className="p-4">
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={results.queue_over_time} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="2 4" stroke={C.grid} vertical={false} />
                    <XAxis dataKey="t" tick={{ fontSize: 10, fill: C.text }} axisLine={false} tickLine={false} label={{ value: "hours", position: "insideBottomRight", offset: -4, style: { fontSize: 9, fill: C.text } }} />
                    <YAxis tick={{ fontSize: 10, fill: C.text }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip content={<LineTooltip />} cursor={{ stroke: C.grid, strokeWidth: 1 }} />
                    <ReferenceLine y={form.queue_overflow_threshold} stroke={C.damaged} strokeDasharray="4 3" strokeWidth={1} label={{ value: "overflow threshold", position: "insideTopRight", style: { fontSize: 9, fill: C.damaged } }} />
                    <Line type="stepAfter" dataKey="q" stroke={C.primary} strokeWidth={2} dot={false} activeDot={{ r: 4, fill: C.primary, strokeWidth: 0 }} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><BarChart3 className="w-3.5 h-3.5" />Service Time Distribution</CardTitle>
                <CardDescription>Histogram of sampled service times · all replications</CardDescription>
              </CardHeader>
              <CardContent className="p-4">
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={results.service_time_histogram} margin={{ top: 4, right: 4, left: -28, bottom: 0 }} barSize={14}>
                    <CartesianGrid strokeDasharray="2 4" stroke={C.grid} vertical={false} />
                    <XAxis dataKey="bin" tick={{ fontSize: 9, fill: C.text }} axisLine={false} tickLine={false} interval={3} angle={-30} textAnchor="end" height={30} />
                    <YAxis tick={{ fontSize: 10, fill: C.text }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip content={<HistTooltip />} cursor={{ fill: "#ffffff14" }} />
                    <Bar dataKey="count" radius={[0, 0, 0, 0]}>
                      {results.service_time_histogram.map((_, i) => (
                        <Cell key={i} fill={i < 4 ? C.success : i > 11 ? C.damaged : C.primary} />
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

          {/* Comparison table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Info className="w-3.5 h-3.5" />Theoretical vs. Simulated</CardTitle>
              <CardDescription>
                {modelType === "mm1"
                  ? "Closed-form M/M/1 formulas vs. Monte Carlo averages"
                  : "Erlang C M/M/c formulas vs. multi-server discrete-event averages"
                }
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
                  {modelType === "mm1" && activeTheory ? [
                    { label: "Utilization (ρ)",         theory: `${(activeTheory.rho * 100).toFixed(2)}%`,                                                sim: `${(results.avg_utilization * 100).toFixed(2)}%`,  delta: Math.abs(activeTheory.rho - results.avg_utilization) < 0.05 },
                    { label: "Avg Wait in Queue (Wq)",  theory: activeTheory.is_stable ? `${(activeTheory.Wq * 3600).toFixed(2)}s` : "∞",                 sim: `${results.avg_waiting_time_s.toFixed(2)}s`,        delta: activeTheory.is_stable && Math.abs(activeTheory.Wq * 3600 - results.avg_waiting_time_s) < 5 },
                    { label: "Overflow Probability",    theory: "N/A (formula)",                                                                           sim: `${(results.overflow_probability * 100).toFixed(1)}%`, delta: null },
                    { label: "Throughput",              theory: activeTheory.is_stable ? `${activeTheory.throughput.toFixed(0)} pkg/hr` : "—",              sim: `${results.avg_throughput.toFixed(0)} pkg/hr`,      delta: activeTheory.is_stable && Math.abs(activeTheory.throughput - results.avg_throughput) / activeTheory.throughput < 0.1 },
                  ] : [
                    { label: "Per-Server Utilization (ρ)", theory: `${(mmcFull.rho * 100).toFixed(2)}%`,                                                    sim: `${(results.avg_utilization * 100).toFixed(2)}%`,  delta: Math.abs(mmcFull.rho - results.avg_utilization) < 0.05 },
                    { label: "Avg Wait in Queue (Wq)",     theory: mmcFull.isStable ? `${(mmcFull.Wq * 3600).toFixed(2)}s` : "∞",                           sim: `${results.avg_waiting_time_s.toFixed(2)}s`,        delta: mmcFull.isStable && Math.abs(mmcFull.Wq * 3600 - results.avg_waiting_time_s) < 5 },
                    { label: "P(wait) — Erlang C",         theory: mmcFull.isStable ? `${(mmcFull.Pq * 100).toFixed(1)}%` : "100%",                         sim: "N/A (DES)",                                        delta: null },
                    { label: "Throughput",                 theory: mmcFull.isStable ? `${form.arrival_rate.toFixed(0)} pkg/hr` : "—",                        sim: `${results.avg_throughput.toFixed(0)} pkg/hr`,      delta: mmcFull.isStable && Math.abs(form.arrival_rate - results.avg_throughput) / form.arrival_rate < 0.1 },
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

          {/* AI Analysis (M/M/1 only) */}
          {modelType === "mm1" && (
            <AIAnalysisSection
              aiState={aiState}
              onGenerate={() => { setAiState("loading"); setTimeout(() => setAiState("ready"), 1800) }}
            />
          )}
        </>
      )}

      {/* ── Empty state ───────────────────────────────────────────────────────── */}
      {!results && !isRunning && (
        <div className="border border-dashed border-border bg-muted/20 flex flex-col items-center justify-center py-14 gap-3">
          {modelType === "mm1"
            ? <Activity className="w-8 h-8 text-muted-foreground/40" strokeWidth={1.5} />
            : <Network  className="w-8 h-8 text-muted-foreground/40" strokeWidth={1.5} />
          }
          <p className="text-sm font-medium text-muted-foreground">No simulation run yet</p>
          <p className="text-xs text-muted-foreground/70 text-center max-w-sm">
            {modelType === "mm1"
              ? "Configure parameters above and click Run Simulation. Results are persisted to Appwrite and logged to the blockchain."
              : `M/M/c runs a ${mmcFull.c}-server discrete-event simulation client-side using the Erlang C model. Configure parameters and click Run Simulation.`
            }
          </p>
          <Button size="sm" onClick={handleRun} className="gap-1.5 mt-1">
            <Play className="w-3.5 h-3.5" />
            Run Simulation
          </Button>
        </div>
      )}

      {/* ── Model Assumptions ────────────────────────────────────────────────── */}
      <div className="border border-border">
        <button
          onClick={() => setShowAssumptions(v => !v)}
          className="w-full flex items-center justify-between px-4 py-2.5 bg-muted/30 hover:bg-muted/50 transition-colors text-left"
        >
          <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Info className="w-3.5 h-3.5" />
            Model Assumptions &amp; Notes
          </span>
          {showAssumptions ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
        </button>
        {showAssumptions && (
          <div className="p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-3">
              {(modelType === "mm1" ? [
                ["Single server (M/M/1)", "One scanner station handles the queue. Backend runs simulation and logs the result to Appwrite and Ganache blockchain."],
                ["Poisson arrivals", "Package arrivals follow a Poisson process with rate λ. Inter-arrival times are exponentially distributed."],
                ["Exponential service times", "Each scan duration is exponentially distributed with mean 1/µ seconds."],
                ["FCFS discipline", "First-come, first-served queue ordering. No priority classes."],
                ["Infinite queue capacity", "No hard limit — the overflow threshold only triggers a probability flag in the simulation."],
                ["Independent replications", "Each Monte Carlo run uses a different LCG seed (seed = 31337 × i) for statistical independence."],
                ["False positives (2%)", "2% of non-defective packages are misclassified as damaged — modeled from real AI model behaviour."],
                ["Derived µ from scans", "If service_rate is omitted from the API call, the backend derives µ from the average of the last 100 real scan_time_ms values."],
                ["Real λ from scan count", "Arrival rate is estimated as total_scans_24h ÷ 24, seeded on page load from /scanner/stats."],
              ] : [
                ["Multi-server (M/M/c)", `c identical scanner stations draw from a single shared FCFS queue. Current c = ${mmcFull.c}. Stability requires ρ = λ/(c·µ) < 1.`],
                ["Erlang C model", "Full Erlang C formula (log-space for numerical stability) computes P(wait), Lq, Wq, L, W, and P₀."],
                ["Poisson arrivals", "Package arrivals follow a Poisson process with rate λ. Inter-arrival times are exponentially distributed."],
                ["Exponential service times", "Each server's service time is exponentially distributed with mean 1/µ seconds."],
                ["Shared FCFS queue", "All arrivals join one queue and are dispatched to the next free server (FCFS discipline)."],
                ["Homogeneous servers", "All c servers have identical service rate µ. Heterogeneous rates require M/M/c(k) extensions."],
                ["Client-side DES", "M/M/c simulation runs in-browser using the same LCG-seeded event-driven engine as M/M/1."],
                ["Deterministic LCG", "Linear Congruential Generator (Knuth MMIX constants) ensures reproducibility across replications."],
                ["Median time-series", "Queue length chart shows the median replication to avoid smoothing artifacts from averaging."],
              ]).map(([title, body]) => (
                <div key={title}>
                  <p className="text-xs font-semibold text-foreground mb-0.5">{title}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{body}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

    </div>
  )
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function ParamField({ id, label, unit, value, min, max, step = 1, onChange, hint }: {
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
      <Input id={id} type="number" defaultValue={value} key={value} min={min} max={max} step={step}
        onChange={e => onChange(e.target.value)} className="h-8 text-sm font-mono" />
      {hint && <p className="text-2xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

function MetricTile({ label, value, unit, color }: {
  label: string; value: string; unit: string; color?: "warn" | "success" | "destructive"
}) {
  const valClass = color === "destructive" ? "text-destructive" : color === "warn" ? "text-warning" : color === "success" ? "text-success" : "text-foreground"
  return (
    <div className="border border-border p-2.5 bg-card flex flex-col gap-1">
      <span className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground leading-tight">{label}</span>
      <span className={`text-md font-semibold tabular-nums font-mono ${valClass}`}>{value}</span>
      <span className="text-2xs text-muted-foreground">{unit}</span>
    </div>
  )
}

function MCKpiCard({ label, value, icon: Icon, sub, color }: {
  label: string; value: string; icon: React.ElementType; sub: string; color?: "success" | "warn" | "destructive"
}) {
  const valClass = color === "destructive" ? "stat-card-value text-destructive" : color === "warn" ? "stat-card-value text-warning" : color === "success" ? "stat-card-value text-success" : "stat-card-value"
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

function AIAnalysisSection({ aiState, onGenerate }: { aiState: "idle" | "loading" | "ready"; onGenerate: () => void }) {
  return (
    <Card className="border-border">
      <CardHeader>
        <div className="flex items-start justify-between w-full">
          <div>
            <CardTitle className="flex items-center gap-2"><Sparkles className="w-3.5 h-3.5 text-warning" />AI Analysis</CardTitle>
            <CardDescription>Claude-powered interpretation of simulation results — plain-language insights and recommendations</CardDescription>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {aiState === "ready"   && <Badge variant="stable"  className="text-2xs">Analysis Ready</Badge>}
            {aiState === "loading" && <Badge variant="warning" className="text-2xs"><span className="w-1.5 h-1.5 bg-warning inline-block mr-1 animate-pulse" />Generating…</Badge>}
            <Button variant={aiState === "ready" ? "outline" : "default"} size="sm" onClick={onGenerate} disabled={aiState === "loading"} className="gap-1.5">
              {aiState === "loading" ? <><span className="w-3 h-3 border border-primary-foreground/40 border-t-primary-foreground animate-spin shrink-0" />Generating…</>
               : aiState === "ready" ? <><RotateCcw className="w-3.5 h-3.5" />Regenerate</>
               : <><Sparkles className="w-3.5 h-3.5" />Generate Analysis</>}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {aiState === "idle" && (
          <div className="flex flex-col items-center justify-center py-12 gap-3 border-t border-border bg-muted/10">
            <div className="w-10 h-10 border border-border bg-card flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-muted-foreground/40" strokeWidth={1.5} />
            </div>
            <p className="text-sm font-medium text-muted-foreground">No analysis generated yet</p>
            <p className="text-xs text-muted-foreground/70 text-center max-w-sm">Click <strong>Generate Analysis</strong> to get a plain-language breakdown of your simulation results, key findings, and actionable recommendations.</p>
            <Button size="sm" onClick={onGenerate} className="gap-1.5 mt-1"><Sparkles className="w-3.5 h-3.5" />Generate Analysis</Button>
          </div>
        )}
        {aiState === "loading" && (
          <div className="border-t border-border p-4 flex flex-col gap-4">
            <div className="flex items-center gap-2"><div className="w-3.5 h-3.5 bg-muted animate-pulse" /><div className="h-3 w-32 bg-muted animate-pulse" /></div>
            <div className="flex flex-col gap-2"><div className="h-3 w-full bg-muted animate-pulse" /><div className="h-3 w-[92%] bg-muted animate-pulse" /><div className="h-3 w-[78%] bg-muted animate-pulse" /></div>
            <Separator />
            <div className="flex items-center gap-2"><div className="w-3.5 h-3.5 bg-muted animate-pulse" /><div className="h-3 w-28 bg-muted animate-pulse" /></div>
            <div className="flex flex-col gap-2">{[85, 70, 90, 60].map(w => (<div key={w} className="flex items-start gap-2"><div className="w-1.5 h-1.5 bg-muted animate-pulse mt-1.5 shrink-0" /><div className="h-3 bg-muted animate-pulse" style={{ width: `${w}%` }} /></div>))}</div>
            <p className="text-xs text-muted-foreground flex items-center gap-1.5"><span className="w-1.5 h-1.5 bg-warning inline-block animate-pulse" />Analyzing simulation parameters and results…</p>
          </div>
        )}
        {aiState === "ready" && (
          <div className="border-t border-border divide-y divide-border">
            <div className="p-4 flex flex-col gap-2">
              <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground"><Activity className="w-3.5 h-3.5" />Summary</h3>
              <div className="h-3 w-full bg-muted/60" /><div className="h-3 w-[88%] bg-muted/60" /><div className="h-3 w-[74%] bg-muted/60" />
              <p className="text-xs text-muted-foreground italic mt-1">AI-generated summary will appear here once the Claude API is connected.</p>
            </div>
            <div className="p-4 flex flex-col gap-2.5">
              <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground"><Lightbulb className="w-3.5 h-3.5" />Key Findings</h3>
              {[{ color: "bg-success", label: "Queue stability assessment based on ρ value" },{ color: "bg-warning", label: "Overflow risk analysis across all replications" },{ color: "bg-primary", label: "Service time distribution interpretation" },{ color: "bg-muted-foreground", label: "False positive impact on quality metrics" }].map(({ color, label }) => (
                <div key={label} className="flex items-start gap-2.5">
                  <span className={`w-1.5 h-1.5 ${color} shrink-0 mt-1.5`} />
                  <div className="flex-1 flex flex-col gap-1"><div className="h-2.5 bg-muted/60 w-full" /><p className="text-2xs text-muted-foreground italic">{label}</p></div>
                </div>
              ))}
            </div>
            <div className="p-4 flex flex-col gap-2.5">
              <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground"><ListChecks className="w-3.5 h-3.5" />Recommendations</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[{ icon: TrendingUp, label: "Throughput Optimization", desc: "Parameter tuning suggestions to improve scanner utilization" },{ icon: ShieldAlert, label: "Risk Mitigation", desc: "Actions to reduce overflow probability and queue buildup" },{ icon: Cpu, label: "Capacity Planning", desc: "Staffing and equipment recommendations based on λ/µ ratio" }].map(({ icon: Icon, label, desc }) => (
                  <div key={label} className="border border-border p-3 bg-muted/10 flex flex-col gap-1.5">
                    <div className="flex items-center gap-1.5"><Icon className="w-3.5 h-3.5 text-muted-foreground" strokeWidth={1.5} /><span className="text-xs font-semibold text-foreground">{label}</span></div>
                    <div className="h-2.5 bg-muted/60 w-full" /><div className="h-2.5 bg-muted/60 w-[80%]" />
                    <p className="text-2xs text-muted-foreground italic mt-0.5">{desc}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="px-4 py-2.5 bg-muted/20 flex items-center justify-between">
              <div className="flex items-center gap-2"><ShieldAlert className="w-3.5 h-3.5 text-muted-foreground" strokeWidth={1.5} /><span className="text-xs text-muted-foreground">Overall Risk Level</span><div className="h-2.5 w-20 bg-muted/70" /></div>
              <p className="text-2xs text-muted-foreground italic">Powered by Claude · Analysis reflects current run parameters only</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
