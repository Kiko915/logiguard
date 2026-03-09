import {
  LayoutDashboard,
  ScanLine,
  Activity,
  ScrollText,
  Settings,
  Circle,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Separator } from "@/components/ui/separator"

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

// ─── Sidebar ───────────────────────────────────────────────────────────────────
export function Sidebar() {
  return (
    <aside className="flex flex-col w-[220px] h-screen border-r border-border bg-sidebar shrink-0">

      {/* ── Logo ─────────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between h-12 px-4 border-b border-sidebar-border">
        <img
          src="/branding/logiguard_wordmark.png"
          alt="LogiGuard"
          className="h-5 w-auto object-contain"
        />
        <span className="text-2xs font-medium text-muted-foreground bg-muted px-1.5 py-0.5 border border-border">
          v2.0
        </span>
      </div>

      {/* ── Primary Navigation ───────────────────────────────────────────────── */}
      <nav className="flex flex-col gap-0.5 p-2 flex-1">
        <p className="px-2 pt-1 pb-1 text-2xs font-semibold text-muted-foreground uppercase tracking-widest">
          Menu
        </p>

        {NAV_ITEMS.map(({ icon: Icon, label, active }) => (
          <button
            key={label}
            className={cn(
              "flex items-center gap-2.5 w-full px-2.5 py-2 text-sm",
              "transition-colors duration-75 cursor-pointer",
              active
                ? "bg-primary text-primary-foreground font-medium"
                : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            )}
          >
            <Icon className="w-4 h-4 shrink-0" strokeWidth={active ? 2.5 : 2} />
            {label}
            {label === "Live Scanner" && (
              <span className="ml-auto flex items-center gap-1 text-2xs font-medium text-success">
                <Circle className="w-1.5 h-1.5 fill-success" />
                Live
              </span>
            )}
          </button>
        ))}

        <Separator className="my-2" />

        <p className="px-2 pb-1 text-2xs font-semibold text-muted-foreground uppercase tracking-widest">
          System
        </p>

        {BOTTOM_ITEMS.map(({ icon: Icon, label, active }) => (
          <button
            key={label}
            className={cn(
              "flex items-center gap-2.5 w-full px-2.5 py-2 text-sm",
              "transition-colors duration-75 cursor-pointer",
              active
                ? "bg-primary text-primary-foreground font-medium"
                : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            )}
          >
            <Icon className="w-4 h-4 shrink-0" strokeWidth={2} />
            {label}
          </button>
        ))}
      </nav>

      {/* ── Footer ───────────────────────────────────────────────────────────── */}
      <div className="p-3 border-t border-sidebar-border space-y-1.5">
        <StatusRow label="Ganache"  status="connected" />
        <StatusRow label="Supabase" status="connected" />
        <StatusRow label="Queue"    status="stable"    />
      </div>
    </aside>
  )
}

// ─── Status Row ────────────────────────────────────────────────────────────────
function StatusRow({
  label,
  status,
}: {
  label: string
  status: "connected" | "disconnected" | "stable" | "unstable"
}) {
  const isOk = status === "connected" || status === "stable"
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span
        className={cn(
          "flex items-center gap-1 text-2xs font-medium",
          isOk ? "text-success" : "text-destructive"
        )}
      >
        <span
          className={cn(
            "w-1.5 h-1.5 inline-block",
            isOk ? "bg-success" : "bg-destructive"
          )}
        />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    </div>
  )
}
