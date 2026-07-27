// Mirrors the Users page: header with an add action, user table, login history.
import {
  PageHeaderSkeleton,
  PageSkeleton,
  TableSkeleton,
} from "@/components/skeletons/page-skeletons"

export default function Loading() {
  return (
    <PageSkeleton label="Loading users">
      <PageHeaderSkeleton action="button" />
      <TableSkeleton columns={5} rows={5} />
      <TableSkeleton columns={4} rows={5} title />
    </PageSkeleton>
  )
}
