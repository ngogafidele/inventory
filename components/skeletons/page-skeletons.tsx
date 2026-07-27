// Building blocks for route loading states.
//
// These mirror the real markup of the pages they stand in for — the same header
// shape, the same filter bars, the same table column counts — so a page does not
// visibly re-lay-out when the data arrives.
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

// Wraps a page skeleton and announces the loading state once.
export function PageSkeleton({
  label,
  className,
  children,
}: {
  label: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <div
      role="status"
      aria-label={label}
      className={cn("space-y-5", className)}
    >
      {children}
    </div>
  )
}

// Matches the eyebrow / title / optional description block every page opens with.
export function PageHeaderSkeleton({
  withDescription = false,
  action,
}: {
  withDescription?: boolean
  action?: "button" | "search-and-button" | "filters"
}) {
  const heading = (
    <div className="space-y-2">
      <Skeleton className="h-3 w-28" />
      <Skeleton className="h-8 w-48" />
      {withDescription ? <Skeleton className="h-4 w-72 max-w-full" /> : null}
    </div>
  )

  if (!action) return heading

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      {heading}
      <div className="flex w-full flex-wrap gap-2 sm:w-auto">
        {action === "search-and-button" ? (
          <Skeleton className="h-9 w-full sm:w-56" />
        ) : null}
        {action === "filters" ? (
          <>
            <Skeleton className="h-9 w-28" />
            <Skeleton className="h-9 w-28" />
          </>
        ) : null}
        <Skeleton className="h-9 w-32" />
      </div>
    </div>
  )
}

export function StatsGridSkeleton({
  count = 4,
  className = "md:grid-cols-2 xl:grid-cols-4",
}: {
  count?: number
  className?: string
}) {
  return (
    <div className={cn("grid gap-4", className)}>
      {Array.from({ length: count }).map((_, index) => (
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
  )
}

// Mirrors the shared Table primitive: a header row over evenly divided rows.
export function TableSkeleton({
  columns = 5,
  rows = 6,
  title = false,
}: {
  columns?: number
  rows?: number
  title?: boolean
}) {
  return (
    <div className="space-y-3">
      {title ? <Skeleton className="h-6 w-44" /> : null}
      <div className="overflow-hidden rounded-lg border border-border/70">
        <div
          className="grid gap-3 border-b border-border/70 bg-muted/30 p-3"
          style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: columns }).map((_, index) => (
            <Skeleton key={index} className="h-3 w-16 max-w-full" />
          ))}
        </div>
        <div className="divide-y divide-border/70">
          {Array.from({ length: rows }).map((_, rowIndex) => (
            <div
              key={rowIndex}
              className="grid gap-3 p-3"
              style={{
                gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
              }}
            >
              {Array.from({ length: columns }).map((_, cellIndex) => (
                <Skeleton key={cellIndex} className="h-4 w-20 max-w-full" />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// The bordered card several pages wrap a form or chart in.
export function PanelSkeleton({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <section
      className={cn(
        "space-y-3 rounded-2xl border border-border/80 bg-card p-4 shadow-sm",
        className
      )}
    >
      {children}
    </section>
  )
}

// The segmented control used by Invoices, Customers/Suppliers and Financial Reports.
export function TabsSkeleton({ count = 2 }: { count?: number }) {
  return (
    <div className="rounded-lg border border-border bg-muted/40 p-1">
      <div
        className="grid gap-1"
        style={{ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: count }).map((_, index) => (
          <Skeleton key={index} className="h-12 rounded-md" />
        ))}
      </div>
    </div>
  )
}

// The date-range / filter row rendered as a bordered card.
export function FilterBarSkeleton({ fields = 2 }: { fields?: number }) {
  return (
    <div className="grid gap-3 rounded-2xl border border-border/80 bg-card p-4 shadow-sm md:grid-cols-[repeat(auto-fit,minmax(140px,1fr))]">
      {Array.from({ length: fields }).map((_, index) => (
        <div key={index} className="space-y-1">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-9 w-full" />
        </div>
      ))}
      <div className="flex items-end">
        <Skeleton className="h-9 w-24" />
      </div>
    </div>
  )
}

export function ChartSkeleton({ height = "h-64" }: { height?: string }) {
  return (
    <PanelSkeleton>
      <Skeleton className="h-5 w-40" />
      <Skeleton className={cn("w-full", height)} />
    </PanelSkeleton>
  )
}
