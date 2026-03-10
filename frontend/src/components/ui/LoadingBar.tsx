import { useEffect, useState } from "react"

// ─── Loading Bar ────────────────────────────────────────────────────────────────
// Thin 2px top-of-viewport progress bar.
//
// Smart behaviour:
//  • Only appears after a 150 ms delay — instant/cached requests never trigger it.
//  • Counts concurrent requests; bar stays until ALL complete.
//  • Crawls from 0 → ~82 % (indeterminate) then snaps to 100 % on done.
//  • Fades out cleanly; resets to hidden without layout shift.
//
// Driven by two custom window events dispatched by the fetch interceptor:
//   window.dispatchEvent(new Event("loading:start"))
//   window.dispatchEvent(new Event("loading:done"))

interface BarState {
  visible:  boolean
  progress: number   // 0 – 100
  exiting:  boolean  // true = fading out at 100 %
}

const IDLE: BarState = { visible: false, progress: 0, exiting: false }

export function LoadingBar() {
  const [bar, setBar] = useState<BarState>(IDLE)

  useEffect(() => {
    // ── Mutable state kept in plain refs (no stale closures) ────────────────
    let pending   = 0
    let isShowing = false

    let showTimer:     ReturnType<typeof setTimeout>   | undefined
    let progressTimer: ReturnType<typeof setInterval>  | undefined
    let doneTimer:     ReturnType<typeof setTimeout>   | undefined
    let fadeTimer:     ReturnType<typeof setTimeout>   | undefined

    function clearAll() {
      clearTimeout(showTimer)
      clearTimeout(doneTimer)
      clearTimeout(fadeTimer)
      clearInterval(progressTimer)
    }

    function show() {
      isShowing = true
      setBar({ visible: true, progress: 0, exiting: false })

      // Ease toward ~82 % — slows as it approaches, never reaches
      let p = 0
      progressTimer = setInterval(() => {
        p += (82 - p) * 0.09
        setBar(s => ({ ...s, progress: p }))
      }, 80)
    }

    function done() {
      clearInterval(progressTimer)

      // Snap to 100 % …
      setBar(s => ({ ...s, progress: 100 }))

      // … hold briefly, then fade out
      doneTimer = setTimeout(() => {
        setBar(s => ({ ...s, exiting: true }))

        // After fade, reset to hidden
        fadeTimer = setTimeout(() => {
          setBar(IDLE)
          isShowing = false
        }, 300)
      }, 120)
    }

    // ── Event handlers ────────────────────────────────────────────────────────
    function onStart() {
      pending++
      clearTimeout(doneTimer)
      clearTimeout(fadeTimer)

      if (isShowing) return  // bar already visible — just increment counter

      // Gate: only show if request is still in flight after 150 ms
      showTimer = setTimeout(() => {
        if (pending > 0) show()
      }, 150)
    }

    function onDone() {
      pending = Math.max(0, pending - 1)
      if (pending > 0) return  // more requests still in flight

      clearTimeout(showTimer)      // cancel the gate timer

      if (isShowing) done()        // animate out
      // if gate timer was cancelled before showing → stays invisible (smart ✓)
    }

    window.addEventListener("loading:start", onStart)
    window.addEventListener("loading:done",  onDone)

    return () => {
      window.removeEventListener("loading:start", onStart)
      window.removeEventListener("loading:done",  onDone)
      clearAll()
    }
  }, [])

  if (!bar.visible) return null

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[9999] h-[2px] pointer-events-none"
      aria-hidden="true"
    >
      <div
        className="h-full bg-foreground"
        style={{
          width:      `${bar.progress}%`,
          opacity:    bar.exiting ? 0 : 1,
          transition: bar.exiting
            ? "width 0.12s ease-out, opacity 0.28s ease-out"
            : "width 0.09s linear",
        }}
      />
    </div>
  )
}
