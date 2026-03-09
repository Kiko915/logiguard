import * as React from "react"
import { cn } from "@/lib/utils"

// ─── Input ─────────────────────────────────────────────────────────────────────
// Sharp, compact input for enterprise forms and filter bars.

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      ref={ref}
      className={cn(
        // Layout
        "flex w-full h-8 px-2.5",
        // Typography
        "text-sm text-foreground placeholder:text-muted-foreground",
        // Appearance
        "bg-background border border-input",
        "shadow-none outline-none",
        // Focus
        "focus-visible:border-ring focus-visible:ring-[1.5px] focus-visible:ring-ring/30",
        // States
        "disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed",
        "read-only:bg-muted/50",
        // File input
        "file:border-0 file:bg-transparent file:text-sm file:font-medium",
        className
      )}
      {...props}
    />
  )
)
Input.displayName = "Input"

export { Input }
