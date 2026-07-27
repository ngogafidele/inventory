// Mirrors the Returns page: header, the return-entry panel, then the history.
import { Skeleton } from "@/components/ui/skeleton"
import {
  PageHeaderSkeleton,
  PageSkeleton,
  PanelSkeleton,
  TableSkeleton,
} from "@/components/skeletons/page-skeletons"

export default function Loading() {
  return (
    <PageSkeleton label="Loading returns">
      <PageHeaderSkeleton withDescription action="button" />

      <PanelSkeleton>
        <Skeleton className="h-6 w-40" />
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="space-y-1">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-9 w-full" />
            </div>
          ))}
        </div>
      </PanelSkeleton>

      {/* Time, Returned Items, Total, Replacement, Notes, Actions */}
      <TableSkeleton columns={6} rows={6} />
    </PageSkeleton>
  )
}
