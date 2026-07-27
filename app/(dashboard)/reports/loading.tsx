// Mirrors the Reports page: header, date-range form, four metric cards, the
// daily trend chart, then the paired profit and top-product charts.
import {
  ChartSkeleton,
  FilterBarSkeleton,
  PageHeaderSkeleton,
  PageSkeleton,
  StatsGridSkeleton,
} from "@/components/skeletons/page-skeletons"

export default function Loading() {
  return (
    <PageSkeleton label="Loading reports" className="space-y-6">
      <PageHeaderSkeleton withDescription />
      <FilterBarSkeleton fields={2} />
      <StatsGridSkeleton count={4} />
      <ChartSkeleton height="h-72" />
      <div className="grid gap-4 xl:grid-cols-2">
        <ChartSkeleton />
        <ChartSkeleton />
      </div>
    </PageSkeleton>
  )
}
