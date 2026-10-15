// Lets the submitter withdraw a product request that is still pending.
import { NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/db/connection"
import { ProductRequest } from "@/lib/db/models/ProductRequest"
import { requireAuth } from "@/lib/auth/middleware"
import { resolveStoreFromRequest } from "@/lib/auth/session"

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

    // Only a pending request can be withdrawn; a reviewed one is the record
    // of the admin's decision. Admins reject rather than withdraw.
    const removed = await ProductRequest.findOneAndDelete({
      _id: id,
      store,
      status: "pending",
      submittedBy: session.userId,
    })

    if (!removed) {
      return NextResponse.json(
        { success: false, error: "Request not found or already reviewed" },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json(
      { success: false, error: "Failed to withdraw request" },
      { status: 400 }
    )
  }
}
