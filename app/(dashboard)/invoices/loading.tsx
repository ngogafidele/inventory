// Mirrors the Invoices page: header with a create action, sales/proforma tabs,
// then the document list.
import {
  PageHeaderSkeleton,
  PageSkeleton,
  TableSkeleton,
  TabsSkeleton,
} from "@/components/skeletons/page-skeletons"

export default function Loading() {
  return (
    <PageSkeleton label="Loading invoices">
      <PageHeaderSkeleton action="button" />
      <TabsSkeleton count={2} />
      <TableSkeleton columns={6} rows={7} />
    </PageSkeleton>
  )
}
