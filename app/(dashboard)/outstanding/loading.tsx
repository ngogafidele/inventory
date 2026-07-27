// Mirrors the Loans page: header, three receivable stat cards, filters, ledger.
import {
  FilterBarSkeleton,
  PageHeaderSkeleton,
  PageSkeleton,
  StatsGridSkeleton,
  TableSkeleton,
} from "@/components/skeletons/page-skeletons"

export default function Loading() {
  return (
    <PageSkeleton label="Loading loans">
      <PageHeaderSkeleton withDescription action="button" />
      <StatsGridSkeleton count={3} className="md:grid-cols-3" />
      <FilterBarSkeleton fields={3} />
      {/* Sale Date, Customer, Phone, Total, Paid, Balance, Due, Actions */}
      <TableSkeleton columns={8} rows={6} />
    </PageSkeleton>
  )
}
