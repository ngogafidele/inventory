import { NextRequest, NextResponse } from "next/server"
import { ZodError } from "zod"
import { connectToDatabase } from "@/lib/db/connection"
import { Expense } from "@/lib/db/models/Expense"
import { requireAuth } from "@/lib/auth/middleware"
import { resolveStoreFromRequest } from "@/lib/auth/session"
import { UpdateExpenseSchema } from "@/lib/db/validators/expense"
import { parseKigaliDateInput } from "@/lib/utils/time"

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
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

    const { id } = await context.params
    const payload = UpdateExpenseSchema.parse(await request.json())

    const updateInput: Record<string, unknown> = {
      ...payload,
    }

    if (payload.description) {
      updateInput.description = payload.description.trim()
    }

    if (typeof payload.category === "string") {
      updateInput.category = payload.category.trim()
    }

    if (typeof payload.notes === "string") {
      updateInput.notes = payload.notes.trim()
    }

    if (payload.date) {
      const date = parseKigaliDateInput(payload.date)
      if (!date) {
        return NextResponse.json(
          { success: false, error: "Invalid expense date." },
          { status: 400 }
        )
      }
      updateInput.date = date
    }

    await connectToDatabase()
    const expense = await Expense.findOneAndUpdate(
      { _id: id, store },
      updateInput,
      { returnDocument: "after", runValidators: true }
    )

    if (!expense) {
      return NextResponse.json(
        { success: false, error: "Expense not found" },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, data: expense })
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { success: false, error: error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { success: false, error: "Failed to update expense" },
      { status: 400 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
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

    const { id } = await context.params

    await connectToDatabase()
    const expense = await Expense.findOneAndDelete({ _id: id, store })

    if (!expense) {
      return NextResponse.json(
        { success: false, error: "Expense not found" },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to delete expense" },
      { status: 400 }
    )
  }
}
