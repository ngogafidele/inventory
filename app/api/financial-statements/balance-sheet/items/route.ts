// Creates manual balance sheet line items (admin only).
//
// Every write appends a new version rather than mutating one, so a sheet for a past
// date keeps the figures that were in effect then.
import { NextRequest, NextResponse } from "next/server"
import mongoose from "mongoose"
import { ZodError } from "zod"
import { connectToDatabase } from "@/lib/db/connection"
import { requireAdmin } from "@/lib/auth/middleware"
import { resolveStoreFromRequest } from "@/lib/auth/session"
import { BalanceSheetItem } from "@/lib/db/models/BalanceSheetItem"
import { BalanceSheetItemSchema } from "@/lib/db/validators/balance-sheet-item"
import { parseKigaliDateInput } from "@/lib/utils/time"

export async function POST(request: NextRequest) {
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

    const payload = BalanceSheetItemSchema.parse(await request.json())
    const effectiveDate = parseKigaliDateInput(payload.effectiveDate)
    if (!effectiveDate) {
      return NextResponse.json(
        { success: false, error: "Enter a valid effective date" },
        { status: 400 }
      )
    }

    await connectToDatabase()

    // A new item starts its own version chain; groupId is its stable identity.
    const groupId = new mongoose.Types.ObjectId()
    await BalanceSheetItem.create({
      store,
      groupId,
      category: payload.category,
      name: payload.name,
      amount: payload.amount,
      effectiveDate,
      status: "active",
      notes: payload.notes ?? "",
      createdBy: session.userId,
    })

    return NextResponse.json({
      success: true,
      data: {
        groupId: groupId.toString(),
        category: payload.category,
        name: payload.name,
        amount: payload.amount,
        effectiveDate: payload.effectiveDate,
        notes: payload.notes ?? "",
      },
    })
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { success: false, error: "Check the item details and try again" },
        { status: 400 }
      )
    }

    console.error("[Balance Sheet Item Error]", error)
    return NextResponse.json(
      { success: false, error: "Failed to save balance sheet item" },
      { status: 500 }
    )
  }
}
