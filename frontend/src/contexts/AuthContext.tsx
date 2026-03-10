import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react"
import { account } from "@/lib/appwrite"
import { invalidateJwt } from "@/lib/api"

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface AuthUser {
  id:       string
  email:    string
  name:     string
  role:     "admin" | "operator" | "viewer"
  initials: string
}

interface AuthContextValue {
  user:      AuthUser | null
  isLoading: boolean
  login:     (email: string, password: string, rememberMe: boolean) => Promise<void>
  logout:    () => Promise<void>
}

// ─── Session persistence keys ──────────────────────────────────────────────────
// REMEMBER_KEY  (localStorage)  — written only when "remember me" is checked.
//                                 Survives browser close.
// SESSION_KEY   (sessionStorage) — written on every login.
//                                 Cleared on browser/tab close (not on refresh).
//
// Logic on app init:
//   • sessionStorage flag present                         → refresh in same tab; restore session.
//   • sessionStorage absent + localStorage flag present   → new browser open with "remember me"; restore session.
//   • both absent                                         → new browser open without "remember me"; force logout.
const REMEMBER_KEY = "lg_remember"
const SESSION_KEY  = "lg_session"

// ─── Helpers ───────────────────────────────────────────────────────────────────

function buildInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapAppwriteUser(raw: any): AuthUser {
  const labels  = (raw.labels as string[] | undefined) ?? []
  const rawRole = labels[0]
  const role    = (["admin", "operator", "viewer"].includes(rawRole)
    ? rawRole
    : "viewer") as AuthUser["role"]

  const name = (raw.name as string)?.trim() || (raw.email as string) || "Unknown"

  return {
    id:       raw.$id  as string,
    email:    raw.email as string,
    name,
    role,
    initials: buildInitials(name),
  }
}

// ─── Context ───────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null)

// ─── Provider ──────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user,      setUser]    = useState<AuthUser | null>(null)
  const [isLoading, setLoading] = useState(true)

  // On mount: determine if there is a valid Appwrite session to restore.
  useEffect(() => {
    const sessionActive = sessionStorage.getItem(SESSION_KEY) === "1"
    const rememberMe    = localStorage.getItem(REMEMBER_KEY)  === "1"

    if (!sessionActive && !rememberMe) {
      // New browser open without "remember me" — clear any stale Appwrite session.
      account.deleteSession("current")
        .catch(() => {}) // No active session is fine.
        .finally(resolveSession)
      return
    }

    resolveSession()

    function resolveSession() {
      account.get()
        .then((raw) => {
          setUser(mapAppwriteUser(raw))
          // Ensure the flag is present even after a hard refresh.
          sessionStorage.setItem(SESSION_KEY, "1")
        })
        .catch(() => {
          // Token expired or deleted — clean up flags.
          sessionStorage.removeItem(SESSION_KEY)
          localStorage.removeItem(REMEMBER_KEY)
          setUser(null)
        })
        .finally(() => setLoading(false))
    }
  }, [])

  // ── login ──────────────────────────────────────────────────────────────────
  const login = useCallback(
    async (email: string, password: string, rememberMe: boolean) => {
      await account.createEmailPasswordSession({ email, password })
      const raw      = await account.get()
      const authUser = mapAppwriteUser(raw)

      // Persist "remember me" decision.
      if (rememberMe) {
        localStorage.setItem(REMEMBER_KEY, "1")
      } else {
        localStorage.removeItem(REMEMBER_KEY)
      }
      sessionStorage.setItem(SESSION_KEY, "1")

      setUser(authUser)
    },
    [],
  )

  // ── logout ─────────────────────────────────────────────────────────────────
  const logout = useCallback(async () => {
    await account.deleteSession("current").catch(() => {})
    invalidateJwt()
    localStorage.removeItem(REMEMBER_KEY)
    sessionStorage.removeItem(SESSION_KEY)
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

// ─── Hook ──────────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>")
  return ctx
}
