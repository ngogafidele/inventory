// Renders the administrator-only financial reports for the selected branch.
import { redirect } from "next/navigation"
import { getCurrentStore, requireServerSession } from "@/lib/auth/server"
import { STORE_LABELS } from "@/lib/utils/constants"
import { IdleGuard } from "@/components/auth/idle-guard"
import { FinancialStatementsManager } from "@/components/financial-statements/financial-statements-manager"

export default async function FinancialStatementsPage() {
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
          {STORE_LABELS[store]} Accounting
        </p>
        <h2 className="text-2xl font-semibold">Financial Reports</h2>
        <p className="text-sm text-muted-foreground">
          Income statement and balance sheet for {STORE_LABELS[store]}.
        </p>
      </div>

      <FinancialStatementsManager />
    </div>
  )
}
