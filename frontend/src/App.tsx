import { useState, useEffect } from "react"
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { LoginPage } from "@/pages/LoginPage"
import { ForgotPasswordPage } from "@/pages/ForgotPasswordPage"
import { NotFoundPage } from "@/pages/NotFoundPage"
import { Sidebar } from "@/components/layout/Sidebar"
import { Header } from "@/components/layout/Header"
import { HomePage } from "@/pages/HomePage"
import { account } from "@/lib/appwrite"

// ─── App ───────────────────────────────────────────────────────────────────────
// Auth state is driven by Appwrite — account.get() resolves if a session exists.
// null = loading, false = unauthenticated, true = authenticated.
function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)

  useEffect(() => {
    account.get()
      .then(() => setIsAuthenticated(true))
      .catch(() => setIsAuthenticated(false))
  }, [])

  // Show blank screen while session is being resolved
  if (isAuthenticated === null) {
    return <div className="fixed inset-0 bg-background" />
  }

  return (
    <BrowserRouter>
      <Routes>

        {/* ── Root redirect ──────────────────────────────────────────────────── */}
        <Route
          path="/"
          element={
            <Navigate to={isAuthenticated ? "/dashboard" : "/auth/login"} replace />
          }
        />

        {/* ── Auth routes ────────────────────────────────────────────────────── */}

        {/* /auth → redirect to login (or dashboard if already authenticated) */}
        <Route
          path="/auth"
          element={
            <Navigate to={isAuthenticated ? "/dashboard" : "/auth/login"} replace />
          }
        />

        {/* /auth/login */}
        <Route
          path="/auth/login"
          element={
            isAuthenticated
              ? <Navigate to="/dashboard" replace />
              : <LoginPage onLogin={() => setIsAuthenticated(true)} />
          }
        />

        {/* /auth/forgot-password */}
        <Route
          path="/auth/forgot-password"
          element={
            isAuthenticated
              ? <Navigate to="/dashboard" replace />
              : <ForgotPasswordPage />
          }
        />

        {/* ── Protected dashboard ────────────────────────────────────────────── */}
        <Route
          path="/dashboard"
          element={
            isAuthenticated
              ? <DashboardLayout />
              : <Navigate to="/auth/login" replace />
          }
        />

        {/* ── 404 catch-all ─────────────────────────────────────────────────── */}
        <Route path="*" element={<NotFoundPage />} />

      </Routes>
    </BrowserRouter>
  )
}

// ─── Dashboard Layout ──────────────────────────────────────────────────────────
function DashboardLayout() {
  return (
    <div className="page-root">
      <Sidebar />
      <div className="page-main">
        <Header title="Dashboard" />
        <main className="page-content">
          <HomePage />
        </main>
      </div>
    </div>
  )
}

export default App
