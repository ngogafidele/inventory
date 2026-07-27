// Returns the computed balance sheet as of a date (admin only).
import { NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/db/connection"
import { requireAdmin } from "@/lib/auth/middleware"
import { resolveStoreFromRequest } from "@/lib/auth/session"
import { resolveAsOf } from "@/lib/financial/period"
import {
  computeBalanceSheet,
  resolveManualItems,
} from "@/lib/financial/balance-sheet"

export async function GET(request: NextRequest) {
  try {
    const { authorized, session } = await requireAdmin(request)
    if (!authorized || !session) {
      return NextResponse.json(
        { success: false, error: "Admin only" },
        { status: 403 }
      )
    }

    const store = resolveStoreFromRequest(request, session)
    if (!store) {
      return NextResponse.json(
        { success: false, error: "Access denied" },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const { asOf, endExclusive, asOfInput } = resolveAsOf(
      searchParams.get("asOf") ?? undefined
    )

    await connectToDatabase()
    const [sheet, manualItems] = await Promise.all([
      computeBalanceSheet(store, { asOf, endExclusive, asOfInput }),
      // Returned alongside so the editor lists exactly the versions in effect.
      resolveManualItems(store, endExclusive),
    ])

    return NextResponse.json({
      success: true,
      data: { sheet, manualItems, asOf: asOfInput },
    })
  } catch (error) {
    console.error("[Balance Sheet Error]", error)
    return NextResponse.json(
      { success: false, error: "Failed to compute balance sheet" },
      { status: 500 }
    )
  }
}
