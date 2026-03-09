import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

// ─── Button Variants ───────────────────────────────────────────────────────────
// Enterprise style: sharp edges, compact padding, muted interactions.
const buttonVariants = cva(
  // Base — applies to every variant
  [
    "inline-flex items-center justify-center gap-1.5",
    "text-sm font-medium",
    "border border-transparent",
    "transition-colors duration-100",
    "cursor-pointer select-none whitespace-nowrap",
    "focus-visible:outline-none focus-visible:ring-[1.5px] focus-visible:ring-ring focus-visible:ring-offset-0",
    "disabled:pointer-events-none disabled:opacity-40",
  ].join(" "),
  {
    variants: {
      variant: {
        // Primary — solid navy
        default:
          "bg-primary text-primary-foreground border-primary hover:bg-primary/88 active:bg-primary/80",
        // Secondary — light fill
        secondary:
          "bg-secondary text-secondary-foreground border-border hover:bg-accent active:bg-border",
        // Outline — border only
        outline:
          "bg-transparent text-foreground border-border hover:bg-accent active:bg-muted",
        // Ghost — no border
        ghost:
          "bg-transparent text-foreground border-transparent hover:bg-accent active:bg-muted",
        // Destructive
        destructive:
          "bg-destructive text-destructive-foreground border-destructive hover:bg-destructive/88 active:bg-destructive/80",
        // Link
        link:
          "bg-transparent text-primary border-transparent underline-offset-3 hover:underline h-auto p-0",
      },
      size: {
        xs: "h-6  px-2   text-xs gap-1",      // 24px — table actions, tags
        sm: "h-7  px-2.5 text-sm gap-1",      // 28px — toolbar buttons
        md: "h-8  px-3   text-sm",            // 32px — default
        lg: "h-9  px-4   text-base",          // 36px — primary CTAs
        icon: "h-7 w-7 p-0 text-sm",          // icon-only, square
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
