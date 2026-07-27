// Mirrors the Low Stock Alerts page: header over a five-column table.
import {
  PageHeaderSkeleton,
  PageSkeleton,
  TableSkeleton,
} from "@/components/skeletons/page-skeletons"

export default function Loading() {
  return (
    <PageSkeleton label="Loading low stock alerts">
      <PageHeaderSkeleton />
      {/* Product, SKU, Quantity, Threshold, Status */}
      <TableSkeleton columns={5} rows={6} />
    </PageSkeleton>
  )
}
