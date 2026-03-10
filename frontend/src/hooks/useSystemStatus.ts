import { useState, useEffect } from "react"

// ─── Types ─────────────────────────────────────────────────────────────────────

export type ServiceStatus =
  | "connected"
  | "disconnected"
  | "stable"
  | "unstable"
  | "checking"

export interface SystemStatus {
  ganache:  ServiceStatus
  appwrite: ServiceStatus
  queue:    ServiceStatus
}

// ─── Config ────────────────────────────────────────────────────────────────────

const API_BASE      = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "http://localhost:3000"
const POLL_INTERVAL = 30_000  // re-check every 30 seconds
const TIMEOUT_MS    = 5_000   // treat no response within 5 s as down

const CHECKING: SystemStatus = { ganache: "checking", appwrite: "checking", queue: "checking" }
const ALL_DOWN: SystemStatus = { ganache: "disconnected", appwrite: "disconnected", queue: "unstable" }

interface ReadyResponse {
  data: { database: boolean; blockchain: boolean }
}

// ─── Hook ──────────────────────────────────────────────────────────────────────
// Polls GET /health/ready (no auth required) on mount and every 30 s.
// Maps backend checks to the three sidebar status indicators:
//   ganache  → data.blockchain
//   appwrite → data.database
//   queue    → stable when database is reachable (simulation is in-process math)
export function useSystemStatus(): SystemStatus {
  const [status, setStatus] = useState<SystemStatus>(CHECKING)

  useEffect(() => {
    let cancelled = false

    async function check() {
      const controller = new AbortController()
      const timer      = setTimeout(() => controller.abort(), TIMEOUT_MS)

      try {
        const res  = await fetch(`${API_BASE}/health/ready`, { signal: controller.signal })
        const body = await res.json() as ReadyResponse

        if (cancelled) return

        setStatus({
          ganache:  body.data.blockchain ? "connected"    : "disconnected",
          appwrite: body.data.database   ? "connected"    : "disconnected",
          queue:    body.data.database   ? "stable"       : "unstable",
        })
      } catch {
        if (!cancelled) setStatus(ALL_DOWN)
      } finally {
        clearTimeout(timer)
      }
    }

    check()
    const id = setInterval(check, POLL_INTERVAL)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [])

  return status
}
