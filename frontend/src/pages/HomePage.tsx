import {
  ScanLine,
  Activity,
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
  FlaskConical,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

// ─── Mock Data ─────────────────────────────────────────────────────────────────
const STATS = [
  {
    label:   "Total Scans Today",
    value:   "1,247",
    delta:   "+12.4%",
    up:      true,
    icon:    Boxes,
    sub:     "vs. yesterday",
  },
  {
    label:   "Good Packages",
    value:   "1,183",
    delta:   "94.9%",
    up:      true,
    icon:    Package,
    sub:     "pass rate",
  },
  {
    label:   "Damaged Flagged",
    value:   "47",
    delta:   "+3",
    up:      false,
    icon:    PackageX,
    sub:     "since last hour",
  },
  {
    label:   "Avg Scan Time",
    value:   "2.84s",
    delta:   "-0.12s",
    up:      true,
    icon:    Clock,
    sub:     "µ = 1,268/hr",
  },
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

const MM1_METRICS = { rho: 0.71, L: 2.45, Wq: "0.32s", overflow_prob: "4.2%" }

// ─── Home Page ─────────────────────────────────────────────────────────────────
export function HomePage() {
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
          <Button variant="outline" size="sm">
            Export Report
          </Button>
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

      {/* ── Mode Cards + Queue Metrics ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Live Scanner Mode */}
        <ModeCard
          icon={ScanLine}
          iconBg="bg-foreground"
          iconColor="text-background"
          title="Live Scanner"
          badge="Mode 1"
          badgeVariant="secondary"
          description="Real-time AI inspection using TensorFlow.js. Classifies packages as Good, Damaged, or Empty. Completed scans are logged immutably to the Ganache blockchain."
          stats={[
            { label: "Model",       value: "TF.js MobileNet" },
            { label: "Blockchain",  value: "Ganache Local"   },
            { label: "Last scan",   value: "4s ago"          },
          ]}
          actionLabel="Launch Scanner"
          actionVariant="default"
          statusDot="success"
          statusLabel="Ready"
        />

        {/* Simulation Mode */}
        <ModeCard
          icon={FlaskConical}
          iconBg="bg-muted"
          iconColor="text-foreground"
          title="Simulation Dashboard"
          badge="Mode 2"
          badgeVariant="secondary"
          description="M/M/1 Discrete-Event Simulation with 1,000+ Monte Carlo replications. Predicts queue overflow probability and system utilization across a full shift."
          stats={[
            { label: "Model",        value: "M/M/1 Queue"   },
            { label: "Replications", value: "1,000"         },
            { label: "Last run",     value: "2m ago"        },
          ]}
          actionLabel="Open Simulation"
          actionVariant="outline"
          statusDot="stable"
          statusLabel="Idle"
        />

        {/* Queue Metrics Panel */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-3.5 h-3.5" />
              M/M/1 Live Metrics
            </CardTitle>
            <CardDescription>Theoretical — current shift params</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            <MetricRow label="Utilization (ρ)" value={MM1_METRICS.rho.toString()}>
              <UtilizationBar rho={MM1_METRICS.rho} />
            </MetricRow>
            <Separator />
            <MetricRow label="Avg Items in System (L)"   value={MM1_METRICS.L.toString()} />
            <MetricRow label="Avg Wait Time (Wq)"        value={MM1_METRICS.Wq} />
            <MetricRow label="Overflow Probability"       value={MM1_METRICS.overflow_prob} />
            <Separator />
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Queue Stability</span>
              <Badge variant="stable">Stable</Badge>
            </div>
          </CardContent>
          <CardFooter className="gap-2">
            <Button variant="ghost" size="xs" className="text-xs gap-1">
              <Activity className="w-3 h-3" /> Run Simulation
            </Button>
          </CardFooter>
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
                  {/* Package ID */}
                  <TableCell>
                    <span className="mono-value text-muted-foreground">{log.id}…</span>
                  </TableCell>

                  {/* Status Badge */}
                  <TableCell>
                    <Badge
                      variant={
                        log.status === "good"    ? "good"    :
                        log.status === "damaged" ? "damaged" : "empty"
                      }
                    >
                      {log.status === "good"    && <Package  className="w-2.5 h-2.5" />}
                      {log.status === "damaged" && <PackageX className="w-2.5 h-2.5" />}
                      {log.status === "empty"   && <PackageOpen className="w-2.5 h-2.5" />}
                      {log.status}
                    </Badge>
                  </TableCell>

                  {/* Confidence */}
                  <TableCell className="text-right">
                    <span className={
                      log.confidence >= 95 ? "text-success font-medium" :
                      log.confidence >= 85 ? "text-warning font-medium" :
                      "text-destructive font-medium"
                    }>
                      {log.confidence.toFixed(1)}%
                    </span>
                  </TableCell>

                  {/* Scan Time */}
                  <TableCell className="text-right text-muted-foreground">
                    {(log.scan_ms / 1000).toFixed(2)}s
                  </TableCell>

                  {/* Blockchain TX */}
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

                  {/* Time */}
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
        <InfoTile icon={Cpu}      label="AI Engine"    value="TensorFlow.js"         sub="MobileNet v2 — in-browser" />
        <InfoTile icon={Link}     label="Blockchain"   value="Ganache Testnet"        sub="Chain ID 1337 · Port 8545"  />
        <InfoTile icon={Database} label="Database"     value="Supabase PostgreSQL"    sub="Row-level security enabled" />
      </div>
    </div>
  )
}

// ─── Stat Card ─────────────────────────────────────────────────────────────────
function StatCard({
  label, value, delta, up, icon: Icon, sub,
}: typeof STATS[number]) {
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
            ? <ArrowUpRight className="w-3 h-3" />
            : <ArrowDownRight className="w-3 h-3" />
          }
          {delta}
        </span>
        <span className="text-2xs text-muted-foreground">{sub}</span>
      </div>
    </div>
  )
}

