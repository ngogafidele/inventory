// Retrieves, updates, or removes a branch delivery note.
import { NextRequest, NextResponse } from "next/server"
import { ZodError } from "zod"
import { connectToDatabase } from "@/lib/db/connection"
import { requireAdmin, requireAuth } from "@/lib/auth/middleware"
import { resolveStoreFromRequest } from "@/lib/auth/session"
import type { StoreKey } from "@/lib/auth/session"
import { DeliveryNote } from "@/lib/db/models/DeliveryNote"
import { Sale } from "@/lib/db/models/Sale"
import { UpdateDeliveryNoteSchema } from "@/lib/db/validators/delivery-note"

function formatValidationError(error: unknown, fallback: string) {
  if (!(error instanceof ZodError)) return fallback

  return (
    error.issues
      .map((issue) => {
        const field = issue.path.join(".")
        return field ? `${field}: ${issue.message}` : issue.message
      })
      .join("; ") || "Invalid input"
  )
}

async function buildItemsFromSales(saleIds: string[], store: StoreKey) {
  const sales = await Sale.find({
    _id: { $in: saleIds },
    store,
    deletedAt: null,
  })

  if (sales.length !== saleIds.length) {
    return null
  }

  return sales.flatMap((sale) =>
    sale.items.map((item) => ({
      description: item.name,
      sku: item.sku,
      unit: item.unit ?? "pcs",
      quantity: item.quantity,
    }))
  )
}

export async function GET(
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
    const deliveryNote = await DeliveryNote.findOne({ _id: id, store })

    if (!deliveryNote) {
      return NextResponse.json(
        { success: false, error: "Delivery note not found" },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, data: deliveryNote })
  } catch {
    return NextResponse.json(
      { success: false, error: "Failed to fetch delivery note" },
      { status: 500 }
    )
  }
}

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

    if (!session.isAdmin && session.role === "staff") {
      return NextResponse.json(
        { success: false, error: "Insufficient permissions" },
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

    const { id } = await context.params
    const payload = UpdateDeliveryNoteSchema.parse(await request.json())
    await connectToDatabase()

    const update: Record<string, unknown> = {
      ...payload,
      ...(payload.deliveryDate
        ? { deliveryDate: new Date(payload.deliveryDate) }
        : {}),
      ...(payload.deliveredByDate
        ? { deliveredByDate: new Date(payload.deliveredByDate) }
        : {}),
    }

    if (payload.saleIds) {
      const items = await buildItemsFromSales(payload.saleIds, store)
      if (!items) {
        return NextResponse.json(
          { success: false, error: "One or more sales were not found" },
          { status: 404 }
        )
      }
      update.items = items
    }

    const deliveryNote = await DeliveryNote.findOneAndUpdate(
      { _id: id, store },
      update,
      { returnDocument: "after", runValidators: true }
    )

    if (!deliveryNote) {
      return NextResponse.json(
        { success: false, error: "Delivery note not found" },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, data: deliveryNote })
  } catch (error) {
    const message = formatValidationError(
      error,
      "Failed to update delivery note"
    )
    return NextResponse.json({ success: false, error: message }, { status: 400 })
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
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

    const { id } = await context.params
    await connectToDatabase()
    const deliveryNote = await DeliveryNote.findOneAndDelete({ _id: id, store })

    if (!deliveryNote) {
      return NextResponse.json(
        { success: false, error: "Delivery note not found" },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json(
      { success: false, error: "Failed to delete delivery note" },
      { status: 400 }
    )
  }
}
