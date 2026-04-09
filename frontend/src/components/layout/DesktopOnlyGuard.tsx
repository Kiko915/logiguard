import { useState, useEffect } from "react"
import { MonitorX } from "lucide-react"

export function DesktopOnlyGuard({ children }: { children: React.ReactNode }) {
  const [isDesktop, setIsDesktop] = useState(true)

  useEffect(() => {
    // 1024px is the standard breakpoint for 'lg' (desktop/laptops)
    const mediaQuery = window.matchMedia("(min-width: 1024px)")

    // Initial check
    setIsDesktop(mediaQuery.matches)

    // Listener for resize changes
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches)
    mediaQuery.addEventListener("change", handler)

    return () => mediaQuery.removeEventListener("change", handler)
  }, [])

  if (isDesktop) {
    return <>{children}</>
  }

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-muted p-6 text-center">
      <div className="flex flex-col items-center max-w-sm w-full border border-border bg-card p-8 shadow-xs">

        {/* Strict Brand Icon Container: Square, bordered, zero-radius */}
        <div className="w-10 h-10 border border-border bg-muted flex items-center justify-center mb-5 shrink-0">
          <MonitorX className="w-5 h-5 text-foreground" strokeWidth={1.5} />
        </div>

        {/* Max heading size per BRAND.md is text-lg */}
        <h1 className="text-lg font-semibold text-foreground tracking-tight mb-2">
          Desktop Required
        </h1>

        <p className="text-sm text-muted-foreground leading-relaxed mb-8">
          LogiGuard’s inspection dashboard is engineered for high-density enterprise displays. Please access this application on a device with a screen resolution of at least 1024 pixels wide.
        </p>

        {/* Brand Wordmark */}
        <img
          src="/branding/logiguard_wordmark.png"
          alt="LogiGuard"
          className="h-5 w-auto object-contain dark:invert opacity-60"
        />
      </div>
    </div>
  )
}
