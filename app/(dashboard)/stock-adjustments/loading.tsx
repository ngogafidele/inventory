// Mirrors the Stock Adjustments page: header, entry form panel, history table.
import { Skeleton } from "@/components/ui/skeleton"
import {
  PageHeaderSkeleton,
  PageSkeleton,
  PanelSkeleton,
  TableSkeleton,
} from "@/components/skeletons/page-skeletons"

export default function Loading() {
  return (
    <PageSkeleton label="Loading stock adjustments">
      <PageHeaderSkeleton />
      <PanelSkeleton>
        <Skeleton className="h-6 w-44" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="space-y-1">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-9 w-full" />
            </div>
          ))}
        </div>
        <Skeleton className="h-9 w-36" />
      </PanelSkeleton>
      {/* Date, Product, SKU, Change, Reason, By */}
      <TableSkeleton columns={6} rows={6} />
    </PageSkeleton>
  )
}
