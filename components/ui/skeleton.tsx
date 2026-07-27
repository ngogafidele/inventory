import { cn } from "@/lib/utils"

// Base placeholder block. Decorative only — the surrounding page skeleton owns
// the status role, so screen readers announce "loading" once rather than once
// per block.
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn("animate-pulse rounded bg-muted", className)}
    />
  )
}
