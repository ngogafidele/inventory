// Renders the branch overview with role-aware metric visibility.
import { DashboardStats } from "@/components/dashboard/dashboard-stats"
import { IdleGuard } from "@/components/auth/idle-guard"
import { getCurrentStore, requireServerSession } from "@/lib/auth/server"

export default async function DashboardPage() {
  const session = await requireServerSession()
  const store = getCurrentStore(session)

  return (
    <div className="space-y-6">
      {session.isAdmin ? <IdleGuard /> : null}
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Store Overview
        </p>
        <h2 className="text-2xl font-semibold">Dashboard</h2>
      </div>
      <DashboardStats store={store} isAdmin={session.isAdmin} />
    </div>
  )
}
