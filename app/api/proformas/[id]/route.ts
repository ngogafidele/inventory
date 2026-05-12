import { NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/db/connection"
import { requireAdmin, requireAuth } from "@/lib/auth/middleware"
import { resolveStoreFromRequest } from "@/lib/auth/session"
import { Proforma } from "@/lib/db/models/Proforma"
import { UpdateProformaSchema } from "@/lib/db/validators/proforma"
import { ZodError } from "zod"

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
    const proforma = await Proforma.findOne({ _id: id, storeId: store })

    if (!proforma) {
      return NextResponse.json(
        { success: false, error: "Proforma not found" },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, data: proforma })
  } catch {
    return NextResponse.json(
      { success: false, error: "Failed to fetch proforma" },
      { status: 500 }
    )
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
    const proforma = await Proforma.findOneAndDelete({ _id: id, storeId: store })

    if (!proforma) {
      return NextResponse.json(
        { success: false, error: "Proforma not found" },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json(
      { success: false, error: "Failed to delete proforma" },
      { status: 400 }
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
    const payload = UpdateProformaSchema.parse(await request.json())
    const items = payload.items.map((item) => {
      const lineTotal = item.quantity * item.unitPrice
      return {
        description: item.description,
        unit: item.unit ?? "pcs",
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        lineTotal,
      }
    })
    const totalAmount = items.reduce((sum, item) => sum + item.lineTotal, 0)

    await connectToDatabase()
    const proforma = await Proforma.findOneAndUpdate(
      { _id: id, storeId: store },
      {
        customerName: payload.customerName,
        customerEmail: payload.customerEmail ?? "",
        customerPhone: payload.customerPhone ?? "",
        items,
        totalAmount,
        expiresAt: payload.expiresAt ? new Date(payload.expiresAt) : undefined,
      },
      { returnDocument: "after", runValidators: true }
    )

    if (!proforma) {
      return NextResponse.json(
        { success: false, error: "Proforma not found" },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, data: proforma })
  } catch (error) {
    const message =
      error instanceof ZodError
        ? error.issues
            .map((issue) => {
              const field = issue.path.join(".")
              return field ? `${field}: ${issue.message}` : issue.message
            })
            .join("; ") || "Invalid input"
        : "Failed to update proforma"
    return NextResponse.json({ success: false, error: message }, { status: 400 })
  }
}
