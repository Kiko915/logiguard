import { useState, useMemo, Fragment } from "react"
import {
  ScrollText,
  Package,
  PackageX,
  PackageOpen,
  Search,
  SearchX,
  Download,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  SlidersHorizontal,
  X,
  Copy,
  Flag,
  CheckCircle2,
  Clock,
  Cpu,
  AlertCircle,
  ShieldCheck,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Separator } from "@/components/ui/separator"

// ─── Types ─────────────────────────────────────────────────────────────────────

type PackageStatus = "good" | "damaged" | "empty"

interface ScanLog {
  id:          string
  package_id:  string
  status:      PackageStatus
  confidence:  number
  scan_ms:     number
  tx_hash:     string | null
  scanned_at:  string
}

// ─── Mock Data ─────────────────────────────────────────────────────────────────

const RAW_LOGS: ScanLog[] = [
  { id: "lg-001", package_id: "PKG-a3f2c1d4-8e91", status: "good",    confidence: 97.8, scan_ms: 2340, tx_hash: "0x4a2be3f1c9d07e82a5b3f0c1d4e8f2a1b6c3d9e0f147a25b", scanned_at: "2026-04-21T14:32:15Z" },
  { id: "lg-002", package_id: "PKG-b1c4e8f2-3a04", status: "damaged", confidence: 89.1, scan_ms: 3120, tx_hash: "0x8f3dc2b1a0e4f7c9d6b2e5a8f1c3d0e9b4a7c2f5d8e1b6a3", scanned_at: "2026-04-21T14:31:58Z" },
  { id: "lg-003", package_id: "PKG-c9d7a3b1-2f5e", status: "good",    confidence: 99.2, scan_ms: 2180, tx_hash: "0x1e7ca8b3f0d5e2c9b6a4f1d8c3e0b7a5f2c9d4e1b8a6f3c0", scanned_at: "2026-04-21T14:31:42Z" },
  { id: "lg-004", package_id: "PKG-d5f1b9c3-7e2a", status: "empty",   confidence: 95.6, scan_ms: 1960, tx_hash: null,                                                             scanned_at: "2026-04-21T14:31:30Z" },
  { id: "lg-005", package_id: "PKG-e2a8d6f4-1b3c", status: "good",    confidence: 98.4, scan_ms: 2510, tx_hash: "0x7b5af2c1d8e3b0a6f4c9d2e5b1a8f6c3d0e7b4a2f9c5d1e8", scanned_at: "2026-04-21T14:31:17Z" },
  { id: "lg-006", package_id: "PKG-f7c3e1a9-4d0b", status: "damaged", confidence: 82.3, scan_ms: 3840, tx_hash: "0x2c9ef0a4b7d1c3e8f5b2a9d6c1e4b8a3f0c7d5e2b9a6f4c1", scanned_at: "2026-04-21T14:30:55Z" },
  { id: "lg-007", package_id: "PKG-g4b2f8d5-9a1e", status: "good",    confidence: 96.7, scan_ms: 2290, tx_hash: "0x6d4fb1a8c2e5f3d0b7a4c9e1b6f3a0d8c5e2b9f4a1d7c3e0", scanned_at: "2026-04-21T14:30:41Z" },
  { id: "lg-008", package_id: "PKG-h8e5c2a6-3f7d", status: "good",    confidence: 99.0, scan_ms: 2070, tx_hash: "0x3a8ce5b2f7d1a4c9e0b6f3a8d5c2e9b4f1a7c0d3e6b9f2a5", scanned_at: "2026-04-21T14:30:28Z" },
  { id: "lg-009", package_id: "PKG-i2f9a4b7-6c1d", status: "good",    confidence: 94.3, scan_ms: 2650, tx_hash: "0x9b2fc4e7a1d3c0f5b8e2a6d9c3f0b4e7a2d5c8f1b6e3a0d7", scanned_at: "2026-04-21T14:30:10Z" },
  { id: "lg-010", package_id: "PKG-j6c3d8e1-5b2f", status: "empty",   confidence: 91.8, scan_ms: 1820, tx_hash: null,                                                             scanned_at: "2026-04-21T14:29:55Z" },
  { id: "lg-011", package_id: "PKG-k1a7f4c9-2e8b", status: "damaged", confidence: 78.6, scan_ms: 4210, tx_hash: "0x5e1bd7f2c4a9e3b0d6f8a2c5e9b3f0a7d4c1e8b5a2f9c6d3", scanned_at: "2026-04-21T14:29:38Z" },
  { id: "lg-012", package_id: "PKG-l5d2b8f3-1a9c", status: "good",    confidence: 97.1, scan_ms: 2400, tx_hash: "0xd3a6e9b2f5c8a1d4e7b0f3c6a9e2b5d8f1c4a7e0b3d6f9c2", scanned_at: "2026-04-21T14:29:20Z" },
  { id: "lg-013", package_id: "PKG-m3e8c5a1-7f4b", status: "good",    confidence: 98.9, scan_ms: 2200, tx_hash: "0xa8c1f4d7b2e5a0c3f6b9d2e5a8c1f4b7d0e3a6c9f2b5e8a1", scanned_at: "2026-04-21T14:29:02Z" },
  { id: "lg-014", package_id: "PKG-n7b4a9f2-0d6e", status: "good",    confidence: 95.5, scan_ms: 2480, tx_hash: "0xf0b3d6e9a2c5f8b1d4e7a0c3f6b9d2e5a8c1f4b7d0e3a6c9", scanned_at: "2026-04-21T14:28:45Z" },
  { id: "lg-015", package_id: "PKG-o2c6f1d4-8a3e", status: "damaged", confidence: 85.7, scan_ms: 3560, tx_hash: "0xc5e8b1d4f7a0c3e6b9f2a5d8c1e4b7a0d3f6c9e2b5a8d1f4", scanned_at: "2026-04-21T14:28:28Z" },
  { id: "lg-016", package_id: "PKG-p9a3e7b1-5c2d", status: "good",    confidence: 99.5, scan_ms: 1940, tx_hash: "0x2b5e8a1d4f7c0e3b6a9d2f5c8e1b4a7d0f3c6e9b2a5d8f1", scanned_at: "2026-04-21T14:28:11Z" },
  { id: "lg-017", package_id: "PKG-q4f8c2e6-3b0a", status: "empty",   confidence: 93.2, scan_ms: 1750, tx_hash: null,                                                             scanned_at: "2026-04-21T14:27:54Z" },
  { id: "lg-018", package_id: "PKG-r8b1f5a3-9d7c", status: "good",    confidence: 96.4, scan_ms: 2320, tx_hash: "0x7e0b3d6f9c2a5e8b1d4f7c0e3b6a9d2f5c8e1b4a7d0f3c6", scanned_at: "2026-04-21T14:27:37Z" },
  { id: "lg-019", package_id: "PKG-s6d4b9f1-2e5c", status: "damaged", confidence: 88.9, scan_ms: 3290, tx_hash: "0x4a7d0f3c6e9b2a5d8f1c4a7e0b3d6f9c2a5e8b1d4f7c0e3", scanned_at: "2026-04-21T14:27:20Z" },
  { id: "lg-020", package_id: "PKG-t1e7c3a8-6f0b", status: "good",    confidence: 97.3, scan_ms: 2410, tx_hash: "0xb6a9d2f5c8e1b4a7d0f3c6e9b2a5d8f1c4a7e0b3d6f9c2a5", scanned_at: "2026-04-21T14:27:03Z" },
]

