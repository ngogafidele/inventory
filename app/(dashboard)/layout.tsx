import type { ReactNode } from "react"
import { AppShell } from "@/components/layout/app-shell"
import type { LoanNotification } from "@/components/layout/loan-notifications"
import { requireServerSession } from "@/lib/auth/server"
import { Sale } from "@/lib/db/models/Sale"
import { connectToDatabase } from "@/lib/db/connection"
import { User } from "@/lib/db/models/User"
import {
  formatInKigali,
  formatKigaliDateInput,
  parseKigaliDateInput,
} from "@/lib/utils/time"

type DashboardLayoutUser = {
  name?: string
}

type DashboardLoanNotificationSale = {
  _id: { toString(): string }
  totalAmount: number
  outstanding?: {
    customerName?: string
    customerPhone?: string
    paymentDate?: Date
  }
}

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode
}) {
  const session = await requireServerSession()
  let userName = session.name
  const store = session.currentStore ?? session.stores[0]
  const todayInput = formatKigaliDateInput(new Date())
  const todayStart = parseKigaliDateInput(todayInput) ?? new Date()
  const tomorrowStart = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000)

  await connectToDatabase()

  const [user, notificationSales] = await Promise.all([
    userName
      ? Promise.resolve(null)
      : User.findById(session.userId)
          .select("name")
          .lean<DashboardLayoutUser | null>(),
    Sale.find({
      store,
      paymentStatus: "unpaid",
      "outstanding.paymentDate": { $lt: tomorrowStart },
    })
      .select("totalAmount outstanding")
      .sort({ "outstanding.paymentDate": 1, createdAt: -1 })
      .lean<DashboardLoanNotificationSale[]>(),
  ])

  if (!userName) {
    userName = user?.name
  }

  const loanNotifications: LoanNotification[] = notificationSales
    .filter((sale) => sale.outstanding?.paymentDate)
    .map((sale) => {
      const paymentDate = sale.outstanding?.paymentDate
      const status =
        paymentDate && paymentDate < todayStart ? "overdue" : "due"

      return {
        id: sale._id.toString(),
        customerName: sale.outstanding?.customerName?.trim() || "Unknown customer",
        customerPhone: sale.outstanding?.customerPhone,
        amount: sale.totalAmount,
        paymentDateLabel: formatInKigali(paymentDate, {
          year: "numeric",
          month: "short",
          day: "2-digit",
        }),
        status,
      }
    })

  return (
    <AppShell
      session={session}
      userName={userName}
      loanNotifications={loanNotifications}
    >
      {children}
    </AppShell>
  )
}
