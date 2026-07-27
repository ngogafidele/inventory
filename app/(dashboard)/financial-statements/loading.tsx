// Mirrors the Financial Reports page: header, the statement tab pair, the date
// controls, and the statement rows themselves.
import { Skeleton } from "@/components/ui/skeleton"
import {
  FilterBarSkeleton,
  PageHeaderSkeleton,
  PageSkeleton,
  PanelSkeleton,
} from "@/components/skeletons/page-skeletons"

export default function Loading() {
  return (
    <PageSkeleton label="Loading financial reports" className="space-y-6">
      <PageHeaderSkeleton withDescription />

      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-10 w-44 rounded-lg" />
        <Skeleton className="h-10 w-40 rounded-lg" />
      </div>

      <FilterBarSkeleton fields={2} />

      <PanelSkeleton>
        <div className="flex items-baseline justify-between">
          <Skeleton className="h-6 w-44" />
          <Skeleton className="h-4 w-40" />
        </div>
        {/* Revenue, COGS, Gross Profit, Operating Expenses, Net Profit */}
        <div className="divide-y divide-border">
          {Array.from({ length: 5 }).map((_, index) => (
            <div
              key={index}
              className="flex items-baseline justify-between gap-4 py-2.5"
            >
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-28" />
            </div>
          ))}
        </div>
      </PanelSkeleton>
    </PageSkeleton>
  )
}
