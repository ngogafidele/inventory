function SkeletonBlock({ className }: { className: string }) {
  return <div className={`animate-pulse rounded bg-muted ${className}`} />
}

function TableSkeleton() {
  return (
    <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <div className="space-y-2">
          <SkeletonBlock className="h-3 w-32" />
          <SkeletonBlock className="h-6 w-44" />
        </div>
        <SkeletonBlock className="size-4 rounded-full" />
      </div>
      <div className="overflow-hidden rounded-md border border-border/70">
        <div className="grid grid-cols-3 gap-3 border-b border-border/70 bg-muted/30 p-3">
          <SkeletonBlock className="h-3 w-16" />
          <SkeletonBlock className="h-3 w-24" />
          <SkeletonBlock className="h-3 w-14" />
        </div>
        <div className="divide-y divide-border/70">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="grid grid-cols-3 gap-3 p-3">
              <SkeletonBlock className="h-4 w-24 max-w-full" />
              <SkeletonBlock className="h-4 w-20 max-w-full" />
              <SkeletonBlock className="h-4 w-16 max-w-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-5" aria-label="Loading dashboard">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <div
            key={index}
            className="rounded-2xl border border-border/80 bg-background/80 p-4 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <SkeletonBlock className="h-3 w-20" />
              <SkeletonBlock className="size-4 rounded-full" />
            </div>
            <SkeletonBlock className="mt-2 h-8 w-24" />
          </div>
        ))}
      </div>

      <div className="grid gap-4">
        <TableSkeleton />
        <TableSkeleton />
      </div>
    </div>
  )
}
