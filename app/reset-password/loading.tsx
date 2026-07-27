// Mirrors the reset-password page: one centred card, not the login two-column
// layout that app/loading.tsx draws.
import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
  return (
    <div className="brand-auth-surface min-h-screen">
      <main
        role="status"
        aria-label="Loading password reset"
        className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-4 py-8 sm:px-6"
      >
        <div className="space-y-4 rounded-xl border border-border/80 bg-card p-5 shadow-xl sm:p-7">
          <Skeleton className="size-10 rounded-lg" />
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-full max-w-sm" />
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-full" />
        </div>
      </main>
    </div>
  )
}
