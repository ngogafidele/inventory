import { NextRequest, NextResponse } from "next/server"
import { ZodError } from "zod"
import { connectToDatabase } from "@/lib/db/connection"
import { Expense } from "@/lib/db/models/Expense"
import { requireAuth } from "@/lib/auth/middleware"
import { resolveStoreFromRequest } from "@/lib/auth/session"
import { CreateExpenseSchema } from "@/lib/db/validators/expense"
import { parseKigaliDateInput } from "@/lib/utils/time"

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

    await connectToDatabase()
    const expenses = await Expense.find({ store }).sort({ date: -1 })

    return NextResponse.json({ success: true, data: expenses })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to fetch expenses" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
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

    const payload = CreateExpenseSchema.parse(await request.json())
    const date = parseKigaliDateInput(payload.date)
    if (!date) {
      return NextResponse.json(
        { success: false, error: "Invalid expense date." },
        { status: 400 }
      )
    }

    await connectToDatabase()
    const expense = await Expense.create({
      store,
      description: payload.description.trim(),
      amount: payload.amount,
      category: payload.category?.trim() ?? "",
      paymentMethod: payload.paymentMethod,
      date,
      notes: payload.notes?.trim() ?? "",
      createdBy: session.userId,
    })

    return NextResponse.json(
      { success: true, data: expense },
      { status: 201 }
    )
  } catch (error) {
    console.error("[Expenses Create Error]", error)
    if (error instanceof ZodError) {
      return NextResponse.json(
        { success: false, error: error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      )
    }
    if (process.env.NODE_ENV !== "production" && error instanceof Error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { success: false, error: "Failed to create expense" },
      { status: 400 }
    )
  }
}
