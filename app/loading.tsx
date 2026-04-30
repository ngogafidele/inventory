export default function Loading() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_15%_20%,_#d5f5e3_0,_transparent_45%),radial-gradient(circle_at_85%_10%,_#fef3c7_0,_transparent_40%),linear-gradient(to_bottom,_#f8fafc,_#f3f4f6)]">
      <main className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10 lg:px-10 lg:py-14">
        <div className="space-y-3">
          <div className="h-3 w-44 animate-pulse rounded bg-muted" />
          <div className="h-10 w-80 animate-pulse rounded bg-muted" />
          <div className="h-4 w-96 max-w-full animate-pulse rounded bg-muted" />
        </div>
        <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
          <div className="space-y-3 rounded-2xl border border-border/80 bg-card/95 p-5 shadow-sm">
            <div className="h-6 w-28 animate-pulse rounded bg-muted" />
            <div className="h-4 w-56 max-w-full animate-pulse rounded bg-muted" />
            <div className="h-8 w-full animate-pulse rounded bg-muted" />
            <div className="h-8 w-full animate-pulse rounded bg-muted" />
            <div className="h-8 w-28 animate-pulse rounded bg-muted" />
          </div>
          <div className="space-y-3 rounded-2xl border border-border/80 bg-card/95 p-5 shadow-sm">
            <div className="h-6 w-36 animate-pulse rounded bg-muted" />
            <div className="h-4 w-64 max-w-full animate-pulse rounded bg-muted" />
            <div className="h-8 w-full animate-pulse rounded bg-muted" />
            <div className="h-8 w-full animate-pulse rounded bg-muted" />
            <div className="h-8 w-full animate-pulse rounded bg-muted" />
            <div className="h-8 w-32 animate-pulse rounded bg-muted" />
          </div>
        </div>
      </main>
    </div>
  )
}
