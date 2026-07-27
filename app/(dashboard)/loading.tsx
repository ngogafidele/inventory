// Fallback for dashboard routes that have no loading file of their own.
//
// This renders inside AppShell, which the (dashboard) layout has already drawn
// for real, so it covers the page body only. It must not draw a header or
// sidebar of its own or the shell appears twice during a navigation.
import {
  PageHeaderSkeleton,
  PageSkeleton,
  TableSkeleton,
} from "@/components/skeletons/page-skeletons"

export default function Loading() {
  return (
    <PageSkeleton label="Loading page">
      <PageHeaderSkeleton />
      <TableSkeleton columns={5} rows={6} />
    </PageSkeleton>
  )
}
