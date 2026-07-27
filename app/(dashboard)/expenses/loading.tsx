// Mirrors the Expenses page: header with description, search and add, table.
import {
  PageHeaderSkeleton,
  PageSkeleton,
  TableSkeleton,
} from "@/components/skeletons/page-skeletons"

export default function Loading() {
  return (
    <PageSkeleton label="Loading expenses">
      <PageHeaderSkeleton withDescription action="search-and-button" />
      <TableSkeleton columns={6} rows={7} />
    </PageSkeleton>
  )
}
