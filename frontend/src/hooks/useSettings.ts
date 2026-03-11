import { useCallback, useEffect, useState } from "react"

// ─── Types ─────────────────────────────────────────────────────────────────────

export type Theme           = "light" | "dark" | "system"
export type RefreshInterval = 15 | 30 | 60

export interface Settings {
  theme:               Theme
  confidenceThreshold: number   // 70 – 99 %
  blockchainLogging:   boolean
  refreshInterval:     RefreshInterval
  notifications:       boolean
}

// ─── Defaults ──────────────────────────────────────────────────────────────────

const DEFAULTS: Settings = {
  theme:               "system",
  confidenceThreshold: 80,
  blockchainLogging:   true,
  refreshInterval:     30,
  notifications:       true,
}

const STORAGE_KEY = "lg_settings"

// ─── Theme application ─────────────────────────────────────────────────────────

function applyTheme(theme: Theme) {
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches
  const dark = theme === "dark" || (theme === "system" && prefersDark)
  document.documentElement.classList.toggle("dark", dark)
}

// ─── Hook ──────────────────────────────────────────────────────────────────────

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) return { ...DEFAULTS, ...JSON.parse(raw) }
    } catch { /* ignore */ }
    return DEFAULTS
  })

  // Apply theme on mount and whenever it changes
  useEffect(() => {
    applyTheme(settings.theme)
  }, [settings.theme])

  // Keep in sync if system preference changes while "system" is selected
  useEffect(() => {
    if (settings.theme !== "system") return
    const mq = window.matchMedia("(prefers-color-scheme: dark)")
    const handler = () => applyTheme("system")
    mq.addEventListener("change", handler)
    return () => mq.removeEventListener("change", handler)
  }, [settings.theme])

  const setSetting = useCallback(<K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings((prev) => {
      const next = { ...prev, [key]: value }
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
  }, [])

  const resetSettings = useCallback(() => {
    try { localStorage.removeItem(STORAGE_KEY) } catch { /* ignore */ }
    setSettings(DEFAULTS)
  }, [])

  return { settings, setSetting, resetSettings }
}
