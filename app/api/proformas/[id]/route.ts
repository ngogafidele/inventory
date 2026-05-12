import { NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/db/connection"
import { requireAdmin, requireAuth } from "@/lib/auth/middleware"
import { resolveStoreFromRequest } from "@/lib/auth/session"
import { Proforma } from "@/lib/db/models/Proforma"

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
