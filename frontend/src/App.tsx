import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { AuthProvider, useAuth } from "@/contexts/AuthContext"
import { LoginPage } from "@/pages/LoginPage"
import { ForgotPasswordPage } from "@/pages/ForgotPasswordPage"
import { ResetPasswordPage } from "@/pages/ResetPasswordPage"
import { NotFoundPage } from "@/pages/NotFoundPage"
import { ProfilePage } from "@/pages/ProfilePage"
import { Sidebar } from "@/components/layout/Sidebar"
import { Header } from "@/components/layout/Header"
import { HomePage } from "@/pages/HomePage"
import { LoadingBar } from "@/components/ui/LoadingBar"

// ─── Global fetch interceptor ──────────────────────────────────────────────────
// Wraps window.fetch once at module load (not inside React lifecycle) so it
// covers every request — Appwrite SDK, backend API calls, etc.
// Skips health-check URLs that poll silently in the background.
const SKIP_PATTERNS = ["/health", "/health/ready"]
;(function installFetchInterceptor() {
  const _fetch = window.fetch
  window.fetch = async function (...args) {
    const url  = typeof args[0] === "string" ? args[0] : (args[0] as Request).url
    const skip = SKIP_PATTERNS.some((p) => url.includes(p))

    if (!skip) window.dispatchEvent(new Event("loading:start"))
    try {
      return await _fetch(...args)
    } finally {
      if (!skip) window.dispatchEvent(new Event("loading:done"))
    }
  }
})()

// ─── App ───────────────────────────────────────────────────────────────────────

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <LoadingBar />
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  )
}

// ─── Routes ────────────────────────────────────────────────────────────────────

function AppRoutes() {
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return <div className="fixed inset-0 bg-background" />
  }

  return (
    <Routes>

      {/* ── Root redirect ──────────────────────────────────────────────────── */}
      <Route
        path="/"
        element={<Navigate to={user ? "/dashboard" : "/auth/login"} replace />}
      />

      {/* ── Auth routes ────────────────────────────────────────────────────── */}
      <Route
        path="/auth"
        element={<Navigate to={user ? "/dashboard" : "/auth/login"} replace />}
      />
      <Route
        path="/auth/login"
        element={user ? <Navigate to="/dashboard" replace /> : <LoginPage />}
      />
      <Route
        path="/auth/forgot-password"
        element={user ? <Navigate to="/dashboard" replace /> : <ForgotPasswordPage />}
      />
      <Route path="/auth/reset-password" element={<ResetPasswordPage />} />

      {/* ── Protected app routes ───────────────────────────────────────────── */}
      <Route
        path="/dashboard"
        element={user
          ? <AppLayout title="Dashboard"><HomePage /></AppLayout>
          : <Navigate to="/auth/login" replace />
        }
      />
      <Route
        path="/profile"
        element={user
          ? <AppLayout title="Profile"><ProfilePage /></AppLayout>
          : <Navigate to="/auth/login" replace />
        }
      />

      {/* ── 404 catch-all ─────────────────────────────────────────────────── */}
      <Route path="*" element={<NotFoundPage />} />

    </Routes>
  )
}

// ─── Shared App Layout ─────────────────────────────────────────────────────────
// Sidebar + header shell reused across all authenticated pages.

function AppLayout({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="page-root">
      <Sidebar />
      <div className="page-main">
        <Header title={title} />
        <main className="page-content">
          {children}
        </main>
      </div>
    </div>
  )
}

export default App
