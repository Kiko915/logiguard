import { account } from "@/lib/appwrite"

// ─── Config ────────────────────────────────────────────────────────────────────
const BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined)
  ?? "http://localhost:3000"

// ─── JWT cache ─────────────────────────────────────────────────────────────────
// Appwrite JWTs are valid for 15 minutes. We cache the token in memory and
// refresh it 1 minute before expiry to avoid mid-request invalidation.
let cachedJwt:    string | null = null
let jwtExpiresAt: number        = 0
const JWT_TTL_MS  = 14 * 60 * 1000 // 14 min (1 min safety margin)

export function invalidateJwt(): void {
  cachedJwt    = null
  jwtExpiresAt = 0
}

async function getJwt(): Promise<string> {
  if (cachedJwt && Date.now() < jwtExpiresAt) return cachedJwt
  const { jwt } = await account.createJWT()
  cachedJwt     = jwt
  jwtExpiresAt  = Date.now() + JWT_TTL_MS
  return jwt
}

// ─── Core fetch ────────────────────────────────────────────────────────────────

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const jwt = await getJwt()

  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${jwt}`,
      ...init?.headers,
    },
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { message?: string }
    throw new Error(body.message ?? `HTTP ${res.status}`)
  }

  return res.json() as Promise<T>
}

// ─── Public API client ─────────────────────────────────────────────────────────

export const api = {
  get:    <T>(path: string)                => apiFetch<T>(path),
  post:   <T>(path: string, body: unknown) => apiFetch<T>(path, { method: "POST",   body: JSON.stringify(body) }),
  put:    <T>(path: string, body: unknown) => apiFetch<T>(path, { method: "PUT",    body: JSON.stringify(body) }),
  delete: <T>(path: string)               => apiFetch<T>(path, { method: "DELETE" }),
}
