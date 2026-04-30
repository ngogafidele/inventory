import { DashboardStats } from "@/components/dashboard/dashboard-stats"
import { getCurrentStore, requireServerSession } from "@/lib/auth/server"

export default async function DashboardPage() {
  const session = await requireServerSession()
  const store = getCurrentStore(session)

  return (
    <div className="space-y-6">
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
