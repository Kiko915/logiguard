import {
  ScanLine,
  Package,
  PackageX,
  PackageOpen,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Link,
  ChevronRight,
  Cpu,
  Database,
  Boxes,
  Activity,
  BarChart3,
} from "lucide-react"
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from "recharts"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

// ─── Chart Colors (approximated from design system tokens) ────────────────────
const C = {
  good:    "#4d8f68",   // success green  ≈ oklch(0.50 0.130 150)
  damaged: "#b54343",   // destructive red ≈ oklch(0.50 0.190 25)
  empty:   "#9ca3af",   // muted gray
  primary: "#242424",   // near-black
  text:    "#737373",   // muted-foreground
  grid:    "#e5e5e5",   // border
  warn:    "#c9973a",   // warning amber
}

// ─── Mock Data ─────────────────────────────────────────────────────────────────

const STATS = [
  {
    label: "Total Scans Today",
    value: "1,247",
    delta: "+12.4%",
    up:    true,
    icon:  Boxes,
    sub:   "vs. yesterday",
  },
  {
    label: "Good Packages",
    value: "1,183",
    delta: "94.9%",
    up:    true,
    icon:  Package,
    sub:   "pass rate",
  },
  {
    label: "Damaged Flagged",
    value: "47",
    delta: "+3",
    up:    false,
    icon:  PackageX,
    sub:   "since last hour",
  },
  {
    label: "Avg Scan Time",
    value: "2.84s",
    delta: "-0.12s",
    up:    true,
    icon:  Clock,
    sub:   "µ = 1,268/hr",
  },
]

/** Hourly breakdown over a 12-hour shift (08:00–20:00). Last entry is partial. */
const HOURLY_DATA = [
  { hour: "08:00", good: 89,  damaged: 4, empty: 2 },
  { hour: "09:00", good: 112, damaged: 7, empty: 5 },
  { hour: "10:00", good: 134, damaged: 5, empty: 3 },
  { hour: "11:00", good: 127, damaged: 8, empty: 4 },
  { hour: "12:00", good: 98,  damaged: 3, empty: 2 },
  { hour: "13:00", good: 115, damaged: 5, empty: 3 },
  { hour: "14:00", good: 128, damaged: 7, empty: 3 },
  { hour: "14:30", good: 64,  damaged: 3, empty: 1 },
]

const STATUS_DIST = [
  { name: "Good",    value: 1183 },
  { name: "Damaged", value: 47   },
  { name: "Empty",   value: 17   },
]

const DONUT_COLORS = [C.good, C.damaged, C.empty]

const MM1_BAR_DATA = [
  { label: "ρ (Util.)", value: 0.71 },
  { label: "L (Items)", value: 2.45 },
  { label: "Wq (s)",    value: 0.32 },
  { label: "P(ovfl)",   value: 0.042 },
]

const SCAN_LOGS = [
  { id: "a3f2c1d4", status: "good",    confidence: 97.8, scan_ms: 2340, tx: "0x4a2b…e91f", time: "14:32:15" },
  { id: "b1c4e8f2", status: "damaged", confidence: 89.1, scan_ms: 3120, tx: "0x8f3d…c204", time: "14:31:58" },
  { id: "c9d7a3b1", status: "good",    confidence: 99.2, scan_ms: 2180, tx: "0x1e7c…a88b", time: "14:31:42" },
  { id: "d5f1b9c3", status: "empty",   confidence: 95.6, scan_ms: 1960, tx: "—",           time: "14:31:30" },
  { id: "e2a8d6f4", status: "good",    confidence: 98.4, scan_ms: 2510, tx: "0x7b5a…3d12", time: "14:31:17" },
  { id: "f7c3e1a9", status: "damaged", confidence: 82.3, scan_ms: 3840, tx: "0x2c9e…f047", time: "14:30:55" },
  { id: "g4b2f8d5", status: "good",    confidence: 96.7, scan_ms: 2290, tx: "0x6d4f…b19a", time: "14:30:41" },
  { id: "h8e5c2a6", status: "good",    confidence: 99.0, scan_ms: 2070, tx: "0x3a8c…e562", time: "14:30:28" },
] as const

// ─── Custom Tooltip Components ─────────────────────────────────────────────────

