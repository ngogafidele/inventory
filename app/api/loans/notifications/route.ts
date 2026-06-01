// Returns due and overdue unpaid sales for the loan notification badge.
import { NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/db/connection"
import { Sale } from "@/lib/db/models/Sale"
import { requireAuth } from "@/lib/auth/middleware"
import { resolveStoreFromRequest } from "@/lib/auth/session"
import {
  formatInKigali,
  formatKigaliDateInput,
  parseKigaliDateInput,
} from "@/lib/utils/time"
import type { LoanNotification } from "@/types/loan-notification"

type NotificationSale = {
  _id: { toString(): string }
  totalAmount: number
  remainingBalance?: number
  outstanding?: {
    customerName?: string
    customerPhone?: string
    paymentDate?: Date
  }
}

export async function GET(request: NextRequest) {
  try {
    const { authorized, session } = await requireAuth(request)
    if (!authorized || !session) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      )
    }

    const store = resolveStoreFromRequest(request, session)
    if (!store) {
      return NextResponse.json(
        { success: false, error: "Access denied" },
        { status: 403 }
      )
    }

    const todayInput = formatKigaliDateInput(new Date())
    const todayStart = parseKigaliDateInput(todayInput) ?? new Date()
    const tomorrowStart = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000)

    await connectToDatabase()
    const sales = await Sale.find({
      store,
      paymentStatus: "unpaid",
      "outstanding.paymentDate": { $lt: tomorrowStart },
    })
      .select("totalAmount remainingBalance outstanding")
      .sort({ "outstanding.paymentDate": 1, createdAt: -1 })
      .lean<NotificationSale[]>()

    const notifications: LoanNotification[] = sales
      .filter((sale) => sale.outstanding?.paymentDate)
      .map((sale) => {
        const paymentDate = sale.outstanding?.paymentDate
        const status =
          paymentDate && paymentDate < todayStart ? "overdue" : "due"

        return {
          id: sale._id.toString(),
          customerName:
            sale.outstanding?.customerName?.trim() || "Unknown customer",
          customerPhone: sale.outstanding?.customerPhone,
          amount: sale.remainingBalance ?? sale.totalAmount,
          paymentDateLabel: formatInKigali(paymentDate, {
            year: "numeric",
            month: "short",
            day: "2-digit",
          }),
          status,
        }
      })

    return NextResponse.json({ success: true, data: notifications })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to fetch loan notifications" },
      { status: 500 }
    )
  }
}