const ROWS_PER_PAGE = 10

// ─── Helpers ───────────────────────────────────────────────────────────────────

function formatTs(iso: string): { date: string; time: string } {
  const d = new Date(iso)
  return {
    date: d.toLocaleDateString("en-PH", { month: "short", day: "2-digit", year: "numeric" }),
    time: d.toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }),
  }
}

function shortHash(hash: string): string {
  return hash.slice(0, 6) + "…" + hash.slice(-4)
}

function shortId(id: string): string {
  return id.slice(0, 16) + "…"
}

// ─── Derived contextual details (deterministic from log ID) ────────────────────

interface DerivedDetails {
  station:            string
  operator:           string
  model_version:      string
  queue_wait_ms:      number
  weight_kg:          number
  inspection_depth:   string
  defect_type:        string
  severity:           string
  recommended_action: string
  alert_sent:         boolean
}

function deriveDetails(log: ScanLog): DerivedDetails {
  const n   = parseInt(log.id.replace(/\D/g, ""), 10) || 1
  const nth = <T,>(arr: T[]): T => arr[n % arr.length]

  const action: Record<PackageStatus, string> = {
    good:    nth(["Cleared — Continue Belt", "Cleared — Express Lane", "Cleared — Standard Sort"]),
    damaged: nth(["Quarantine — QC Hold", "Re-route to QC Bay", "Notify Sender", "Escalate to Supervisor"]),
    empty:   nth(["Return to Sender", "Hold for Investigation", "Flag for Audit"]),
  }

  return {
    station:            nth(["Station A-01", "Station A-02", "Station B-01", "Station B-02", "Station C-01"]),
    operator:           nth(["OP-031", "OP-047", "OP-012", "OP-088", "OP-055"]),
    model_version:      nth(["LogiGuard-AI v2.3.1", "LogiGuard-AI v2.3.0", "LogiGuard-AI v2.2.8"]),
    queue_wait_ms:      200 + (n * 137) % 1800,
    weight_kg:          log.status === "empty" ? 0.12 + (n % 8) * 0.02 : 0.30 + (n * 17 % 100) / 100,
    inspection_depth:   nth(["Surface Scan", "Full Inspection", "Deep Scan + X-Ray"]),
    defect_type:        nth(["Crush Damage", "Puncture", "Moisture Damage", "Torn Sealing"]),
    severity:           nth(["Minor", "Moderate", "Severe"]),
    recommended_action: action[log.status],
    alert_sent:         log.status === "damaged" && n % 3 !== 0,
  }
}

