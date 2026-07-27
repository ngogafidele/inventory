// Defines the skeleton arrangement displayed while dashboard data loads.
//
// Mirrors DashboardStats: eleven metric cards on a six-column grid, then the
// Recent Sales and Top Products panels. Keep the card count and spacing in step
// with that component or the page jumps when the data lands.
import { Skeleton } from "@/components/ui/skeleton"

const CARD_COUNT = 11

function PanelSkeleton() {
  return (
    <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-6 w-40" />
        </div>
        <Skeleton className="size-4 rounded-full" />
      </div>
      <div className="overflow-hidden rounded-md border border-border/70">
        <div className="grid grid-cols-3 gap-3 border-b border-border/70 bg-muted/30 p-3">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 w-14" />
        </div>
        <div className="divide-y divide-border/70">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="grid grid-cols-3 gap-3 p-3">
              <Skeleton className="h-4 w-24 max-w-full" />
              <Skeleton className="h-4 w-20 max-w-full" />
              <Skeleton className="h-4 w-16 max-w-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-14" role="status" aria-label="Loading dashboard">
      <div className="grid gap-x-5 gap-y-12 md:grid-cols-2 xl:grid-cols-6">
        {Array.from({ length: CARD_COUNT }).map((_, index) => (
          <div
            key={index}
            className="rounded-2xl border border-border/80 bg-background/80 p-4 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="size-4 rounded-full" />
            </div>
            <Skeleton className="mt-2 h-8 w-24" />
          </div>
        ))}
      </div>

      <div className="grid gap-12">
        <PanelSkeleton />
        <PanelSkeleton />
      </div>
    </div>
  )
}
