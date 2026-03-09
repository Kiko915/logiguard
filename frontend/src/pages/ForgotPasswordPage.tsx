import { useState } from "react"
import { Link } from "react-router-dom"
import { ArrowLeft, ArrowRight, MailCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

// ─── Forgot Password Page ──────────────────────────────────────────────────────
export function ForgotPasswordPage() {
  const [email, setEmail]       = useState("")
  const [loading, setLoading]   = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError]       = useState("")

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")

    if (!email) {
      setError("Please enter your email address.")
      return
    }

    setLoading(true)
    // Simulate API call — replace with real password reset logic
    setTimeout(() => {
      setLoading(false)
      setSubmitted(true)
    }, 1000)
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

        {!submitted ? (
          <>
            {/* Header */}
            <div className="mb-7">
              <h2 className="text-lg font-bold text-foreground tracking-tight">
                Forgot password?
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Enter your email and we'll send you a link to reset your password.
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
                  autoFocus
                />
              </div>

              {error && (
                <p className="text-xs text-destructive border border-destructive/30 bg-destructive/8 px-3 py-2">
                  {error}
                </p>
              )}

              <Button
                type="submit"
                size="lg"
                className="w-full mt-1 gap-2"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-primary-foreground/30 border-t-primary-foreground animate-spin inline-block" />
                    Sending…
                  </>
                ) : (
                  <>
                    Send Reset Link
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </Button>
            </form>
          </>
        ) : (
          /* Success state */
          <div className="flex flex-col items-center text-center gap-3">
            <div className="w-10 h-10 border border-border bg-muted flex items-center justify-center">
              <MailCheck className="w-5 h-5 text-success" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">Check your inbox</h2>
              <p className="text-sm text-muted-foreground mt-1">
                If <span className="font-medium text-foreground">{email}</span> is
                registered, a reset link has been sent.
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              Didn't receive it? Check your spam folder or{" "}
              <button
                onClick={() => { setSubmitted(false); setEmail("") }}
                className="underline underline-offset-2 hover:text-foreground transition-colors"
              >
                try again
              </button>
              .
            </p>
          </div>
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