// ─── Scan Logs Page ────────────────────────────────────────────────────────────

export function ScanLogsPage() {
  const [search,      setSearch]     = useState("")
  const [statusFilter, setStatus]   = useState<PackageStatus | "all">("all")
  const [page,        setPage]       = useState(1)
  const [expandedRow, setExpanded]   = useState<string | null>(null)

  // ── Derived data ──────────────────────────────────────────────────────────

  const counts = useMemo(() => ({
    total:   RAW_LOGS.length,
    good:    RAW_LOGS.filter(l => l.status === "good").length,
    damaged: RAW_LOGS.filter(l => l.status === "damaged").length,
    empty:   RAW_LOGS.filter(l => l.status === "empty").length,
  }), [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return RAW_LOGS.filter(log => {
      const matchStatus = statusFilter === "all" || log.status === statusFilter
      const matchSearch = !q ||
        log.package_id.toLowerCase().includes(q) ||
        log.id.toLowerCase().includes(q) ||
        (log.tx_hash?.toLowerCase().includes(q) ?? false)
      return matchStatus && matchSearch
    })
  }, [search, statusFilter])

  const totalPages = Math.max(1, Math.ceil(filtered.length / ROWS_PER_PAGE))
  const safePage   = Math.min(page, totalPages)

  const pageRows = useMemo(
    () => filtered.slice((safePage - 1) * ROWS_PER_PAGE, safePage * ROWS_PER_PAGE),
    [filtered, safePage],
  )

  // Reset to page 1 when filters change
  function handleSearch(v: string)   { setSearch(v);       setPage(1) }
  function handleStatus(v: PackageStatus | "all") { setStatus(v); setPage(1) }

  const hasFilters = search !== "" || statusFilter !== "all"

  return (
    <div className="flex flex-col gap-4 max-w-[1400px]">

      {/* ── Page Heading ───────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-base font-semibold text-foreground tracking-tight flex items-center gap-2">
            <ScrollText className="w-4 h-4 text-muted-foreground" strokeWidth={1.5} />
            Scan Logs
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Complete audit trail — every package inspection recorded &amp; blockchain-verified
          </p>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Download className="w-3.5 h-3.5" />
          Export CSV
        </Button>
      </div>

      {/* ── KPI Summary ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          label="Total Records"
          value={counts.total.toLocaleString()}
          icon={ScrollText}
          sub="all time"
        />
        <KpiCard
          label="Good"
          value={counts.good.toLocaleString()}
          icon={Package}
          sub={`${((counts.good / counts.total) * 100).toFixed(1)}% pass rate`}
          color="success"
        />
        <KpiCard
          label="Damaged"
          value={counts.damaged.toLocaleString()}
          icon={PackageX}
          sub={`${((counts.damaged / counts.total) * 100).toFixed(1)}% defect rate`}
          color="destructive"
        />
        <KpiCard
          label="Empty"
          value={counts.empty.toLocaleString()}
          icon={PackageOpen}
          sub={`${((counts.empty / counts.total) * 100).toFixed(1)}% empty rate`}
          color="muted"
        />
      </div>

      {/* ── Filters ────────────────────────────────────────────────────────── */}
      <Card>
        <CardContent className="p-3">
          <div className="flex items-center gap-2 flex-wrap">

            {/* Search */}
            <div className="relative flex-1 min-w-[200px] max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Search package ID or TX hash…"
                value={search}
                onChange={e => handleSearch(e.target.value)}
                className="pl-8 h-8 text-sm"
              />
            </div>

            <Separator orientation="vertical" className="h-6" />

            {/* Status filter tabs */}
            <div className="flex items-center gap-1">
              <SlidersHorizontal className="w-3.5 h-3.5 text-muted-foreground mr-1" />
              <FilterButton
                active={statusFilter === "all"}
                onClick={() => handleStatus("all")}
                icon={ScrollText}
                label="All"
                count={counts.total}
                activeClass="bg-primary text-primary-foreground border-primary"
                inactiveClass="text-muted-foreground border-border hover:bg-accent hover:text-foreground"
              />
              <FilterButton
                active={statusFilter === "good"}
                onClick={() => handleStatus("good")}
                icon={Package}
                label="Good"
                count={counts.good}
                activeClass="bg-success/15 text-success border-success/40"
                inactiveClass="text-muted-foreground border-border hover:bg-success/10 hover:text-success hover:border-success/30"
              />
              <FilterButton
                active={statusFilter === "damaged"}
                onClick={() => handleStatus("damaged")}
                icon={PackageX}
                label="Damaged"
                count={counts.damaged}
                activeClass="bg-destructive/15 text-destructive border-destructive/40"
                inactiveClass="text-muted-foreground border-border hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30"
              />
              <FilterButton
                active={statusFilter === "empty"}
                onClick={() => handleStatus("empty")}
                icon={PackageOpen}
                label="Empty"
                count={counts.empty}
                activeClass="bg-muted text-muted-foreground border-border"
                inactiveClass="text-muted-foreground border-border hover:bg-muted hover:text-foreground"
              />
            </div>

            {/* Clear filters */}
            {hasFilters && (
              <button
                onClick={() => { handleSearch(""); handleStatus("all") }}
                className="flex items-center gap-1 h-7 px-2 text-xs text-muted-foreground hover:text-foreground border border-border hover:bg-accent transition-colors"
              >
                <X className="w-3 h-3" />
                Clear
              </button>
            )}

            {/* Result count */}
            <span className="ml-auto text-xs text-muted-foreground tabular-nums">
              {filtered.length} record{filtered.length !== 1 ? "s" : ""}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* ── Main Table ─────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between w-full">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ScrollText className="w-3.5 h-3.5" />
                Inspection Records
              </CardTitle>
              <CardDescription>
                Immutable scan history — blockchain-anchored entries are marked with a TX hash
              </CardDescription>
            </div>
            <Badge variant="secondary" className="text-2xs shrink-0">
              <span className="w-1.5 h-1.5 bg-success inline-block mr-1" />
              Blockchain Verified
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">Log ID</TableHead>
                <TableHead>Package ID</TableHead>
                <TableHead className="w-[96px]">Status</TableHead>
                <TableHead className="text-right w-[90px]">Confidence</TableHead>
                <TableHead className="text-right w-[90px]">Scan Time</TableHead>
                <TableHead>Blockchain TX</TableHead>
                <TableHead className="text-right w-[160px]">Timestamp</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {pageRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-12">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <SearchX className="w-8 h-8 opacity-40" strokeWidth={1.5} />
                      <p className="text-sm font-medium">No records found</p>
                      <p className="text-xs opacity-70">No scan logs match the current filters.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                pageRows.map(log => {
                  const { date, time } = formatTs(log.scanned_at)
                  const isExpanded = expandedRow === log.id
                  return (
                    <Fragment key={log.id}>
                      <TableRow
                        onClick={() => setExpanded(isExpanded ? null : log.id)}
                        className="cursor-pointer select-none"
                        data-state={isExpanded ? "selected" : undefined}
                      >

                        {/* Log ID + expand chevron */}
                        <TableCell>
                          <span className="flex items-center gap-1.5">
                            {isExpanded
                              ? <ChevronDown  className="w-3 h-3 text-muted-foreground shrink-0" />
                              : <ChevronRight className="w-3 h-3 text-muted-foreground/50 shrink-0" />
                            }
                            <span className="mono-value text-muted-foreground">{log.id}</span>
                          </span>
                        </TableCell>

                        {/* Package ID */}
                        <TableCell>
                          <span className="mono-value text-foreground">{shortId(log.package_id)}</span>
                        </TableCell>

                        {/* Status badge */}
                        <TableCell>
                          <Badge variant={log.status}>
                            {log.status === "good"    && <Package     className="w-2.5 h-2.5" />}
                            {log.status === "damaged" && <PackageX    className="w-2.5 h-2.5" />}
                            {log.status === "empty"   && <PackageOpen className="w-2.5 h-2.5" />}
                            {log.status}
                          </Badge>
                        </TableCell>

                        {/* Confidence */}
                        <TableCell className="text-right">
                          <span className={
                            log.confidence >= 95 ? "text-success  font-medium tabular-nums" :
                            log.confidence >= 85 ? "text-warning  font-medium tabular-nums" :
                                                   "text-destructive font-medium tabular-nums"
                          }>
                            {log.confidence.toFixed(1)}%
                          </span>
                        </TableCell>

                        {/* Scan time */}
                        <TableCell className="text-right">
                          <span className="text-muted-foreground tabular-nums">
                            {(log.scan_ms / 1000).toFixed(2)}s
                          </span>
                        </TableCell>

                        {/* TX hash */}
                        <TableCell>
                          {log.tx_hash ? (
                            <span className="mono-value flex items-center gap-1 text-muted-foreground">
                              <ExternalLink className="w-2.5 h-2.5 shrink-0 text-success" />
                              {shortHash(log.tx_hash)}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground/60 italic">Not logged</span>
                          )}
                        </TableCell>

                        {/* Timestamp */}
                        <TableCell className="text-right">
                          <span className="mono-value text-muted-foreground block">{time}</span>
                          <span className="text-2xs text-muted-foreground/60 block">{date}</span>
                        </TableCell>

                      </TableRow>

                      {/* ── Expansion Panel ─────────────────────────────────── */}
                      {isExpanded && (
                        <TableRow className="hover:bg-transparent">
                          <TableCell colSpan={7} className="p-0 border-b border-border">
                            <LogDetailPanel log={log} />
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  )
                })
              )}
            </TableBody>
          </Table>
        </CardContent>

        {/* ── Pagination ───────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-border bg-muted/20">
          <span className="text-xs text-muted-foreground tabular-nums">
            {filtered.length === 0
              ? "No records"
              : `${(safePage - 1) * ROWS_PER_PAGE + 1}–${Math.min(safePage * ROWS_PER_PAGE, filtered.length)} of ${filtered.length}`
            }
          </span>

          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="xs"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={safePage <= 1}
              className="gap-1"
            >
              <ChevronLeft className="w-3 h-3" />
              Prev
            </Button>

            {/* Page numbers */}
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(n => n === 1 || n === totalPages || Math.abs(n - safePage) <= 1)
              .reduce<(number | "…")[]>((acc, n, i, arr) => {
                if (i > 0 && (n as number) - (arr[i - 1] as number) > 1) acc.push("…")
                acc.push(n)
                return acc
              }, [])
              .map((item, i) =>
                item === "…" ? (
                  <span key={`ellipsis-${i}`} className="px-1 text-xs text-muted-foreground">…</span>
                ) : (
                  <button
                    key={item}
                    onClick={() => setPage(item as number)}
                    className={[
                      "h-7 min-w-[28px] px-2 text-xs border transition-colors",
                      safePage === item
                        ? "bg-primary text-primary-foreground border-primary font-medium"
                        : "bg-background text-muted-foreground border-border hover:bg-accent hover:text-foreground",
                    ].join(" ")}
                  >
                    {item}
                  </button>
                )
              )
            }

            <Button
              variant="outline"
              size="xs"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={safePage >= totalPages}
              className="gap-1"
            >
              Next
              <ChevronRight className="w-3 h-3" />
            </Button>
          </div>
        </div>
      </Card>

      {/* ── Legend ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-4 pb-2">
        <span className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">Legend</span>
        <LegendItem variant="good"    label="Good — passed inspection" />
        <LegendItem variant="damaged" label="Damaged — defect detected" />
        <LegendItem variant="empty"   label="Empty — no contents detected" />
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <ExternalLink className="w-2.5 h-2.5 text-success" />
          Blockchain-anchored record
        </span>
      </div>

    </div>
  )
}

// ─── Filter Button ─────────────────────────────────────────────────────────────

function FilterButton({
  active, onClick, icon: Icon, label, count, activeClass, inactiveClass,
}: {
  active:       boolean
  onClick:      () => void
  icon:         React.ElementType
  label:        string
  count:        number
  activeClass:  string
  inactiveClass: string
}) {
  return (
    <button
      onClick={onClick}
      className={[
        "flex items-center gap-1.5 h-7 px-2.5 text-xs font-medium border transition-colors",
        active ? activeClass : `bg-background ${inactiveClass}`,
      ].join(" ")}
    >
      <Icon className="w-3 h-3 shrink-0" />
      {label}
      <span className={[
        "text-2xs font-semibold tabular-nums px-1 py-px",
        active ? "bg-white/20" : "bg-muted",
      ].join(" ")}>
        {count}
      </span>
    </button>
  )
}

// ─── KPI Card ──────────────────────────────────────────────────────────────────

function KpiCard({
  label, value, icon: Icon, sub, color,
}: {
  label: string
  value: string
  icon:  React.ElementType
  sub:   string
  color?: "success" | "destructive" | "muted"
}) {
  const valueClass =
    color === "success"     ? "stat-card-value text-success"     :
    color === "destructive" ? "stat-card-value text-destructive" :
    color === "muted"       ? "stat-card-value text-muted-foreground" :
                              "stat-card-value"

  return (
    <div className="stat-card">
      <div className="flex items-start justify-between gap-2">
        <span className="stat-card-label">{label}</span>
        <Icon className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" strokeWidth={1.5} />
      </div>
      <span className={valueClass}>{value}</span>
      <span className="text-2xs text-muted-foreground">{sub}</span>
    </div>
  )
}

// ─── Legend Item ───────────────────────────────────────────────────────────────

function LegendItem({ variant, label }: { variant: PackageStatus; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <Badge variant={variant} className="text-2xs py-0">
        {variant === "good"    && <Package     className="w-2 h-2" />}
        {variant === "damaged" && <PackageX    className="w-2 h-2" />}
        {variant === "empty"   && <PackageOpen className="w-2 h-2" />}
        {variant}
      </Badge>
      <span className="text-2xs text-muted-foreground">{label}</span>
    </div>
  )
}

// ─── Log Detail Panel ──────────────────────────────────────────────────────────

function LogDetailPanel({ log }: { log: ScanLog }) {
  const d = deriveDetails(log)

  // Reconstruct timestamps from scanned_at + durations
  const completedAt = new Date(log.scanned_at)
  const scanStartAt = new Date(completedAt.getTime() - log.scan_ms)
  const queuedAt    = new Date(scanStartAt.getTime() - d.queue_wait_ms)
  const toTime      = (dt: Date) => dt.toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })

  const confidenceColor =
    log.confidence >= 95 ? "bg-success"     :
    log.confidence >= 85 ? "bg-warning"     : "bg-destructive"

  const confidenceText =
    log.confidence >= 95 ? "text-success"     :
    log.confidence >= 85 ? "text-warning"     : "text-destructive"

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text).catch(() => {})
  }

  return (
    <div className="bg-muted/10 border-t border-border">

      {/* ── Three-column detail grid ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-border">

        {/* Col 1 — Identifiers */}
        <div className="p-4 flex flex-col gap-3">
          <p className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Package className="w-3 h-3" />
            Package Identifiers
          </p>

          <div className="flex flex-col gap-0.5">
            <span className="text-2xs text-muted-foreground">Log ID</span>
            <span className="font-mono text-xs text-foreground">{log.id}</span>
          </div>

          <div className="flex flex-col gap-0.5">
            <span className="text-2xs text-muted-foreground">Full Package ID</span>
            <span className="font-mono text-xs text-foreground break-all leading-relaxed">{log.package_id}</span>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-2xs text-muted-foreground">Blockchain TX Hash</span>
            {log.tx_hash ? (
              <>
                <span className="font-mono text-2xs text-muted-foreground break-all leading-relaxed">{log.tx_hash}</span>
                <span className="flex items-center gap-1 text-2xs text-success mt-0.5">
                  <ShieldCheck className="w-2.5 h-2.5 shrink-0" />
                  Anchored &amp; immutable
                </span>
              </>
            ) : (
              <span className="text-xs text-muted-foreground/60 italic">Not logged — no blockchain anchor for this record</span>
            )}
          </div>
        </div>

        {/* Col 2 — AI Inspection */}
        <div className="p-4 flex flex-col gap-3">
          <p className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Cpu className="w-3 h-3" />
            AI Inspection Details
          </p>

          {/* Confidence bar */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <span className="text-2xs text-muted-foreground">Model Confidence</span>
              <span className={`text-xs font-semibold tabular-nums font-mono ${confidenceText}`}>
                {log.confidence.toFixed(1)}%
              </span>
            </div>
            <div className="w-full h-1.5 bg-muted">
              <div className={`h-full ${confidenceColor}`} style={{ width: `${log.confidence}%` }} />
            </div>
            <span className="text-2xs text-muted-foreground">
              {log.confidence >= 95 ? "High confidence — result reliable" :
               log.confidence >= 85 ? "Moderate confidence — manual review suggested" :
                                      "Low confidence — manual verification required"}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
            <div>
              <span className="text-2xs text-muted-foreground block">Scan Duration</span>
              <span className="text-xs font-mono tabular-nums">{(log.scan_ms / 1000).toFixed(3)}s</span>
            </div>
            <div>
              <span className="text-2xs text-muted-foreground block">Queue Wait</span>
              <span className="text-xs font-mono tabular-nums">{(d.queue_wait_ms / 1000).toFixed(2)}s</span>
            </div>
            <div>
              <span className="text-2xs text-muted-foreground block">Scanner Station</span>
              <span className="text-xs font-mono">{d.station}</span>
            </div>
            <div>
              <span className="text-2xs text-muted-foreground block">Operator</span>
              <span className="text-xs font-mono">{d.operator}</span>
            </div>
            <div>
              <span className="text-2xs text-muted-foreground block">AI Model</span>
              <span className="text-xs font-mono">{d.model_version}</span>
            </div>
            <div>
              <span className="text-2xs text-muted-foreground block">Inspection Depth</span>
              <span className="text-xs">{d.inspection_depth}</span>
            </div>
          </div>
        </div>

        {/* Col 3 — Status-specific assessment */}
        <div className="p-4 flex flex-col gap-3">
          {log.status === "damaged" && (
            <>
              <p className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <AlertCircle className="w-3 h-3 text-destructive" />
                Defect Assessment
              </p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                <div>
                  <span className="text-2xs text-muted-foreground block">Defect Type</span>
                  <span className="text-xs font-medium text-destructive">{d.defect_type}</span>
                </div>
                <div>
                  <span className="text-2xs text-muted-foreground block">Severity</span>
                  <span className={`text-xs font-medium ${
                    d.severity === "Severe"   ? "text-destructive" :
                    d.severity === "Moderate" ? "text-warning"     : "text-muted-foreground"
                  }`}>{d.severity}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-2xs text-muted-foreground block">Recommended Action</span>
                  <span className="text-xs font-medium">{d.recommended_action}</span>
                </div>
                <div>
                  <span className="text-2xs text-muted-foreground block">Alert Dispatched</span>
                  <span className={`text-xs font-medium flex items-center gap-1 ${d.alert_sent ? "text-destructive" : "text-muted-foreground"}`}>
                    {d.alert_sent
                      ? <><AlertCircle className="w-2.5 h-2.5" />Supervisor notified</>
                      : "No alert sent"}
                  </span>
                </div>
                <div>
                  <span className="text-2xs text-muted-foreground block">Package Weight</span>
                  <span className="text-xs font-mono tabular-nums">{d.weight_kg.toFixed(2)} kg</span>
                </div>
              </div>
            </>
          )}

          {log.status === "empty" && (
            <>
              <p className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <PackageOpen className="w-3 h-3" />
                Content Analysis
              </p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                <div className="col-span-2">
                  <span className="text-2xs text-muted-foreground block">Detection Method</span>
                  <span className="text-xs">Weight Sensor + AI Vision</span>
                </div>
                <div>
                  <span className="text-2xs text-muted-foreground block">Weight Detected</span>
                  <span className="text-xs font-mono tabular-nums">{d.weight_kg.toFixed(2)} kg</span>
                  <span className="text-2xs text-muted-foreground block mt-0.5">(packaging only)</span>
                </div>
                <div>
                  <span className="text-2xs text-muted-foreground block">Blockchain Anchor</span>
                  <span className="text-xs text-muted-foreground/60 italic">Not anchored</span>
                </div>
                <div className="col-span-2">
                  <span className="text-2xs text-muted-foreground block">Disposition</span>
                  <span className="text-xs font-medium">{d.recommended_action}</span>
                </div>
              </div>
            </>
          )}

          {log.status === "good" && (
            <>
              <p className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <CheckCircle2 className="w-3 h-3 text-success" />
                Clearance Details
              </p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                <div className="col-span-2">
                  <span className="text-2xs text-muted-foreground block">Clearance Result</span>
                  <span className="text-xs font-medium text-success">{d.recommended_action}</span>
                </div>
                <div>
                  <span className="text-2xs text-muted-foreground block">Package Weight</span>
                  <span className="text-xs font-mono tabular-nums">{d.weight_kg.toFixed(2)} kg</span>
                </div>
                <div>
                  <span className="text-2xs text-muted-foreground block">Inspection Depth</span>
                  <span className="text-xs">{d.inspection_depth}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-2xs text-muted-foreground block">Blockchain Verification</span>
                  <span className="text-xs text-success flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" />
                    Anchored — tamper-evident record
                  </span>
                </div>
              </div>
            </>
          )}

          {/* Processing timeline */}
          <div className="mt-auto pt-2 border-t border-border flex flex-col gap-1.5">
            <p className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Processing Timeline
            </p>
            <TimelineStep label="Queued"        time={toTime(queuedAt)}    done />
            <TimelineStep label="Scan started"  time={toTime(scanStartAt)} done />
            <TimelineStep label="Scan complete" time={toTime(completedAt)} done active />
          </div>
        </div>
      </div>

      {/* ── Action footer ──────────────────────────────────────────────────── */}
      <div className="px-4 py-2 border-t border-border bg-muted/20 flex items-center gap-2 flex-wrap">
        <span className="text-2xs text-muted-foreground font-semibold uppercase tracking-wider mr-1">Actions</span>
        <button
          onClick={e => { e.stopPropagation(); copyToClipboard(log.package_id) }}
          className="flex items-center gap-1 h-6 px-2 text-2xs border border-border bg-card hover:bg-accent transition-colors"
        >
          <Copy className="w-2.5 h-2.5" />
          Copy Package ID
        </button>
        {log.tx_hash && (
          <>
            <button
              onClick={e => { e.stopPropagation(); copyToClipboard(log.tx_hash!) }}
              className="flex items-center gap-1 h-6 px-2 text-2xs border border-border bg-card hover:bg-accent transition-colors"
            >
              <Copy className="w-2.5 h-2.5" />
              Copy TX Hash
            </button>
            <button
              onClick={e => e.stopPropagation()}
              className="flex items-center gap-1 h-6 px-2 text-2xs border border-border bg-card hover:bg-accent transition-colors"
            >
              <ExternalLink className="w-2.5 h-2.5" />
              View on Explorer
            </button>
          </>
        )}
        <button
          onClick={e => e.stopPropagation()}
          className="flex items-center gap-1 h-6 px-2 text-2xs border border-border bg-card hover:bg-accent transition-colors text-warning"
        >
          <Flag className="w-2.5 h-2.5" />
          Flag for Review
        </button>
        <button
          onClick={e => e.stopPropagation()}
          className="flex items-center gap-1 h-6 px-2 text-2xs border border-border bg-card hover:bg-accent transition-colors"
        >
          <Download className="w-2.5 h-2.5" />
          Export Record
        </button>
        <span className="ml-auto text-2xs text-muted-foreground/60 font-mono">
          Click row to collapse
        </span>
      </div>

    </div>
  )
}

// ─── Timeline Step ─────────────────────────────────────────────────────────────

function TimelineStep({ label, time, done, active }: {
  label:   string
  time:    string
  done?:   boolean
  active?: boolean
}) {
  return (
    <div className="flex items-center gap-2">
      <span className={`w-1.5 h-1.5 shrink-0 ${active ? "bg-success" : done ? "bg-muted-foreground/50" : "bg-muted"}`} />
      <span className={`text-2xs flex-1 ${active ? "text-foreground font-medium" : "text-muted-foreground"}`}>{label}</span>
      <span className="text-2xs font-mono tabular-nums text-muted-foreground">{time}</span>
    </div>
  )
}