function AreaTooltip({ active, payload, label }: {
  active?: boolean
  payload?: { name: string; value: number; color: string }[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  const total = payload.reduce((s, p) => s + p.value, 0)
  return (
    <div className="bg-card border border-border px-3 py-2 text-xs shadow-md">
      <p className="font-semibold text-foreground mb-1.5">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2 leading-5">
          <span style={{ width: 6, height: 6, background: p.color, display: "inline-block", flexShrink: 0 }} />
          <span className="text-muted-foreground capitalize w-14">{p.name}</span>
          <span className="font-medium tabular-nums">{p.value}</span>
        </div>
      ))}
      <div className="flex items-center gap-2 leading-5 mt-1 pt-1 border-t border-border">
        <span style={{ width: 6, height: 6, display: "inline-block", flexShrink: 0 }} />
        <span className="text-muted-foreground w-14">Total</span>
        <span className="font-semibold tabular-nums">{total}</span>
      </div>
    </div>
  )
}

function PieTooltip({ active, payload }: {
  active?: boolean
  payload?: { name: string; value: number; payload: { name: string; value: number } }[]
}) {
  if (!active || !payload?.length) return null
  const p    = payload[0]
  const total = STATUS_DIST.reduce((s, d) => s + d.value, 0)
  const pct  = ((p.value / total) * 100).toFixed(1)
  return (
    <div className="bg-card border border-border px-3 py-2 text-xs shadow-md">
      <p className="font-semibold text-foreground">{p.name}</p>
      <p className="text-muted-foreground tabular-nums">{p.value.toLocaleString()} · {pct}%</p>
    </div>
  )
}

