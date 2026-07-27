// Renders the administrator-only overview for the currently selected branch.
import { DashboardStats } from "@/components/dashboard/dashboard-stats"
import { IdleGuard } from "@/components/auth/idle-guard"
import { getCurrentStore, requireServerSession } from "@/lib/auth/server"
import { redirect } from "next/navigation"

export default async function DashboardPage() {
  const session = await requireServerSession()
  if (!session.isAdmin) {
    redirect("/sales")
  }
  const store = getCurrentStore(session)

  return (
    <div className="space-y-6">
      <IdleGuard />
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Store Overview
        </p>
        <h2 className="text-2xl font-semibold">Dashboard</h2>
      </div>
      <DashboardStats store={store} />
    </div>
  )
}