// ─── Mode Card ─────────────────────────────────────────────────────────────────
function ModeCard({
  icon: Icon, iconBg, iconColor, title, badge, badgeVariant, description,
  stats, actionLabel, actionVariant, statusDot, statusLabel,
}: {
  icon: React.ElementType
  iconBg: string
  iconColor: string
  title: string
  badge: string
  badgeVariant: "secondary" | "default"
  description: string
  stats: { label: string; value: string }[]
  actionLabel: string
  actionVariant: "default" | "outline"
  statusDot: "success" | "stable"
  statusLabel: string
}) {
  return (
    <Card className="flex flex-col">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className={`w-8 h-8 flex items-center justify-center shrink-0 ${iconBg}`}>
            <Icon className={`w-4 h-4 ${iconColor}`} strokeWidth={2} />
          </div>
          <Badge variant={badgeVariant} className="text-2xs shrink-0">{badge}</Badge>
        </div>
        <CardTitle className="mt-2">{title}</CardTitle>
        <CardDescription className="text-xs leading-relaxed">{description}</CardDescription>
      </CardHeader>

      <CardContent className="pt-0 flex-1">
        <div className="border border-border divide-y divide-border">
          {stats.map((s) => (
            <div key={s.label} className="flex items-center justify-between px-2.5 py-1.5">
              <span className="text-xs text-muted-foreground">{s.label}</span>
              <span className="text-xs font-medium text-foreground">{s.value}</span>
            </div>
          ))}
        </div>
      </CardContent>

      <CardFooter className="justify-between">
        <span className={`flex items-center gap-1 text-xs font-medium ${statusDot === "success" ? "text-success" : "text-muted-foreground"}`}>
          <span className={`w-1.5 h-1.5 inline-block ${statusDot === "success" ? "bg-success" : "bg-muted-foreground"}`} />
          {statusLabel}
        </span>
        <Button variant={actionVariant} size="sm" className="gap-1">
          {actionLabel} <ArrowUpRight className="w-3 h-3" />
        </Button>
      </CardFooter>
    </Card>
  )
}

// ─── Utilization Bar ───────────────────────────────────────────────────────────
function UtilizationBar({ rho }: { rho: number }) {
  const pct = Math.min(rho * 100, 100)
  const color = rho < 0.7 ? "bg-success" : rho < 0.9 ? "bg-warning" : "bg-destructive"
  return (
    <div className="mt-1 w-full h-1 bg-muted">
      <div className={`h-full transition-all ${color}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

// ─── Metric Row ────────────────────────────────────────────────────────────────
function MetricRow({
  label, value, children,
}: {
  label: string
  value: string
  children?: React.ReactNode
}) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="text-xs font-semibold tabular-nums">{value}</span>
      </div>
      {children}
    </div>
  )
}

// ─── Info Tile ─────────────────────────────────────────────────────────────────
function InfoTile({
  icon: Icon, label, value, sub,
}: {
  icon: React.ElementType
  label: string
  value: string
  sub: string
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
