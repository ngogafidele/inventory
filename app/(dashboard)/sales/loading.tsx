// Mirrors the Sales page: header, the record-sale form panel, then the ledger.
import { Skeleton } from "@/components/ui/skeleton"
import {
  PageHeaderSkeleton,
  PageSkeleton,
  PanelSkeleton,
  TableSkeleton,
} from "@/components/skeletons/page-skeletons"

export default function Loading() {
  return (
    <PageSkeleton label="Loading sales">
      <PageHeaderSkeleton withDescription />

      <PanelSkeleton className="space-y-4 border-border p-4 sm:p-5">
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-36" />
          <Skeleton className="h-9 w-28" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="space-y-1">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-9 w-full" />
            </div>
          ))}
        </div>
        {/* Line-item rows added to the sale before saving. */}
        <TableSkeleton columns={5} rows={2} />
        <div className="flex justify-end gap-2">
          <Skeleton className="h-9 w-28" />
          <Skeleton className="h-9 w-36" />
        </div>
      </PanelSkeleton>

      <TableSkeleton columns={7} rows={6} title />
    </PageSkeleton>
  )
}
