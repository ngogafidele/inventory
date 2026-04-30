export default function Loading() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border/80 bg-card/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-3 sm:px-6 sm:py-4 lg:px-10 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="size-9 animate-pulse rounded-xl bg-muted" />
            <div className="space-y-2">
              <div className="h-3 w-36 animate-pulse rounded bg-muted" />
              <div className="h-6 w-44 animate-pulse rounded bg-muted" />
            </div>
          </div>
          <div className="h-7 w-40 animate-pulse rounded bg-muted" />
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-4 sm:px-6 sm:py-6 lg:px-10 md:flex-row">
        <aside className="w-full shrink-0 rounded-2xl border border-sidebar-border bg-sidebar/90 p-3 md:w-64">
          <div className="mb-4 space-y-2 border-b border-sidebar-border px-2 pb-3">
            <div className="h-3 w-28 animate-pulse rounded bg-muted" />
            <div className="h-5 w-36 animate-pulse rounded bg-muted" />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:flex md:flex-col">
            {Array.from({ length: 7 }).map((_, idx) => (
              <div
                key={idx}
                className="h-9 animate-pulse rounded-lg bg-muted"
              />
            ))}
          </div>
        </aside>

        <main className="flex-1 rounded-2xl border border-border/80 bg-card/95 p-4 shadow-sm sm:p-5 lg:p-6">
          <div className="space-y-5">
            <div className="space-y-2">
              <div className="h-3 w-36 animate-pulse rounded bg-muted" />
              <div className="h-8 w-52 animate-pulse rounded bg-muted" />
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, idx) => (
                <div
                  key={idx}
                  className="rounded-2xl border border-border/80 bg-background/80 p-4"
                >
                  <div className="h-3 w-20 animate-pulse rounded bg-muted" />
                  <div className="mt-2 h-8 w-24 animate-pulse rounded bg-muted" />
                </div>
              ))}
            </div>

            <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-sm">
              <div className="mb-3 h-6 w-44 animate-pulse rounded bg-muted" />
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, idx) => (
                  <div
                    key={idx}
                    className="h-9 animate-pulse rounded bg-muted"
                  />
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
