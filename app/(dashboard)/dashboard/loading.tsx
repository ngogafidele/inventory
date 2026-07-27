// Supplies the dashboard loading state while branch metrics are resolved.
import { DashboardSkeleton } from "@/components/dashboard/dashboard-skeleton"
import {
  PageHeaderSkeleton,
  PageSkeleton,
} from "@/components/skeletons/page-skeletons"

export default function Loading() {
  return (
    <PageSkeleton label="Loading dashboard" className="space-y-6">
      <PageHeaderSkeleton />
      <DashboardSkeleton />
    </PageSkeleton>
  )
}
