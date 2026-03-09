import { useState } from "react"
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { LoginPage } from "@/pages/LoginPage"
import { ForgotPasswordPage } from "@/pages/ForgotPasswordPage"
import { Sidebar } from "@/components/layout/Sidebar"
import { Header } from "@/components/layout/Header"
import { HomePage } from "@/pages/HomePage"

// ─── App ───────────────────────────────────────────────────────────────────────
// Auth state is a local stub — replace with a real auth context/store later
// (e.g. Supabase session, JWT validation, Zustand store).
function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)

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

        {/* ── Catch-all ─────────────────────────────────────────────────────── */}
        <Route
          path="*"
          element={
            <Navigate to={isAuthenticated ? "/dashboard" : "/auth/login"} replace />
          }
        />

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
