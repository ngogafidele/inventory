// Streams the income statement as a PDF (admin only).
import { NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/db/connection"
import { requireAdmin } from "@/lib/auth/middleware"
import { resolveStoreFromRequest } from "@/lib/auth/session"
import { resolveIncomeRange } from "@/lib/financial/period"
import { computeIncomeStatement } from "@/lib/financial/income-statement"
import { generateIncomeStatementPDF } from "@/lib/pdf/financial-statement-generator"

export const runtime = "nodejs"

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
    const range = resolveIncomeRange(
      searchParams.get("start") ?? undefined,
      searchParams.get("end") ?? undefined
    )

    await connectToDatabase()
    const statement = await computeIncomeStatement(store, {
      from: range.from,
      endExclusive: range.endExclusive,
    })

    const pdf = await generateIncomeStatementPDF({
      store,
      range: { from: range.fromInput, to: range.toInput },
      generatedAt: new Date(),
      statement,
    })

    const filename = `income-statement-${range.fromInput}-to-${range.toInput}.pdf`
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error("[Income Statement PDF Error]", error)
    return NextResponse.json(
      { success: false, error: "Failed to generate income statement PDF" },
      { status: 500 }
    )
  }
}
