import { useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  Bell,
  Info,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  BellOff,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/contexts/AuthContext"
import { useNotifications, type AppNotification, type NotificationType } from "@/hooks/useNotifications"

// ─── Type config ───────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<NotificationType, {
  icon:      React.ElementType
  iconClass: string
  barClass:  string
}> = {
  info:    { icon: Info,          iconClass: "text-muted-foreground", barClass: "bg-muted-foreground" },
  warning: { icon: AlertTriangle, iconClass: "text-warning",          barClass: "bg-warning"          },
  error:   { icon: AlertCircle,   iconClass: "text-destructive",      barClass: "bg-destructive"      },
  success: { icon: CheckCircle2,  iconClass: "text-success",          barClass: "bg-success"          },
}

// ─── Relative time ─────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins <  1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs  < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

// ─── Notifications Popover ─────────────────────────────────────────────────────

export function NotificationsPopover() {
  const { user }                                                     = useAuth()
  const { notifications, loading, unreadCount, markAsRead, markAllAsRead } = useNotifications(user?.id)
  const navigate                                                     = useNavigate()
  const [open, setOpen]                                              = useState(false)
  const ref                                                          = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handle)
    return () => document.removeEventListener("mousedown", handle)
  }, [open])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    function handle(e: KeyboardEvent) { if (e.key === "Escape") setOpen(false) }
    document.addEventListener("keydown", handle)
    return () => document.removeEventListener("keydown", handle)
  }, [open])

  function handleNotificationClick(n: AppNotification) {
    if (!n.read) markAsRead(n.$id)
    if (n.link) { navigate(n.link); setOpen(false) }
  }

  return (
    <div ref={ref} className="relative">

      {/* ── Bell button ─────────────────────────────────────────────────────── */}
      <Button
        variant="ghost"
        size="icon"
        title="Notifications"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "relative text-muted-foreground hover:text-foreground",
          open && "bg-accent text-foreground",
        )}
      >
        <Bell className="w-3.5 h-3.5" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-destructive" />
        )}
      </Button>

      {/* ── Popover panel ───────────────────────────────────────────────────── */}
      {open && (
        <div className="absolute right-0 top-full mt-1 w-80 bg-card border border-border shadow-lg z-50">

          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-border bg-muted/30">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-foreground">Notifications</span>
              {unreadCount > 0 && (
                <span className="text-2xs font-semibold bg-destructive text-destructive-foreground px-1.5 py-0.5 leading-none">
                  {unreadCount}
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-2xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* Body */}
          <div className="max-h-[360px] overflow-y-auto">
            {loading ? (
              // Skeleton
              <div className="flex flex-col divide-y divide-border">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="px-3 py-3 flex gap-2.5 animate-pulse">
                    <div className="w-3.5 h-3.5 bg-muted shrink-0 mt-0.5" />
                    <div className="flex-1 flex flex-col gap-1.5">
                      <div className="h-2.5 bg-muted w-2/3" />
                      <div className="h-2 bg-muted w-full" />
                    </div>
                  </div>
                ))}
              </div>
            ) : notifications.length === 0 ? (
              // Empty state
              <div className="flex flex-col items-center justify-center gap-2 py-10 px-4 text-center">
                <div className="w-10 h-10 border border-border bg-muted flex items-center justify-center">
                  <BellOff className="w-4 h-4 text-muted-foreground" />
                </div>
                <p className="text-xs font-medium text-foreground">No notifications</p>
                <p className="text-2xs text-muted-foreground">
                  You're all caught up. Alerts about damaged packages and<br />queue events will appear here.
                </p>
              </div>
            ) : (
              // Notification list
              <div className="flex flex-col divide-y divide-border">
                {notifications.map((n) => {
                  const cfg = TYPE_CONFIG[n.type] ?? TYPE_CONFIG.info
                  const Icon = cfg.icon
                  return (
                    <button
                      key={n.$id}
                      onClick={() => handleNotificationClick(n)}
                      className={cn(
                        "w-full text-left px-3 py-3 flex gap-2.5 transition-colors duration-75",
                        "hover:bg-accent cursor-pointer",
                        !n.read && "bg-accent/40",
                      )}
                    >
                      {/* Left type bar */}
                      <div className={cn("w-0.5 shrink-0 self-stretch", cfg.barClass)} />

                      {/* Icon */}
                      <Icon className={cn("w-3.5 h-3.5 shrink-0 mt-0.5", cfg.iconClass)} strokeWidth={2} />

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className={cn(
                            "text-xs leading-snug truncate",
                            n.read ? "font-normal text-foreground" : "font-semibold text-foreground",
                          )}>
                            {n.title}
                          </p>
                          <span className="text-2xs text-muted-foreground tabular-nums shrink-0 mt-0.5">
                            {relativeTime(n.$createdAt)}
                          </span>
                        </div>
                        <p className="text-2xs text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">
                          {n.message}
                        </p>
                      </div>

                      {/* Unread dot */}
                      {!n.read && (
                        <span className="w-1.5 h-1.5 bg-primary shrink-0 mt-1.5" />
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="border-t border-border px-3 py-2 bg-muted/20">
              <p className="text-2xs text-muted-foreground text-center">
                Showing last {notifications.length} notification{notifications.length !== 1 ? "s" : ""}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
