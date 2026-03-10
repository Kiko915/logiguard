import { useState } from "react"
import {
  LayoutDashboard,
  ScanLine,
  Activity,
  ScrollText,
  Settings,
  Circle,
  ChevronLeft,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Separator } from "@/components/ui/separator"
import { useSystemStatus, type ServiceStatus } from "@/hooks/useSystemStatus"

// ─── Nav Items ─────────────────────────────────────────────────────────────────
const NAV_ITEMS = [
  { icon: LayoutDashboard, label: "Dashboard",   active: true  },
  { icon: ScanLine,        label: "Live Scanner", active: false },
  { icon: Activity,        label: "Simulation",   active: false },
  { icon: ScrollText,      label: "Scan Logs",    active: false },
] as const

const BOTTOM_ITEMS = [
  { icon: Settings, label: "Settings", active: false },
] as const

// Collapsed sidebar width = 52px.
// Nav has p-2 (8px). Button has px-2.5 (10px). Icon is w-4 (16px).
// Icon center from aside left = 8 + 10 + 8 = 26px = 52 / 2 ✓
// Keep px-2.5 in both states so the icon never moves; only the label slides.

// ─── Sidebar ───────────────────────────────────────────────────────────────────
export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const systemStatus              = useSystemStatus()

  return (
    <aside
      className={cn(
        "flex flex-col h-screen border-r border-border bg-sidebar shrink-0",
        "overflow-hidden transition-[width] duration-[240ms] ease-in-out",
        collapsed ? "w-[52px]" : "w-[220px]",
      )}
    >

      {/* ── Logo ─────────────────────────────────────────────────────────────── */}
      <div className="relative flex items-center justify-center h-12 border-b border-sidebar-border shrink-0">

        {/* Symbol — centered via translate; visible only when collapsed */}
        <img
          src="/branding/logiguard_symbol.png"
          alt="LG"
          className={cn(
            "absolute left-1/2 -translate-x-1/2 h-6 w-6 object-contain",
            "transition-opacity duration-200",
            collapsed ? "opacity-100" : "opacity-0 pointer-events-none",
          )}
        />

        {/* Wordmark + badge — fade out when collapsed */}
        <div
          className={cn(
            "flex items-center justify-between w-full px-3",
            "transition-opacity duration-200",
            collapsed ? "opacity-0 pointer-events-none" : "opacity-100",
          )}
        >
          <img
            src="/branding/logiguard_wordmark.png"
            alt="LogiGuard"
            className="h-5 w-auto object-contain"
          />
          <span className="text-2xs font-medium text-muted-foreground bg-muted px-1.5 py-0.5 border border-border shrink-0">
            v2.0
          </span>
        </div>
      </div>

      {/* ── Primary Navigation ───────────────────────────────────────────────── */}
      <nav className="flex flex-col gap-0.5 p-2 flex-1 overflow-hidden">

        {/* Section label */}
        <SectionLabel collapsed={collapsed}>Menu</SectionLabel>

        {NAV_ITEMS.map(({ icon: Icon, label, active }) => (
          <button
            key={label}
            title={collapsed ? label : undefined}
            className={cn(
              // px-2.5 stays fixed in both states — icon stays perfectly centered at 26px
              "flex items-center w-full px-2.5 py-2 text-sm cursor-pointer transition-colors duration-75",
              active
                ? "bg-primary text-primary-foreground font-medium"
                : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
            )}
          >
            <Icon className="w-4 h-4 shrink-0" strokeWidth={active ? 2.5 : 2} />

            {/* Label slides + fades — marginLeft controlled to avoid gap artifact */}
            <span
              style={{
                maxWidth:   collapsed ? 0   : 160,
                opacity:    collapsed ? 0   : 1,
                marginLeft: collapsed ? 0   : 10,
              }}
              className="overflow-hidden whitespace-nowrap transition-all duration-[240ms] ease-in-out"
            >
              {label}
            </span>

            {/* Live badge */}
            {label === "Live Scanner" && (
              <span
                style={{ maxWidth: collapsed ? 0 : 60, opacity: collapsed ? 0 : 1 }}
                className="ml-auto flex items-center gap-1 text-2xs font-medium text-success overflow-hidden whitespace-nowrap transition-all duration-[240ms] ease-in-out"
              >
                <Circle className="w-1.5 h-1.5 fill-success shrink-0" />
                Live
              </span>
            )}
          </button>
        ))}

        <Separator className="my-2" />

        <SectionLabel collapsed={collapsed}>System</SectionLabel>

        {BOTTOM_ITEMS.map(({ icon: Icon, label, active }) => (
          <button
            key={label}
            title={collapsed ? label : undefined}
            className={cn(
              "flex items-center w-full px-2.5 py-2 text-sm cursor-pointer transition-colors duration-75",
              active
                ? "bg-primary text-primary-foreground font-medium"
                : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
            )}
          >
            <Icon className="w-4 h-4 shrink-0" strokeWidth={2} />
            <span
              style={{
                maxWidth:   collapsed ? 0   : 160,
                opacity:    collapsed ? 0   : 1,
                marginLeft: collapsed ? 0   : 10,
              }}
              className="overflow-hidden whitespace-nowrap transition-all duration-[240ms] ease-in-out"
            >
              {label}
            </span>
          </button>
        ))}

        {/* ── Collapse toggle ─────────────────────────────────────────────────── */}
        <div className="mt-auto pt-2">
          <button
            onClick={() => setCollapsed((v) => !v)}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="flex items-center w-full px-2.5 py-2 text-muted-foreground cursor-pointer
                       hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors duration-75"
          >
            <ChevronLeft
              className={cn(
                "w-4 h-4 shrink-0 transition-transform duration-[240ms] ease-in-out",
                collapsed && "rotate-180",
              )}
            />
            <span
              style={{
                maxWidth:   collapsed ? 0   : 160,
                opacity:    collapsed ? 0   : 1,
                marginLeft: collapsed ? 0   : 10,
              }}
              className="text-sm overflow-hidden whitespace-nowrap transition-all duration-[240ms] ease-in-out"
            >
              Collapse
            </span>
          </button>
        </div>
      </nav>

      {/* ── Footer ───────────────────────────────────────────────────────────── */}
      <div className="p-3 border-t border-sidebar-border space-y-2 shrink-0">
        <StatusRow label="Ganache"  status={systemStatus.ganache}  collapsed={collapsed} />
        <StatusRow label="Appwrite" status={systemStatus.appwrite} collapsed={collapsed} />
        <StatusRow label="Queue"    status={systemStatus.queue}    collapsed={collapsed} />
      </div>
    </aside>
  )
}

