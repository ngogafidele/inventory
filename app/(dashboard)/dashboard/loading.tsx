import { DashboardSkeleton } from "@/components/dashboard/dashboard-skeleton"

export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="h-3 w-36 animate-pulse rounded bg-muted" />
        <div className="h-8 w-52 animate-pulse rounded bg-muted" />
      </div>
      <DashboardSkeleton />
    </div>
  )
}
