// Mirrors the Products page: header with search and actions, table, pagination.
import { Skeleton } from "@/components/ui/skeleton"
import {
  PageHeaderSkeleton,
  PageSkeleton,
  TableSkeleton,
} from "@/components/skeletons/page-skeletons"

export default function Loading() {
  return (
    <PageSkeleton label="Loading products">
      <PageHeaderSkeleton action="search-and-button" />
      <TableSkeleton columns={7} rows={8} />
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-44" />
        <div className="flex gap-2">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-24" />
        </div>
      </div>
    </PageSkeleton>
  )
}
