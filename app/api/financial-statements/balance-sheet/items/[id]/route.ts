// Revises or retires a manual balance sheet line item (admin only).
// The [id] segment is the item's stable groupId, shared across all its versions.
import { NextRequest, NextResponse } from "next/server"
import mongoose from "mongoose"
import { ZodError } from "zod"
import { connectToDatabase } from "@/lib/db/connection"
import { requireAdmin } from "@/lib/auth/middleware"
import { resolveStoreFromRequest } from "@/lib/auth/session"
import { BalanceSheetItem } from "@/lib/db/models/BalanceSheetItem"
import {
  BalanceSheetItemDeleteSchema,
  BalanceSheetItemSchema,
} from "@/lib/db/validators/balance-sheet-item"
import { parseKigaliDateInput } from "@/lib/utils/time"

async function resolveContext(request: NextRequest, id: string) {
  const { authorized, session } = await requireAdmin(request)
  if (!authorized || !session) {
    return {
      error: NextResponse.json(
        { success: false, error: "Admin only" },
        { status: 403 }
      ),
    }
  }

  const store = resolveStoreFromRequest(request, session)
  if (!store) {
    return {
      error: NextResponse.json(
        { success: false, error: "Access denied" },
        { status: 403 }
      ),
    }
  }

  if (!mongoose.isValidObjectId(id)) {
    return {
      error: NextResponse.json(
        { success: false, error: "Item not found" },
        { status: 404 }
      ),
    }
  }

  return { session, store }
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params
    const resolved = await resolveContext(request, id)
    if (resolved.error) return resolved.error
    const { session, store } = resolved

    const payload = BalanceSheetItemSchema.parse(await request.json())
    const effectiveDate = parseKigaliDateInput(payload.effectiveDate)
    if (!effectiveDate) {
      return NextResponse.json(
        { success: false, error: "Enter a valid effective date" },
        { status: 400 }
      )
    }

    await connectToDatabase()

    const existing = await BalanceSheetItem.findOne({ store, groupId: id })
    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Item not found" },
        { status: 404 }
      )
    }

    // Appended as a new version so earlier sheets keep the previous figures.
    await BalanceSheetItem.create({
      store,
      groupId: id,
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
        groupId: id,
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
      { success: false, error: "Failed to update balance sheet item" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params
    const resolved = await resolveContext(request, id)
    if (resolved.error) return resolved.error
    const { session, store } = resolved

    const body = await request.json().catch(() => ({}))
    const payload = BalanceSheetItemDeleteSchema.parse(body ?? {})

    await connectToDatabase()

    const existing = await BalanceSheetItem.findOne({ store, groupId: id })
    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Item not found" },
        { status: 404 }
      )
    }

    const effectiveDate = payload.effectiveDate
      ? parseKigaliDateInput(payload.effectiveDate)
      : new Date()
    if (!effectiveDate) {
      return NextResponse.json(
        { success: false, error: "Enter a valid effective date" },
        { status: 400 }
      )
    }

    // A tombstone version, so sheets before this date still include the item.
    await BalanceSheetItem.create({
      store,
      groupId: id,
      category: existing.category,
      name: existing.name,
      amount: existing.amount,
      effectiveDate,
      status: "deleted",
      notes: existing.notes ?? "",
      createdBy: session.userId,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { success: false, error: "Enter a valid effective date" },
        { status: 400 }
      )
    }

    console.error("[Balance Sheet Item Error]", error)
    return NextResponse.json(
      { success: false, error: "Failed to remove balance sheet item" },
      { status: 500 }
    )
  }
}
