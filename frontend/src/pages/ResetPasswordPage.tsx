import { useState } from "react"
import { useSearchParams, Link } from "react-router-dom"
import { Eye, EyeOff, ArrowLeft, CheckCircle, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { account } from "@/lib/appwrite"

// ─── Reset Password Page ───────────────────────────────────────────────────────
// Appwrite sends the recovery email with a link containing ?userId=...&secret=...
// This page reads those params and calls account.updateRecovery() to set
// the new password.
export function ResetPasswordPage() {
  const [params] = useSearchParams()
  const userId   = params.get("userId") ?? ""
  const secret   = params.get("secret") ?? ""

  const [password,    setPassword]    = useState("")
  const [confirm,     setConfirm]     = useState("")
  const [showPwd,     setShowPwd]     = useState(false)
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState("")
  const [success,     setSuccess]     = useState(false)

  // Guard: missing link params
  const invalidLink = !userId || !secret

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")

    if (password.length < 8) {
      setError("Password must be at least 8 characters.")
      return
    }
    if (password !== confirm) {
      setError("Passwords do not match.")
      return
    }

    setLoading(true)
    try {
      await account.updateRecovery({ userId, secret, password })
      setSuccess(true)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Reset failed."
      // Appwrite error message can leak internals; show a safe user-facing message.
      setError(
        msg.toLowerCase().includes("invalid") || msg.toLowerCase().includes("expired")
          ? "This reset link is invalid or has expired. Please request a new one."
          : msg,
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-muted">
      <div className="w-full max-w-sm bg-[#FFFFFF] border border-border p-8">

        {/* Wordmark */}
        <div className="flex justify-center mb-8">
          <img
            src="/branding/logiguard_wordmark.png"
            alt="LogiGuard"
            className="h-6 w-auto object-contain"
          />
        </div>

        {/* ── Success state ──────────────────────────────────────────────────── */}
        {success ? (
          <div className="flex flex-col items-center text-center gap-3">
            <div className="w-10 h-10 border border-border bg-muted flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-success" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">Password updated</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Your password has been reset successfully.
              </p>
            </div>
            <Link
              to="/auth/login"
              className="mt-2 text-xs font-medium text-foreground underline underline-offset-2 hover:opacity-70 transition-opacity"
            >
              Sign in with new password →
            </Link>
          </div>

        ) : invalidLink ? (
          /* ── Invalid / missing params ─────────────────────────────────────── */
          <div className="flex flex-col items-center text-center gap-3">
            <div className="w-10 h-10 border border-destructive/40 bg-destructive/8 flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-destructive" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">Invalid reset link</h2>
              <p className="text-sm text-muted-foreground mt-1">
                This link is missing required parameters. Please request a new
                password reset.
              </p>
            </div>
          </div>

        ) : (
          /* ── Reset form ──────────────────────────────────────────────────── */
          <>
            <div className="mb-7">
              <h2 className="text-lg font-bold text-foreground tracking-tight">
                Set new password
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Choose a strong password for your account.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">

              {/* New password */}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="password">
                  New Password <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPwd ? "text" : "password"}
                    placeholder="Min. 8 characters"
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                    className="pr-9"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd((v) => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    tabIndex={-1}
                  >
                    {showPwd
                      ? <EyeOff className="w-3.5 h-3.5" />
                      : <Eye    className="w-3.5 h-3.5" />
                    }
                  </button>
                </div>
              </div>

              {/* Confirm password */}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="confirm">
                  Confirm Password <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="confirm"
                  type={showPwd ? "text" : "password"}
                  placeholder="Repeat password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  disabled={loading}
                />
              </div>

              {/* Strength hint */}
              <p className="text-xs text-muted-foreground -mt-1">
                Use at least 8 characters with a mix of letters and numbers.
              </p>

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
                className="w-full mt-1"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-primary-foreground/30 border-t-primary-foreground animate-spin inline-block mr-2" />
                    Updating…
                  </>
                ) : (
                  "Reset Password"
                )}
              </Button>
            </form>
          </>
        )}

        {/* Back to login */}
        <div className="mt-8 pt-6 border-t border-border">
          <Link
            to="/auth/login"
            className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-3 h-3" />
            Back to Login
          </Link>
        </div>
      </div>
    </div>
  )
}
