import { Bell, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"

interface HeaderProps {
  title: string
  subtitle?: string
}

// ─── Header ────────────────────────────────────────────────────────────────────
export function Header({ title, subtitle }: HeaderProps) {
  const now = new Date()
  const dateStr = now.toLocaleDateString("en-US", {
    weekday: "short",
    year:    "numeric",
    month:   "short",
    day:     "numeric",
  })
  const timeStr = now.toLocaleTimeString("en-US", {
    hour:   "2-digit",
    minute: "2-digit",
  })

  return (
    <header className="flex items-center h-12 px-4 border-b border-border bg-card shrink-0 gap-3">

      {/* ── Page Title ───────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 min-w-0">
        <h1 className="text-sm font-semibold text-foreground tracking-tight truncate">
          {title}
        </h1>
        {subtitle && (
          <>
            <span className="text-muted-foreground">/</span>
            <span className="text-sm text-muted-foreground truncate">{subtitle}</span>
          </>
        )}
      </div>

      {/* ── Right Controls ───────────────────────────────────────────────────── */}
      <div className="ml-auto flex items-center gap-3">

        {/* Date + Time */}
        <span className="hidden sm:block text-xs text-muted-foreground tabular-nums">
          {dateStr} · {timeStr}
        </span>

        <div className="w-px h-5 bg-border" />

        {/* Refresh */}
        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
          <RefreshCw className="w-3.5 h-3.5" />
        </Button>

        {/* Notifications */}
        <Button variant="ghost" size="icon" className="relative text-muted-foreground hover:text-foreground">
          <Bell className="w-3.5 h-3.5" />
          {/* Unread dot */}
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-destructive" />
        </Button>

        <div className="w-px h-5 bg-border" />

        {/* User */}
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-primary flex items-center justify-center">
            <span className="text-2xs font-semibold text-primary-foreground">FM</span>
          </div>
          <span className="hidden md:block text-xs font-medium text-foreground">F. Mistica</span>
        </div>
      </div>
    </header>
  )
}
