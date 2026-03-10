import { useState, useEffect } from "react"
import { Link } from "react-router-dom"
import { Eye, EyeOff, ScanLine, Activity, ArrowRight, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { account } from "@/lib/appwrite"

interface LoginPageProps {
  onLogin: () => void
}

// ─── Feature bullets — left panel ─────────────────────────────────────────────
const FEATURES = [
  {
    icon:  ScanLine,
    title: "AI-Powered Inspection",
    desc:  "TensorFlow.js classifies packages as Good, Damaged, or Empty in real-time.",
  },
  {
    icon:  ShieldCheck,
    title: "Immutable Blockchain Logging",
    desc:  "Every scan completion is recorded on a Ganache testnet for tamper-proof audit.",
  },
  {
    icon:  Activity,
    title: "M/M/1 Queue Simulation",
    desc:  "Monte Carlo engine runs 1,000+ shift replications to predict queue overflow.",
  },
]

// ─── Login Page ────────────────────────────────────────────────────────────────
export function LoginPage({ onLogin }: LoginPageProps) {
  const [gifReady, setGifReady]         = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [email, setEmail]               = useState("")
  const [password, setPassword]         = useState("")
  const [remember, setRemember]         = useState(false)
  const [loading, setLoading]           = useState(false)
  const [error, setError]               = useState("")

  // Delay GIF appearance after page mounts
  useEffect(() => {
    const t = setTimeout(() => setGifReady(true), 900)
    return () => clearTimeout(t)
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")

    if (!email || !password) {
      setError("Email and password are required.")
      return
    }

    setLoading(true)
    try {
      await account.createEmailPasswordSession({ email, password })
      onLogin()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Invalid email or password."
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background">

      {/* ── Left Panel — Branding ──────────────────────────────────────────────── */}
      <div className="hidden lg:flex flex-col w-[55%] h-full bg-[#FFFFFF] border-r border-border px-14 py-8 overflow-hidden items-center">

        {/* Headline */}
        <div className="mt-8 text-center">
          <div className="inline-flex items-center gap-1.5 border border-border bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground mb-4">
            <span className="w-1.5 h-1.5 bg-success inline-block" />
            CSEL 303 · Integrated Modeling &amp; Simulation
          </div>
          <h1 className="text-[2rem] font-bold leading-tight tracking-tight text-foreground">
            Intelligent Package<br />
            Inspection, Secured<br />
            by Blockchain.
          </h1>
          <p className="mt-3 text-sm text-muted-foreground leading-relaxed max-w-md">
            LogiGuard combines real-time AI vision with discrete-event simulation to
            detect defects, prevent queue bottlenecks, and create an immutable QA record
            for every package scanned.
          </p>
        </div>

        {/* Feature Bullets */}
        <div className="mt-6 flex flex-row gap-4 w-full max-w-2xl">
          {FEATURES.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="flex flex-col items-center text-center gap-2 flex-1">
              <div className="w-7 h-7 border border-border bg-muted flex items-center justify-center shrink-0">
                <Icon className="w-3.5 h-3.5 text-foreground" strokeWidth={1.75} />
              </div>
              <div>
                <p className="text-xs font-semibold text-foreground">{title}</p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* GIF — fades in after delay, constrained so it never overflows */}
        <div className="flex-1 flex items-center justify-center mt-4 min-h-0 w-full">
          <img
            src="/Checking-boxes.gif"
            alt="Package inspection animation"
            className={cn(
              "max-w-[380px] w-full max-h-full object-contain",
              "transition-opacity duration-700 ease-in",
              gifReady ? "opacity-100" : "opacity-0"
            )}
          />
        </div>
      </div>

      {/* ── Right Panel — Login Form ───────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 h-full items-center justify-center px-6 py-10 bg-muted overflow-y-auto">

        <div className="w-full max-w-sm">

          {/* Wordmark — always visible on right panel */}
          <div className="flex justify-center mb-8">
            <img
              src="/branding/logiguard_wordmark.png"
              alt="LogiGuard"
              className="h-10 w-auto object-contain"
            />
          </div>

          {/* Header */}
          <div className="mb-7">
            <h2 className="text-lg font-bold text-foreground tracking-tight">
              Welcome back
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Sign in to your LogiGuard account to continue.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">

            {/* Email */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">
                Email <span className="text-destructive">*</span>
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />
            </div>

            {/* Password */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">
                Password <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  className="pr-9"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showPassword
                    ? <EyeOff className="w-3.5 h-3.5" />
                    : <Eye     className="w-3.5 h-3.5" />
                  }
                </button>
              </div>
            </div>

            {/* Remember me */}
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="w-3.5 h-3.5 accent-foreground cursor-pointer"
                />
                <span className="text-xs text-foreground">Remember me</span>
              </label>
              <Link
                to="/auth/forgot-password"
                className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
              >
                Forgot password?
              </Link>
            </div>

            {/* Error */}
            {error && (
              <p className="text-xs text-destructive border border-destructive/30 bg-destructive/8 px-3 py-2">
                {error}
              </p>
            )}

            {/* Submit */}
            <Button
              type="submit"
              size="lg"
              className="w-full mt-1 gap-2"
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-primary-foreground/30 border-t-primary-foreground animate-spin inline-block" />
                  Signing in…
                </>
              ) : (
                <>
                  Sign In
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </Button>
          </form>

          {/* Footer */}
          <div className="mt-8 pt-6 border-t border-border">
            <p className="text-center text-xs text-muted-foreground">
              LogiGuard · LSPU CSEL 303 · 2026
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
