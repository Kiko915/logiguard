import { cn } from "@/lib/utils"

// ─── Atomic skeleton block ─────────────────────────────────────────────────────
function Sk({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} />
}

// ─── Dashboard Skeleton ────────────────────────────────────────────────────────
export function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-4 max-w-[1400px]">

      {/* ── Page Heading ───────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1.5">
          <Sk className="h-4 w-40" />
          <Sk className="h-3 w-64" />
        </div>
        <div className="flex items-center gap-2">
          <Sk className="h-7 w-28" />
          <Sk className="h-7 w-24" />
        </div>
      </div>

      {/* ── KPI Stats ──────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>

      {/* ── Charts Row ─────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-3">
        <ThroughputChartSkeleton />
        <DonutChartSkeleton />
      </div>

      {/* ── M/M/1 Queue Row ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-3">
        <QueueBarChartSkeleton />
        <QueueKeyValuesSkeleton />
      </div>

      {/* ── Recent Scan Activity ───────────────────────────────────────────────── */}
      <ScanTableSkeleton />

      {/* ── System Info Tiles ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pb-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <InfoTileSkeleton key={i} />
        ))}
      </div>
    </div>
  )
}

// ─── Stat Card ─────────────────────────────────────────────────────────────────
function StatCardSkeleton() {
  return (
    <div className="stat-card">
      <div className="flex items-start justify-between gap-2">
        <Sk className="h-2.5 w-24" />
        <Sk className="h-3.5 w-3.5 shrink-0" />
      </div>
      <Sk className="h-7 w-20 mt-1" />
      <div className="flex items-center gap-1.5 mt-0.5">
        <Sk className="h-2.5 w-12" />
        <Sk className="h-2.5 w-20" />
      </div>
    </div>
  )
}

// ─── Throughput Area Chart ─────────────────────────────────────────────────────
function ThroughputChartSkeleton() {
  return (
    <div className="bg-card border border-border">
      <CardHeaderSkeleton titleWidth="w-36" descWidth="w-56" />
      <div className="p-4">
        <div className="flex gap-4 items-stretch">

          {/* Chart area */}
          <div className="flex-1 min-w-0 flex flex-col gap-2">
            {/* Chart body with faint horizontal grid lines */}
            <div className="relative h-[180px] skeleton overflow-hidden">
              {/* Grid line suggestions */}
              {[20, 40, 60, 80].map((pct) => (
                <div
                  key={pct}
                  className="absolute left-0 right-0 h-px bg-card/40"
                  style={{ top: `${pct}%` }}
                />
              ))}
              {/* Fake area wave shape using clip-path */}
              <div
                className="absolute inset-x-0 bottom-0 bg-card/20"
                style={{
                  height: "55%",
                  clipPath: "polygon(0% 60%, 8% 40%, 20% 45%, 33% 25%, 46% 30%, 58% 15%, 72% 20%, 85% 10%, 100% 18%, 100% 100%, 0% 100%)",
                }}
              />
            </div>
            {/* X-axis ticks */}
            <div className="flex justify-between px-1">
              {Array.from({ length: 8 }).map((_, i) => (
                <Sk key={i} className="h-2 w-8" />
              ))}
            </div>
          </div>

          {/* Right legend */}
          <div className="flex flex-col justify-center gap-3.5 shrink-0 border-l border-border pl-4 pr-1 py-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex flex-col gap-1">
                <div className="flex items-center gap-1.5">
                  <Sk className="w-2 h-2 shrink-0" />
                  <Sk className="h-2.5 w-12" />
                </div>
                <Sk className="h-4 w-10 ml-[14px]" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Status Distribution Donut ─────────────────────────────────────────────────
