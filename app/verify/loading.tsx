// Mirrors the password gate: one centred card, not the login two-column layout
// that app/loading.tsx draws.
import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
  return (
    <main
      role="status"
      aria-label="Loading verification"
      className="brand-auth-surface flex min-h-screen items-center justify-center p-4"
    >
      <section className="w-full max-w-md rounded-xl border border-border/80 bg-card p-5 shadow-xl sm:p-7">
        <div className="mb-6 space-y-3">
          <Skeleton className="size-10 rounded-lg" />
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-full" />
        </div>
      </section>
    </main>
  )
}
