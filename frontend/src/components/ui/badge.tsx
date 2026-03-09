import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

// ─── Badge ─────────────────────────────────────────────────────────────────────
// Used for package status labels, counts, and system state indicators.
// Variants map directly to LogiGuard domain statuses.

const badgeVariants = cva(
  [
    "inline-flex items-center gap-1",
    "px-1.5 py-0.5",
    "text-xs font-medium",
    "border",
    "whitespace-nowrap",
    "transition-colors",
  ].join(" "),
  {
    variants: {
      variant: {
        default:     "bg-primary/10   text-primary     border-primary/25",
        secondary:   "bg-muted        text-foreground   border-border",
        outline:     "bg-transparent  text-foreground   border-border",
        // ── LogiGuard domain statuses ──────────────────────────────────────
        good:        "bg-success/12   text-success      border-success/30",
        damaged:     "bg-destructive/12 text-destructive border-destructive/30",
        empty:       "bg-muted        text-muted-foreground border-border",
        warning:     "bg-warning/12   text-warning      border-warning/30",
        // ── System statuses ───────────────────────────────────────────────
        stable:      "bg-success/12   text-success      border-success/30",
        unstable:    "bg-destructive/12 text-destructive border-destructive/30",
        degraded:    "bg-warning/12   text-warning      border-warning/30",
      },
    },
    defaultVariants: { variant: "default" },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