// ─── Section Label ─────────────────────────────────────────────────────────────
function SectionLabel({ collapsed, children }: { collapsed: boolean; children: string }) {
  return (
    <p
      style={{ maxHeight: collapsed ? 0 : 32, opacity: collapsed ? 0 : 1 }}
      className="px-2 text-2xs font-semibold text-muted-foreground uppercase tracking-widest
                 overflow-hidden whitespace-nowrap transition-all duration-[240ms] ease-in-out
                 pt-1 pb-1"
    >
      {children}
    </p>
  )
}

// ─── Status Row ────────────────────────────────────────────────────────────────
function StatusRow({
  label,
  status,
  collapsed,
}: {
  label:     string
  status:    ServiceStatus
  collapsed: boolean
}) {
  const isOk      = status === "connected" || status === "stable"
  const isChecking = status === "checking"

  const dotClass = isChecking
    ? "bg-muted-foreground animate-pulse"
    : isOk
      ? "bg-success"
      : "bg-destructive"

  const textClass = isChecking
    ? "text-muted-foreground"
    : isOk
      ? "text-success"
      : "text-destructive"

  const label2 = isChecking ? "Checking…" : status.charAt(0).toUpperCase() + status.slice(1)

  return (
    <div
      className={cn("flex items-center", collapsed ? "justify-center" : "justify-between")}
      title={collapsed ? `${label}: ${label2}` : undefined}
    >
      <span
        style={{ maxWidth: collapsed ? 0 : 120, opacity: collapsed ? 0 : 1 }}
        className="text-xs text-muted-foreground overflow-hidden whitespace-nowrap
                   transition-all duration-[240ms] ease-in-out"
      >
        {label}
      </span>

      <span className={cn("flex items-center gap-1 text-2xs font-medium shrink-0", textClass)}>
        <span className={cn("w-1.5 h-1.5 inline-block shrink-0", dotClass)} />
        <span
          style={{ maxWidth: collapsed ? 0 : 80, opacity: collapsed ? 0 : 1 }}
          className="overflow-hidden whitespace-nowrap transition-all duration-[240ms] ease-in-out"
        >
          {label2}
        </span>
      </span>
    </div>
  )
}
