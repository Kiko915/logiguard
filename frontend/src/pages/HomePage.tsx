import { useState, useEffect, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { api } from "@/lib/api"
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
  FileText,
  CalendarDays,
  ScrollText,
  X,
  AlertCircle,
  ShieldCheck,
  Loader2,
} from "lucide-react"
import { Label } from "@/components/ui/label"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import { DashboardSkeleton } from "@/pages/DashboardSkeleton"
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

// ─── API Types ────────────────────────────────────────────────────────────────

interface LiveStats {
  good:    number
  damaged: number
  empty:   number
}
interface ApiScanLog {
  id:           string
  package_id:   string
  status:       "good" | "damaged" | "empty"
  confidence:   number   // 0–1
  scan_time_ms: number
  created_at:   string
}

// ─── Mock Data (fallback / hourly chart — backend has no time-bucket endpoint yet) ──

const STATS_FALLBACK = [
  {
    label: "Total Scans Today",
    value: "—",
    delta: "loading",
    up:    true,
    icon:  Boxes,
    sub:   "all time",
  },
  {
    label: "Good Packages",
    value: "—",
    delta: "loading",
    up:    true,
    icon:  Package,
    sub:   "pass rate",
  },
  {
    label: "Damaged Flagged",
    value: "—",
    delta: "loading",
    up:    false,
    icon:  PackageX,
    sub:   "flagged",
  },
  {
    label: "Avg Scan Time",
    value: "—",
    delta: "loading",
    up:    true,
    icon:  Clock,
    sub:   "µ = …/hr",
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

const STATUS_DIST_FALLBACK = [
  { name: "Good",    value: 0 },
  { name: "Damaged", value: 0 },
  { name: "Empty",   value: 0 },
]

const DONUT_COLORS = [C.good, C.damaged, C.empty]

/** Built from live M/M/1 metrics; falls back to zeroes for empty state */
function buildMM1BarData(rho: number, L: number, Wq_s: number) {
  return [
    { label: "ρ (Util.)", value: parseFloat(Math.min(rho, 9.99).toFixed(3)) },
    { label: "L (Items)", value: parseFloat(Math.min(L,   9.99).toFixed(3)) },
    { label: "Wq (s)",    value: parseFloat(Math.min(Wq_s, 9.99).toFixed(3)) },
  ]
}

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
  const p   = payload[0]
  const sum = payload.reduce((s, x) => s + x.value, p.value)  // approximate from segment
  const pct = sum > 0 ? ((p.value / sum) * 100).toFixed(1) : "—"
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

// Persists across navigations — set to true after the first successful load
// so returning to the dashboard never re-shows the skeleton.
let dashboardLoaded = false

// ─── Home Page ─────────────────────────────────────────────────────────────────
export function HomePage() {
  const navigate = useNavigate()
  const [loading,    setLoading]    = useState(!dashboardLoaded)
  const [liveStats,  setLiveStats]  = useState<LiveStats | null>(null)
  const [recentLogs, setRecentLogs] = useState<ApiScanLog[]>([])
  const [derivedMu,  setDerivedMu]  = useState<number | null>(null)

  // Initial skeleton delay (first visit only)
  useEffect(() => {
    if (dashboardLoaded) return
    const t = setTimeout(() => { dashboardLoaded = true; setLoading(false) }, 1400)
    return () => clearTimeout(t)
  }, [])

  // Fetch live stats + recent logs from backend
  useEffect(() => {
    interface ApiStats {
      total_scans:      number
      good_count:       number
      damaged_count:    number
      empty_count:      number
      avg_scan_time_ms: number | null
    }
    interface StatsResponse { data: { stats: ApiStats; derived_service_rate: number | null } }
    interface LogsResponse  { data: ApiScanLog[] }

    Promise.all([
      api.get<StatsResponse>("/api/v1/scanner/stats"),
      api.get<LogsResponse>("/api/v1/scanner/logs?per_page=8"),
    ])
      .then(([statsRes, logsRes]) => {
        const s = statsRes.data.stats
        setLiveStats({ good: s.good_count, damaged: s.damaged_count, empty: s.empty_count })
        setDerivedMu(statsRes.data.derived_service_rate)
        setRecentLogs(logsRes.data)
      })
      .catch(err => console.error("Dashboard fetch failed:", err))
  }, [])

  // Derive display values from live data
  const statusDist = useMemo(() => liveStats
    ? [
        { name: "Good",    value: liveStats.good    },
        { name: "Damaged", value: liveStats.damaged  },
        { name: "Empty",   value: liveStats.empty    },
      ]
    : STATUS_DIST_FALLBACK,
  [liveStats])

  const total = statusDist.reduce((s, d) => s + d.value, 0)

  /**
   * Derive M/M/1 theoretical metrics from real scan data.
   * λ is estimated as total_scans_24h / 24 (since the stats endpoint
   * covers the last 24 hours). µ comes from the backend-derived service rate.
   */
  const mm1 = useMemo(() => {
    if (total === 0 || !derivedMu) return null
    const lambda  = total / 24        // packages per hour (24-h window)
    const mu      = derivedMu
    const rho     = lambda / mu
    const stable  = rho < 1
    const L       = stable ? rho / (1 - rho)         : Infinity
    const Lq      = stable ? rho ** 2 / (1 - rho)    : Infinity
    const Wq_hr   = stable ? Lq / lambda              : Infinity
    const Wq_s    = Wq_hr * 3600
    return { lambda, mu, rho, L, Lq, Wq_s, stable }
  }, [total, derivedMu])

  const liveKpiStats = useMemo(() => {
    if (!liveStats) return STATS_FALLBACK
    const passRate    = total > 0 ? ((liveStats.good / total) * 100).toFixed(1) : "—"
    const muLabel     = derivedMu ? `µ = ${Math.round(derivedMu)}/hr` : "µ = —"
    const avgSec      = derivedMu ? (3600 / derivedMu).toFixed(2) + "s" : "—"
    return [
      { label: "Total Scans",     value: total.toLocaleString(),              delta: "all time",     up: true,  icon: Boxes,   sub: "since first scan" },
      { label: "Good Packages",   value: liveStats.good.toLocaleString(),     delta: `${passRate}%`, up: true,  icon: Package, sub: "pass rate" },
      { label: "Damaged Flagged", value: liveStats.damaged.toLocaleString(),  delta: "flagged",      up: false, icon: PackageX,sub: "inspection failures" },
      { label: "Avg Scan Time",   value: avgSec,                              delta: muLabel,        up: true,  icon: Clock,   sub: "derived from logs" },
    ]
  }, [liveStats, total, derivedMu])

  // ── Report modal state ────────────────────────────────────────────────────
  const [reportOpen,     setReportOpen]     = useState(false)
  const [reportCoverage, setReportCoverage] = useState<"all" | "custom">("all")
  const [reportFrom,     setReportFrom]     = useState("")
  const [reportTo,       setReportTo]       = useState("")
  const [isGenerating,   setGenerating]     = useState(false)
  const [reportError,    setReportError]    = useState<string | null>(null)

  async function generateReport() {
    setGenerating(true)
    setReportError(null)
    try {
      // Fetch all matching logs page by page
      interface LogDoc {
        id: string; package_id: string; status: "good"|"damaged"|"empty"
        confidence: number; scan_time_ms: number; created_at: string
      }
      interface LogsResp { data: LogDoc[]; meta?: { total?: number } }

      const allLogs: LogDoc[] = []
      let pg = 1
      while (true) {
        const params = new URLSearchParams({ page: String(pg), per_page: "100" })
        if (reportCoverage === "custom" && reportFrom)
          params.set("from", new Date(reportFrom).toISOString())
        if (reportCoverage === "custom" && reportTo)
          params.set("to", new Date(reportTo + "T23:59:59").toISOString())

        const res  = await api.get<LogsResp>(`/api/v1/scanner/logs?${params}`)
        const docs = res.data ?? []
        allLogs.push(...docs)
        const rTotal = res.meta?.total ?? 0
        if (allLogs.length >= rTotal || docs.length < 100) break
        pg++
      }

      const rTotal   = allLogs.length
      const rGood    = allLogs.filter(l => l.status === "good").length
      const rDamaged = allLogs.filter(l => l.status === "damaged").length
      const rEmpty   = allLogs.filter(l => l.status === "empty").length

      // Fetch logo as base64
      let logoBase64 = ""
      try {
        const r = await fetch("/branding/logiguard_wordmark.png")
        const buf = await r.arrayBuffer()
        logoBase64 = "data:image/png;base64," +
          btoa(Array.from(new Uint8Array(buf)).map(b => String.fromCharCode(b)).join(""))
      } catch { /* skip */ }

      const doc    = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
      const W      = doc.internal.pageSize.getWidth()
      const MARGIN = 14
      const NAVY   = [15, 23, 42]    as [number,number,number]
      const SLATE  = [71, 85, 105]   as [number,number,number]
      const BORDER = [226, 232, 240] as [number,number,number]
      const GREEN  = [22, 163, 74]   as [number,number,number]
      const RED    = [220, 38, 38]   as [number,number,number]
      const AMBER  = [217, 119, 6]   as [number,number,number]

      // Header band
      doc.setFillColor(...NAVY)
      doc.rect(0, 0, W, 28, "F")
      if (logoBase64) {
        doc.addImage(logoBase64, "PNG", MARGIN, 6, 44, 14)
      } else {
        doc.setFont("helvetica", "bold").setFontSize(16).setTextColor(255,255,255)
        doc.text("LOGIGUARD", MARGIN, 17)
      }
      doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(148,163,184)
      doc.text("Intelligent Package Inspection · Secured by Blockchain", MARGIN, 23)
      doc.setFont("helvetica", "bold").setFontSize(10).setTextColor(255,255,255)
      doc.text("SYSTEM OVERVIEW REPORT", W - MARGIN, 13, { align: "right" })
      doc.setFont("helvetica", "normal").setFontSize(7.5).setTextColor(148,163,184)
      doc.text(
        `Generated: ${new Date().toLocaleString("en-PH", { dateStyle: "long", timeStyle: "short" })}`,
        W - MARGIN, 19, { align: "right" }
      )

      let y = 36

      // Coverage line
      doc.setFont("helvetica", "bold").setFontSize(8).setTextColor(...SLATE)
      doc.text("COVERAGE", MARGIN, y)
      doc.setFont("helvetica", "normal")
      doc.text(
        reportCoverage === "all" ? "All Time" : `${reportFrom || "—"}  →  ${reportTo || "—"}`,
        MARGIN + 22, y
      )
      doc.setDrawColor(...BORDER).setLineWidth(0.3)
      doc.line(MARGIN, y + 3, W - MARGIN, y + 3)
      y += 10

      // KPI boxes
      const kpis = [
        { label: "Total Scans", value: rTotal.toLocaleString(),   color: NAVY  },
        { label: "Good",        value: rGood.toLocaleString(),    color: GREEN },
        { label: "Damaged",     value: rDamaged.toLocaleString(), color: RED   },
        { label: "Empty",       value: rEmpty.toLocaleString(),   color: AMBER },
      ]
      const boxW = (W - MARGIN * 2 - 9) / 4
      kpis.forEach((kpi, i) => {
        const x = MARGIN + i * (boxW + 3)
        doc.setFillColor(248, 250, 252).setDrawColor(...BORDER).setLineWidth(0.3)
        doc.rect(x, y, boxW, 18, "FD")
        doc.setFillColor(...kpi.color).rect(x, y, 2, 18, "F")
        doc.setFont("helvetica", "bold").setFontSize(16).setTextColor(...kpi.color)
        doc.text(kpi.value, x + boxW / 2, y + 11, { align: "center" })
        doc.setFont("helvetica", "normal").setFontSize(7).setTextColor(...SLATE)
        doc.text(kpi.label.toUpperCase(), x + boxW / 2, y + 16, { align: "center" })
      })
      y += 24

      // Rates row
      if (rTotal > 0) {
        doc.setFont("helvetica", "normal").setFontSize(7.5).setTextColor(...SLATE)
        doc.text([
          `Pass Rate: ${((rGood / rTotal) * 100).toFixed(1)}%`,
          `Defect Rate: ${((rDamaged / rTotal) * 100).toFixed(1)}%`,
          `Empty Rate: ${((rEmpty / rTotal) * 100).toFixed(1)}%`,
          `Records: ${rTotal.toLocaleString()}`,
        ].join("    ·    "), MARGIN, y)
        y += 7
      }

      // M/M/1 metrics section (if available)
      if (mm1) {
        doc.setDrawColor(...BORDER).line(MARGIN, y, W - MARGIN, y)
        y += 5
        doc.setFont("helvetica", "bold").setFontSize(8).setTextColor(...NAVY)
        doc.text("M/M/1 QUEUE METRICS", MARGIN, y)
        y += 5

        const metrics = [
          { label: "Arrival Rate (λ)",       value: `${Math.round(mm1.lambda)}/hr` },
          { label: "Service Rate (µ)",        value: `${Math.round(mm1.mu)}/hr` },
          { label: "Utilization (ρ)",         value: mm1.rho.toFixed(3) },
          { label: "Avg Items in System (L)", value: isFinite(mm1.L)    ? mm1.L.toFixed(3)    : "∞" },
          { label: "Avg Wait Time (Wq)",      value: isFinite(mm1.Wq_s) ? `${mm1.Wq_s.toFixed(2)}s` : "∞" },
          { label: "Queue Stability",         value: mm1.stable ? "Stable" : "UNSTABLE" },
        ]
        const mW = (W - MARGIN * 2 - 5) / 3
        metrics.forEach((m, i) => {
          const col = i % 3, row = Math.floor(i / 3)
          const mx  = MARGIN + col * (mW + 2.5)
          const my  = y + row * 12
          doc.setFillColor(248, 250, 252).setDrawColor(...BORDER).setLineWidth(0.2)
          doc.rect(mx, my, mW, 10, "FD")
          doc.setFont("helvetica", "normal").setFontSize(6.5).setTextColor(...SLATE)
          doc.text(m.label, mx + 3, my + 4)
          const isUnstable = m.value === "UNSTABLE"
          if (isUnstable) doc.setFont("helvetica", "bold").setFontSize(8).setTextColor(...RED)
          else            doc.setFont("helvetica", "bold").setFontSize(8).setTextColor(...NAVY)
          doc.text(m.value, mx + mW - 3, my + 7.5, { align: "right" })
        })
        y += Math.ceil(metrics.length / 3) * 12 + 5
      }

      // Scan log table
      doc.setDrawColor(...BORDER).line(MARGIN, y, W - MARGIN, y)
      y += 5
      doc.setFont("helvetica", "bold").setFontSize(8).setTextColor(...NAVY)
      doc.text("INSPECTION RECORDS", MARGIN, y)
      y += 4

      autoTable(doc, {
        startY: y,
        margin: { left: MARGIN, right: MARGIN },
        head: [["Log ID", "Package ID", "Status", "Confidence", "Scan Time", "Timestamp"]],
        body: allLogs.map(log => {
          const d = new Date(log.created_at)
          return [
            log.id.slice(0, 12) + "…",
            log.package_id.slice(0, 14) + "…",
            log.status.toUpperCase(),
            (log.confidence * 100).toFixed(1) + "%",
            (log.scan_time_ms / 1000).toFixed(2) + "s",
            d.toLocaleString("en-PH", { dateStyle: "short", timeStyle: "short" }),
          ]
        }),
        styles: {
          fontSize: 7.5, font: "helvetica",
          cellPadding: { top: 2.5, bottom: 2.5, left: 3, right: 3 },
          lineColor: BORDER, lineWidth: 0.2,
        },
        headStyles: {
          fillColor: NAVY, textColor: [255,255,255],
          fontSize: 7, fontStyle: "bold", halign: "left",
        },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: {
          0: { cellWidth: 24 }, 1: { cellWidth: 32 },
          2: { cellWidth: 20, halign: "center" },
          3: { cellWidth: 20, halign: "right" },
          4: { cellWidth: 18, halign: "right" },
          5: { cellWidth: "auto" },
        },
        didParseCell(data) {
          if (data.section === "body" && data.column.index === 2) {
            const v = String(data.cell.raw)
            if (v === "GOOD")    { data.cell.styles.textColor = GREEN; data.cell.styles.fontStyle = "bold" }
            if (v === "DAMAGED") { data.cell.styles.textColor = RED;   data.cell.styles.fontStyle = "bold" }
            if (v === "EMPTY")   { data.cell.styles.textColor = AMBER; data.cell.styles.fontStyle = "bold" }
          }
        },
        didDrawPage(data) {
          const pH = doc.internal.pageSize.getHeight()
          doc.setFillColor(...NAVY).rect(0, pH - 10, W, 10, "F")
          doc.setFont("helvetica", "normal").setFontSize(6.5).setTextColor(148, 163, 184)
          doc.text("LogiGuard · Confidential — For Internal Use Only", MARGIN, pH - 4)
          doc.text(`Page ${data.pageNumber}`, W - MARGIN, pH - 4, { align: "right" })
        },
      })

      const suffix = reportCoverage === "custom" && reportFrom ? `-${reportFrom}` : "-all-time"
      doc.save(`logiguard-overview-report${suffix}-${new Date().toISOString().slice(0, 10)}.pdf`)
      setReportOpen(false)
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Report generation failed"
      setReportError(msg)
      console.error("[GenerateReport]", err)
    } finally {
      setGenerating(false)
    }
  }

  if (loading) return <DashboardSkeleton />

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
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => { setReportOpen(true); setReportError(null) }}>
            <FileText className="w-3.5 h-3.5" />
            Export Report
          </Button>
          <Button size="sm" onClick={() => navigate("/live-scanner")}>
            <ScanLine className="w-3.5 h-3.5" />
            Start Scan
          </Button>
        </div>
      </div>

      {/* ── KPI Stats Row ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {liveKpiStats.map((stat) => (
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
            {total === 0 ? (
              /* ── Empty state ─────────────────────────────────────────────────── */
              <div className="flex flex-col items-center justify-center h-[180px] gap-2 text-muted-foreground">
                <Activity className="w-8 h-8 opacity-25" strokeWidth={1.5} />
                <p className="text-sm font-medium opacity-60">No scan data yet</p>
                <p className="text-xs opacity-40 text-center max-w-[220px]">
                  Run the Live Scanner to populate this chart with real throughput data.
                </p>
              </div>
            ) : (
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
                      <Area type="monotone" dataKey="empty"   stackId="s" stroke={C.empty}   fill="url(#grad-empty)"   strokeWidth={1.5} dot={false} />
                      <Area type="monotone" dataKey="damaged" stackId="s" stroke={C.damaged} fill="url(#grad-damaged)" strokeWidth={1.5} dot={false} />
                      <Area type="monotone" dataKey="good"    stackId="s" stroke={C.good}    fill="url(#grad-good)"    strokeWidth={1.5}
                        dot={{ r: 2, fill: C.good, strokeWidth: 0 }}
                        activeDot={{ r: 3, fill: C.good, strokeWidth: 0 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                {/* Right-side legend — use live counts */}
                <div className="flex flex-col justify-center gap-3.5 shrink-0 border-l border-border pl-4 pr-1 py-2">
                  <LegendItem color={C.good}    label="Good"    count={statusDist[0].value.toLocaleString()} />
                  <LegendItem color={C.damaged} label="Damaged" count={statusDist[1].value.toLocaleString()} />
                  <LegendItem color={C.empty}   label="Empty"   count={statusDist[2].value.toLocaleString()} />
                </div>
              </div>
            )}
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
            {total === 0 ? (
              /* ── Empty state ─────────────────────────────────────────────────── */
              <div className="flex flex-col items-center justify-center gap-2 py-4 text-muted-foreground">
                {/* Placeholder ring */}
                <svg width="80" height="80" viewBox="0 0 80 80">
                  <circle cx="40" cy="40" r="30" fill="none" stroke="currentColor" strokeWidth="10" strokeOpacity="0.12" strokeDasharray="4 3" />
                </svg>
                <p className="text-xs opacity-50 text-center">No scans recorded yet</p>
                {/* Legend rows with dash placeholders */}
                <div className="flex flex-col gap-1.5 mt-1 w-full">
                  {statusDist.map((d, i) => (
                    <div key={d.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span style={{ width: 8, height: 8, background: DONUT_COLORS[i], display: "inline-block", flexShrink: 0, opacity: 0.3 }} />
                        <span className="text-xs text-muted-foreground/50">{d.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium tabular-nums text-muted-foreground/40">0</span>
                        <span className="text-2xs text-muted-foreground/40 tabular-nums w-10 text-right">—</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={136}>
                  <PieChart>
                    <Pie
                      data={statusDist}
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
                      {statusDist.map((_, i) => (
                        <Cell key={i} fill={DONUT_COLORS[i]} />
                      ))}
                    </Pie>
                    <Tooltip content={<PieTooltip />} />
                  </PieChart>
                </ResponsiveContainer>

                {/* Legend rows */}
                <div className="flex flex-col gap-1.5 mt-2">
                  {statusDist.map((d, i) => (
                    <div key={d.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span style={{ width: 8, height: 8, background: DONUT_COLORS[i], display: "inline-block", flexShrink: 0 }} />
                        <span className="text-xs text-muted-foreground">{d.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium tabular-nums">{d.value.toLocaleString()}</span>
                        <span className="text-2xs text-muted-foreground tabular-nums w-10 text-right">
                          {total > 0 ? `${((d.value / total) * 100).toFixed(1)}%` : "—"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
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
            <CardDescription>
              {mm1
                ? `Derived from last 24 h · λ ≈ ${Math.round(mm1.lambda)}/hr · µ ≈ ${Math.round(mm1.mu)}/hr`
                : "Theoretical metrics — run scans to derive real values"}
            </CardDescription>
            {mm1 && (
              <Badge variant={mm1.stable ? "stable" : "unstable"} className="text-2xs self-start">
                {mm1.stable ? "Stable" : "Unstable — ρ ≥ 1"}
              </Badge>
            )}
          </CardHeader>
          <CardContent className="pr-4">
            {!mm1 ? (
              <div className="flex flex-col items-center justify-center h-[120px] gap-2 text-muted-foreground">
                <BarChart3 className="w-7 h-7 opacity-20" strokeWidth={1.5} />
                <p className="text-xs opacity-50">No scan data — M/M/1 metrics unavailable</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={120}>
                <BarChart
                  data={buildMM1BarData(mm1.rho, mm1.L, mm1.Wq_s)}
                  margin={{ top: 4, right: 0, left: -28, bottom: 0 }}
                  barSize={28}
                >
                  <CartesianGrid strokeDasharray="2 4" stroke={C.grid} horizontal={true} vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: C.text }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: C.text }} axisLine={false} tickLine={false} allowDecimals />
                  <Tooltip content={<BarTooltip />} cursor={{ fill: C.grid + "33" }} />
                  <Bar dataKey="value" radius={[0, 0, 0, 0]}>
                    {buildMM1BarData(mm1.rho, mm1.L, mm1.Wq_s).map((d, i) => (
                      <Cell
                        key={i}
                        fill={d.value >= 0.9 ? C.damaged : d.value >= 0.7 ? C.warn : C.primary}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Queue Key Metrics */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-3.5 h-3.5" />
              Queue Key Values
            </CardTitle>
            <CardDescription>
              {mm1
                ? `λ ≈ ${Math.round(mm1.lambda)}/hr · µ ≈ ${Math.round(mm1.mu)}/hr`
                : "Awaiting scan data"}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {!mm1 ? (
              <div className="flex flex-col items-center justify-center py-6 gap-2 text-muted-foreground">
                <Activity className="w-7 h-7 opacity-20" strokeWidth={1.5} />
                <p className="text-xs opacity-50 text-center">
                  Queue metrics will appear once scans are recorded.
                </p>
              </div>
            ) : (
              <>
                <QueueMetric
                  label="Utilization (ρ)"
                  value={mm1.rho.toFixed(3)}
                  status={mm1.rho >= 1 ? "danger" : mm1.rho >= 0.8 ? "warn" : undefined}
                />
                <Separator />
                <QueueMetric label="Avg Items in System (L)"  value={isFinite(mm1.L)     ? mm1.L.toFixed(2)           : "∞"} />
                <QueueMetric label="Avg Wait Time (Wq)"       value={isFinite(mm1.Wq_s)  ? `${mm1.Wq_s.toFixed(2)} s` : "∞"} />
                <Separator />
                {/* Utilization bar */}
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-2xs text-muted-foreground">Capacity used</span>
                    <span className="text-2xs font-medium">{(Math.min(mm1.rho, 1) * 100).toFixed(1)}%</span>
                  </div>
                  <div className="w-full h-1 bg-muted">
                    <div
                      className={`h-full transition-all ${mm1.rho >= 1 ? "bg-destructive" : mm1.rho >= 0.8 ? "bg-warning" : "bg-success"}`}
                      style={{ width: `${Math.min(mm1.rho * 100, 100).toFixed(1)}%` }}
                    />
                  </div>
                </div>
              </>
            )}
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
              <Button variant="ghost" size="xs" onClick={() => navigate("/scan-logs")}>
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
              {recentLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-xs text-muted-foreground">
                    No scans yet — run the Live Scanner to populate this table.
                  </TableCell>
                </TableRow>
              ) : recentLogs.map((log) => {
                const confPct  = (log.confidence * 100)
                const timeStr  = new Date(log.created_at).toLocaleTimeString("en-PH", { hour12: false })
                const shortId  = log.package_id.slice(0, 13) + "…"
                return (
                  <TableRow key={log.id}>
                    <TableCell>
                      <span className="mono-value text-muted-foreground">{shortId}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={log.status}>
                        {log.status === "good"    && <Package     className="w-2.5 h-2.5" />}
                        {log.status === "damaged" && <PackageX    className="w-2.5 h-2.5" />}
                        {log.status === "empty"   && <PackageOpen className="w-2.5 h-2.5" />}
                        {log.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={
                        confPct >= 95 ? "text-success font-medium tabular-nums" :
                        confPct >= 85 ? "text-warning font-medium tabular-nums" :
                                        "text-destructive font-medium tabular-nums"
                      }>
                        {confPct.toFixed(1)}%
                      </span>
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground tabular-nums">
                      {(log.scan_time_ms / 1000).toFixed(2)}s
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground/60 italic">Via blockchain</span>
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground tabular-nums">
                      {timeStr}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* ── System Info Row ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pb-2">
        <InfoTile icon={Cpu}      label="AI Engine"  value="Gemini 2.5 Flash"  sub="Zero-shot vision · via backend"   />
        <InfoTile icon={Link}     label="Blockchain" value="Ganache Testnet"  sub="Chain ID 1337 · Port 8545"      />
        <InfoTile icon={Database} label="Database"   value="Appwrite"         sub="Documents DB · Collections ×3"  />
      </div>

      {/* ── Report Export Modal ─────────────────────────────────────────────── */}
      {reportOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
          onClick={() => !isGenerating && setReportOpen(false)}
        >
          <div
            className="bg-card border border-border w-full max-w-md mx-4 shadow-sm"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-muted-foreground" strokeWidth={1.5} />
                <span className="text-sm font-semibold">Export System Overview Report</span>
              </div>
              {!isGenerating && (
                <button onClick={() => setReportOpen(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Body */}
            <div className="px-5 py-4 flex flex-col gap-4">
              <p className="text-xs text-muted-foreground">
                Generate a branded PDF report of the system overview including KPI stats, M/M/1 queue metrics, and full scan inspection records.
              </p>

              <div className="flex flex-col gap-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Report Coverage
                </Label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setReportCoverage("all")}
                    className={[
                      "flex-1 h-8 text-xs border font-medium transition-colors flex items-center justify-center gap-1.5",
                      reportCoverage === "all"
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background text-muted-foreground border-border hover:bg-accent hover:text-foreground",
                    ].join(" ")}
                  >
                    <ScrollText className="w-3 h-3" />
                    All Time
                  </button>
                  <button
                    onClick={() => setReportCoverage("custom")}
                    className={[
                      "flex-1 h-8 text-xs border font-medium transition-colors flex items-center justify-center gap-1.5",
                      reportCoverage === "custom"
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background text-muted-foreground border-border hover:bg-accent hover:text-foreground",
                    ].join(" ")}
                  >
                    <CalendarDays className="w-3 h-3" />
                    Custom Range
                  </button>
                </div>
              </div>

              {reportCoverage === "custom" && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="hp-rpt-from" className="text-xs text-muted-foreground">From</Label>
                    <input
                      id="hp-rpt-from"
                      type="date"
                      value={reportFrom}
                      onChange={e => setReportFrom(e.target.value)}
                      max={reportTo || undefined}
                      className="h-8 text-xs border border-border bg-background px-2 w-full focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="hp-rpt-to" className="text-xs text-muted-foreground">To</Label>
                    <input
                      id="hp-rpt-to"
                      type="date"
                      value={reportTo}
                      onChange={e => setReportTo(e.target.value)}
                      min={reportFrom || undefined}
                      className="h-8 text-xs border border-border bg-background px-2 w-full focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                  </div>
                </div>
              )}

              <div className="bg-muted/40 border border-border px-3 py-2 flex items-start gap-2">
                <ShieldCheck className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
                <p className="text-2xs text-muted-foreground leading-relaxed">
                  Includes KPI summary, M/M/1 queue metrics, and a complete scan log table for the selected period. Output format: <strong>PDF (A4)</strong>.
                </p>
              </div>

              {reportError && (
                <p className="text-xs text-destructive flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  {reportError}
                </p>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border bg-muted/20">
              <Button variant="outline" size="sm" onClick={() => setReportOpen(false)} disabled={isGenerating}>
                Cancel
              </Button>
              <Button
                size="sm"
                className="gap-1.5"
                onClick={generateReport}
                disabled={isGenerating || (reportCoverage === "custom" && !reportFrom && !reportTo)}
              >
                {isGenerating
                  ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Generating…</>
                  : <><FileText className="w-3.5 h-3.5" />Generate PDF</>
                }
              </Button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

// ─── Stat Card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, delta, up, icon: Icon, sub }: typeof STATS_FALLBACK[number]) {
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
function QueueMetric({ label, value, status }: { label: string; value: string; status?: "warn" | "danger" }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`text-xs font-semibold tabular-nums ${
        status === "danger" ? "text-destructive" :
        status === "warn"   ? "text-warning"     : ""
      }`}>
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