function BarTooltip({ active, payload, label }: {
  active?: boolean
  payload?: { value: number }[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-card border border-border px-3 py-2 text-xs shadow-md">
      <p className="font-semibold text-foreground">{label}</p>
      <p className="text-muted-foreground tabular-nums">{payload[0].value.toFixed(3)}</p>
    </div>
  )
}

// ─── Home Page ─────────────────────────────────────────────────────────────────
export function HomePage() {
  const total = STATUS_DIST.reduce((s, d) => s + d.value, 0)

  return (
    <div className="flex flex-col gap-4 max-w-[1400px]">

      {/* ── Page Heading ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-foreground">System Overview</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            12-hour shift · Started 08:00 · Shift ends 20:00
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">Export Report</Button>
          <Button size="sm">
            <ScanLine className="w-3.5 h-3.5" />
            Start Scan
          </Button>
        </div>
      </div>

      {/* ── KPI Stats Row ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {STATS.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </div>

      {/* ── Charts Row ────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-3">

        {/* Hourly Scan Throughput */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-3.5 h-3.5" />
              Scan Throughput
            </CardTitle>
            <CardDescription>Packages inspected per hour · Current shift</CardDescription>
          </CardHeader>
          <CardContent className="p-4">
            <div className="flex gap-4 items-stretch">
              {/* Chart */}
              <div className="flex-1 min-w-0">
              <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={HOURLY_DATA} margin={{ top: 4, right: 0, left: -28, bottom: 0 }}>
                <defs>
                  <linearGradient id="grad-good" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="10%" stopColor={C.good}    stopOpacity={0.35} />
                    <stop offset="95%" stopColor={C.good}    stopOpacity={0.03} />
                  </linearGradient>
                  <linearGradient id="grad-damaged" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="10%" stopColor={C.damaged} stopOpacity={0.35} />
                    <stop offset="95%" stopColor={C.damaged} stopOpacity={0.03} />
                  </linearGradient>
                  <linearGradient id="grad-empty" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="10%" stopColor={C.empty}   stopOpacity={0.30} />
                    <stop offset="95%" stopColor={C.empty}   stopOpacity={0.03} />
                  </linearGradient>
                </defs>

                <CartesianGrid strokeDasharray="2 4" stroke={C.grid} vertical={false} />
                <XAxis
                  dataKey="hour"
                  tick={{ fontSize: 10, fill: C.text }}
                  axisLine={false} tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: C.text }}
                  axisLine={false} tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip content={<AreaTooltip />} cursor={{ stroke: C.grid, strokeWidth: 1 }} />

                {/* Stacked: empty first (bottom), then damaged, then good (top) */}
                <Area
                  type="monotone" dataKey="empty"   stackId="s"
                  stroke={C.empty}   fill="url(#grad-empty)"
                  strokeWidth={1.5} dot={false}
                />
                <Area
                  type="monotone" dataKey="damaged" stackId="s"
                  stroke={C.damaged} fill="url(#grad-damaged)"
                  strokeWidth={1.5} dot={false}
                />
                <Area
                  type="monotone" dataKey="good"    stackId="s"
                  stroke={C.good}    fill="url(#grad-good)"
                  strokeWidth={1.5}
                  dot={{ r: 2, fill: C.good, strokeWidth: 0 }}
                  activeDot={{ r: 3, fill: C.good, strokeWidth: 0 }}
                />
              </AreaChart>
            </ResponsiveContainer>
              </div>

              {/* Right-side legend */}
              <div className="flex flex-col justify-center gap-3.5 shrink-0 border-l border-border pl-4 pr-1 py-2">
                <LegendItem color={C.good}    label="Good"    count="1,183" />
                <LegendItem color={C.damaged} label="Damaged" count="47"    />
                <LegendItem color={C.empty}   label="Empty"   count="17"    />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Status Distribution Donut */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-3.5 h-3.5" />
              Status Distribution
            </CardTitle>
            <CardDescription>Today's scan outcomes</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={136}>
              <PieChart>
                <Pie
                  data={STATUS_DIST}
                  cx="50%"
                  cy="50%"
                  innerRadius={42}
                  outerRadius={62}
                  paddingAngle={2}
                  dataKey="value"
                  startAngle={90}
                  endAngle={-270}
                  strokeWidth={0}
                >
                  {STATUS_DIST.map((_, i) => (
                    <Cell key={i} fill={DONUT_COLORS[i]} />
                  ))}
                </Pie>
                <Tooltip content={<PieTooltip />} />
              </PieChart>
            </ResponsiveContainer>

            {/* Legend rows */}
            <div className="flex flex-col gap-1.5 mt-2">
              {STATUS_DIST.map((d, i) => (
                <div key={d.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span style={{ width: 8, height: 8, background: DONUT_COLORS[i], display: "inline-block", flexShrink: 0 }} />
                    <span className="text-xs text-muted-foreground">{d.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium tabular-nums">{d.value.toLocaleString()}</span>
                    <span className="text-2xs text-muted-foreground tabular-nums w-10 text-right">
                      {((d.value / total) * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── M/M/1 Queue Metrics ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-3">

        {/* Queue Metrics BarChart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-3.5 h-3.5" />
              M/M/1 Queue Analysis
            </CardTitle>
            <CardDescription>Theoretical metrics — current shift parameters</CardDescription>
            <Badge variant="stable" className="text-2xs self-start">Stable</Badge>
          </CardHeader>
          <CardContent className="pr-4">
            <ResponsiveContainer width="100%" height={120}>
              <BarChart data={MM1_BAR_DATA} margin={{ top: 4, right: 0, left: -28, bottom: 0 }} barSize={28}>
                <CartesianGrid strokeDasharray="2 4" stroke={C.grid} horizontal={true} vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10, fill: C.text }}
                  axisLine={false} tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: C.text }}
                  axisLine={false} tickLine={false}
                  domain={[0, 3]}
                  allowDecimals
                />
                <Tooltip content={<BarTooltip />} cursor={{ fill: "#f5f5f5" }} />
                <Bar dataKey="value" radius={[0, 0, 0, 0]}>
                  {MM1_BAR_DATA.map((d, i) => (
                    <Cell
                      key={i}
                      fill={d.value >= 0.9 ? C.damaged : d.value >= 0.7 ? C.warn : C.primary}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Queue Key Metrics */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-3.5 h-3.5" />
              Queue Key Values
            </CardTitle>
            <CardDescription>λ = 900/hr · μ = 1,268/hr</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <QueueMetric label="Utilization (ρ)"         value="0.71"  status="warn" />
            <Separator />
            <QueueMetric label="Avg Items in System (L)"  value="2.45"  />
            <QueueMetric label="Avg Wait Time (Wq)"       value="0.32 s" />
            <QueueMetric label="Overflow Probability"     value="4.2%"  />
            <Separator />
            {/* Utilization bar */}
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-2xs text-muted-foreground">Capacity used</span>
                <span className="text-2xs font-medium">71%</span>
              </div>
              <div className="w-full h-1 bg-muted">
                <div className="h-full bg-warning transition-all" style={{ width: "71%" }} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Recent Scan Activity ──────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between w-full">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Database className="w-3.5 h-3.5" />
                Recent Scan Activity
              </CardTitle>
              <CardDescription>Last 8 scans — auto-refreshes every 5s</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-2xs">
                <span className="w-1.5 h-1.5 bg-success inline-block mr-1" />
                Live
              </Badge>
              <Button variant="ghost" size="xs">
                View All <ChevronRight className="w-3 h-3" />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Package ID</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Confidence</TableHead>
                <TableHead className="text-right">Scan Time</TableHead>
                <TableHead>Blockchain TX</TableHead>
                <TableHead className="text-right">Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {SCAN_LOGS.map((log) => (
                <TableRow key={log.id}>
                  <TableCell>
                    <span className="mono-value text-muted-foreground">{log.id}…</span>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        log.status === "good"    ? "good"    :
                        log.status === "damaged" ? "damaged" : "empty"
                      }
                    >
                      {log.status === "good"    && <Package     className="w-2.5 h-2.5" />}
                      {log.status === "damaged" && <PackageX    className="w-2.5 h-2.5" />}
                      {log.status === "empty"   && <PackageOpen className="w-2.5 h-2.5" />}
                      {log.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className={
                      log.confidence >= 95 ? "text-success font-medium" :
                      log.confidence >= 85 ? "text-warning font-medium" :
                      "text-destructive font-medium"
                    }>
                      {log.confidence.toFixed(1)}%
                    </span>
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {(log.scan_ms / 1000).toFixed(2)}s
                  </TableCell>
                  <TableCell>
                    {log.tx === "—" ? (
                      <span className="text-muted-foreground text-xs">Not logged</span>
                    ) : (
                      <span className="mono-value flex items-center gap-1 text-muted-foreground">
                        <Link className="w-2.5 h-2.5 shrink-0" />
                        {log.tx}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground tabular-nums">
                    {log.time}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* ── System Info Row ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pb-2">
        <InfoTile icon={Cpu}      label="AI Engine"  value="TensorFlow.js"   sub="MobileNet v2 — in-browser"      />
        <InfoTile icon={Link}     label="Blockchain" value="Ganache Testnet"  sub="Chain ID 1337 · Port 8545"      />
        <InfoTile icon={Database} label="Database"   value="Appwrite"         sub="Documents DB · Collections ×3"  />
      </div>
    </div>
  )
}

// ─── Stat Card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, delta, up, icon: Icon, sub }: typeof STATS[number]) {
  return (
    <div className="stat-card">
      <div className="flex items-start justify-between gap-2">
        <span className="stat-card-label">{label}</span>
        <Icon className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" strokeWidth={1.5} />
      </div>
      <span className="stat-card-value">{value}</span>
      <div className="flex items-center gap-1.5">
        <span className={`stat-card-delta flex items-center gap-0.5 ${up ? "text-success" : "text-destructive"}`}>
          {up
            ? <ArrowUpRight   className="w-3 h-3" />
            : <ArrowDownRight className="w-3 h-3" />
          }
          {delta}
        </span>
        <span className="text-2xs text-muted-foreground">{sub}</span>
      </div>
    </div>
  )
}

// ─── Legend Item (right-side vertical legend) ──────────────────────────────────
function LegendItem({ color, label, count }: { color: string; label: string; count: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-1.5">
        <span style={{ width: 8, height: 8, background: color, display: "inline-block", flexShrink: 0 }} />
        <span className="text-2xs text-muted-foreground capitalize">{label}</span>
      </div>
      <span className="text-sm font-semibold tabular-nums pl-[14px]">{count}</span>
    </div>
  )
}

// ─── Queue Metric Row ──────────────────────────────────────────────────────────
function QueueMetric({ label, value, status }: { label: string; value: string; status?: "warn" }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`text-xs font-semibold tabular-nums ${status === "warn" ? "text-warning" : ""}`}>
        {value}
      </span>
    </div>
  )
}

// ─── Info Tile ─────────────────────────────────────────────────────────────────
function InfoTile({ icon: Icon, label, value, sub }: {
  icon: React.ElementType; label: string; value: string; sub: string
}) {
  return (
    <div className="flex items-start gap-3 border border-border p-3 bg-card">
      <div className="w-7 h-7 border border-border flex items-center justify-center shrink-0 bg-muted">
        <Icon className="w-3.5 h-3.5 text-muted-foreground" strokeWidth={1.5} />
      </div>
      <div className="min-w-0">
        <p className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="text-sm font-semibold text-foreground mt-0.5 truncate">{value}</p>
        <p className="text-2xs text-muted-foreground mt-0.5 truncate">{sub}</p>
      </div>
    </div>
  )
}