function DonutChartSkeleton() {
  return (
    <div className="bg-card border border-border">
      <CardHeaderSkeleton titleWidth="w-36" descWidth="w-32" />
      <div className="p-4 flex flex-col gap-3">

        {/* Donut circle */}
        <div className="flex items-center justify-center h-[136px]">
          <div className="relative w-32 h-32">
            {/* Outer ring */}
            <div className="skeleton absolute inset-0" style={{ borderRadius: "50%" }} />
            {/* Inner cutout (card bg) */}
            <div
              className="absolute bg-card"
              style={{
                borderRadius: "50%",
                top: "22%", left: "22%", right: "22%", bottom: "22%",
              }}
            />
          </div>
        </div>

        {/* Legend rows */}
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Sk className="w-2 h-2 shrink-0" />
              <Sk className="h-2.5 w-14" />
            </div>
            <div className="flex items-center gap-2">
              <Sk className="h-2.5 w-10" />
              <Sk className="h-2.5 w-8" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Queue Bar Chart ───────────────────────────────────────────────────────────
function QueueBarChartSkeleton() {
  // Mimic the 4 bars at different heights
  const barHeights = ["55%", "80%", "30%", "20%"]

  return (
    <div className="bg-card border border-border">
      <CardHeaderSkeleton titleWidth="w-44" descWidth="w-64" extra={<Sk className="h-4 w-12 mt-1" />} />
      <div className="p-4 pr-4">
        <div className="relative h-[120px] flex items-end gap-8 px-4">
          {/* Horizontal grid lines */}
          {[25, 50, 75].map((pct) => (
            <div
              key={pct}
              className="absolute left-0 right-0 h-px bg-border"
              style={{ bottom: `${pct}%` }}
            />
          ))}
          {/* Bars */}
          {barHeights.map((h, i) => (
            <div key={i} className="flex-1 flex flex-col items-center justify-end gap-1.5">
              <Sk className="w-full" style={{ height: h }} />
              <Sk className="h-2 w-10" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Queue Key Values ──────────────────────────────────────────────────────────
function QueueKeyValuesSkeleton() {
  return (
    <div className="bg-card border border-border">
      <CardHeaderSkeleton titleWidth="w-32" descWidth="w-40" />
      <div className="p-4 flex flex-col gap-2">
        {/* Top metric */}
        <div className="flex items-center justify-between">
          <Sk className="h-2.5 w-28" />
          <Sk className="h-2.5 w-8" />
        </div>

        <div className="h-px bg-border" />

        {/* 3 metrics */}
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between">
            <Sk className="h-2.5 w-36" />
            <Sk className="h-2.5 w-10" />
          </div>
        ))}

        <div className="h-px bg-border" />

        {/* Utilization bar */}
        <div className="flex flex-col gap-1.5 mt-0.5">
          <div className="flex justify-between">
            <Sk className="h-2 w-20" />
            <Sk className="h-2 w-6" />
          </div>
          <div className="w-full h-1 bg-muted">
            <Sk className="h-full w-[71%]" />
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Scan Activity Table ───────────────────────────────────────────────────────
function ScanTableSkeleton() {
  // Column widths to suggest real content
  const cols = [
    ["w-24"],           // Package ID
    ["w-14"],           // Status badge
    ["w-10", "ml-auto"], // Confidence (right)
    ["w-10", "ml-auto"], // Scan Time (right)
    ["w-28"],           // TX hash
    ["w-14", "ml-auto"], // Time (right)
  ]

  return (
    <div className="bg-card border border-border">

      {/* Card header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-muted/30">
        <div className="flex flex-col gap-1.5">
          <Sk className="h-3.5 w-40" />
          <Sk className="h-2.5 w-52" />
        </div>
        <div className="flex items-center gap-2">
          <Sk className="h-4 w-10" />
          <Sk className="h-5 w-16" />
        </div>
      </div>

      {/* Table header row */}
      <div className="grid grid-cols-6 gap-3 px-4 py-2.5 border-b border-border bg-muted/20">
        {["w-20", "w-12", "w-16 ml-auto", "w-16 ml-auto", "w-24", "w-10 ml-auto"].map((w, i) => (
          <Sk key={i} className={cn("h-2.5", w)} />
        ))}
      </div>

      {/* Table rows */}
      {Array.from({ length: 8 }).map((_, row) => (
        <div
          key={row}
          className="grid grid-cols-6 gap-3 px-4 py-3 border-b border-border last:border-b-0 items-center"
        >
          {cols.map((classes, col) => (
            <Sk key={col} className={cn("h-2.5", ...classes)} />
          ))}
        </div>
      ))}
    </div>
  )
}

// ─── Info Tile ─────────────────────────────────────────────────────────────────
function InfoTileSkeleton() {
  return (
    <div className="flex items-start gap-3 border border-border p-3 bg-card">
      <Sk className="w-7 h-7 shrink-0" />
      <div className="flex flex-col gap-1.5 min-w-0 flex-1">
        <Sk className="h-2 w-16" />
        <Sk className="h-3.5 w-28" />
        <Sk className="h-2 w-36" />
      </div>
    </div>
  )
}

// ─── Shared Card Header Skeleton ───────────────────────────────────────────────
function CardHeaderSkeleton({
  titleWidth,
  descWidth,
  extra,
}: {
  titleWidth: string
  descWidth:  string
  extra?:     React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-muted/30">
      <div className="flex flex-col gap-1.5">
        <Sk className={cn("h-3.5", titleWidth)} />
        <Sk className={cn("h-2.5", descWidth)} />
        {extra}
      </div>
    </div>
  )
}
