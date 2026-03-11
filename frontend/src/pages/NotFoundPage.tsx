import { useNavigate, Link } from "react-router-dom"
import { ArrowLeft, LayoutDashboard } from "lucide-react"
import { Button } from "@/components/ui/button"

// ─── 404 Not Found Page ────────────────────────────────────────────────────────
export function NotFoundPage() {
  const navigate = useNavigate()

  return (
    <div className="flex flex-col h-screen w-screen bg-background">

      {/* ── Top bar ───────────────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between h-12 px-8 border-b border-border shrink-0">
        <Link to="/">
          <img
            src="/branding/logiguard_wordmark.png"
            alt="LogiGuard"
            className="h-5 w-auto object-contain dark:invert"
          />
        </Link>
        <span className="text-xs font-mono text-muted-foreground">
          404
        </span>
      </header>

      {/* ── Body ──────────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col items-center justify-center px-6">

        {/* Large 404 */}
        <p
          className="font-bold text-foreground leading-none select-none"
          style={{ fontSize: "clamp(6rem, 18vw, 14rem)", letterSpacing: "-0.04em" }}
        >
          404
        </p>

        {/* Divider */}
        <div className="w-12 h-px bg-foreground mt-6 mb-6" />

        {/* Message */}
        <h1 className="text-lg font-semibold text-foreground tracking-tight text-center">
          Page Not Found
        </h1>
        <p className="text-sm text-muted-foreground mt-2 text-center max-w-sm leading-relaxed">
          The route you requested doesn't exist or has been moved.
          Use the options below to get back on track.
        </p>

        {/* Actions */}
        <div className="flex items-center gap-3 mt-8">
          <Button variant="outline" size="md" onClick={() => navigate(-1)} className="gap-2">
            <ArrowLeft className="w-3.5 h-3.5" />
            Go Back
          </Button>
          <Button size="md" asChild className="gap-2">
            <Link to="/dashboard">
              <LayoutDashboard className="w-3.5 h-3.5" />
              Dashboard
            </Link>
          </Button>
        </div>
      </div>

      {/* ── Footer ────────────────────────────────────────────────────────────── */}
      <footer className="flex items-center justify-center h-12 border-t border-border shrink-0">
        <p className="text-xs text-muted-foreground">
          LogiGuard · LSPU CSEL 303 · 2026
        </p>
      </footer>
    </div>
  )
}
