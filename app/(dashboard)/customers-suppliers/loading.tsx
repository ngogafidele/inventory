// Mirrors the Customers / Suppliers page: header, two-way tab switch, table.
import {
  PageHeaderSkeleton,
  PageSkeleton,
  TableSkeleton,
  TabsSkeleton,
} from "@/components/skeletons/page-skeletons"

export default function Loading() {
  return (
    <PageSkeleton label="Loading customers and suppliers">
      <PageHeaderSkeleton />
      <TabsSkeleton count={2} />
      {/* Name, Phone, Sales, Total, Last activity */}
      <TableSkeleton columns={5} rows={7} />
    </PageSkeleton>
  )
}
