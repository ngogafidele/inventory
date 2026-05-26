// Provides the public/root route loading state.
export default function Loading() {
  return (
    <div className="brand-auth-surface min-h-screen">
      <main className="mx-auto grid min-h-screen max-w-6xl items-center gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:px-10">
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <div className="size-20 animate-pulse rounded-xl bg-muted" />
            <div className="space-y-3">
              <div className="h-4 w-36 animate-pulse rounded bg-muted" />
              <div className="h-10 w-80 max-w-full animate-pulse rounded bg-muted" />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="h-28 animate-pulse rounded-lg bg-muted" />
            <div className="h-28 animate-pulse rounded-lg bg-muted" />
            <div className="h-28 animate-pulse rounded-lg bg-muted" />
          </div>
        </div>
        <div className="space-y-4 rounded-xl border border-border/80 bg-card p-5 shadow-sm sm:p-7">
          <div className="h-10 w-10 animate-pulse rounded-lg bg-muted" />
          <div className="h-8 w-28 animate-pulse rounded bg-muted" />
          <div className="h-4 w-72 max-w-full animate-pulse rounded bg-muted" />
          <div className="h-11 w-full animate-pulse rounded bg-muted" />
          <div className="h-11 w-full animate-pulse rounded bg-muted" />
          <div className="h-11 w-full animate-pulse rounded bg-muted" />
        </div>
      </main>
    </div>
  )
}
