// Rejects a product request, keeping it with the reason for the submitter.
import { NextRequest, NextResponse } from "next/server"
import { ZodError } from "zod"
import { connectToDatabase } from "@/lib/db/connection"
import { ProductRequest } from "@/lib/db/models/ProductRequest"
import { requireAdmin } from "@/lib/auth/middleware"
import { resolveStoreFromRequest } from "@/lib/auth/session"
import { RejectProductRequestSchema } from "@/lib/db/validators/product"

export async function POST(
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
        { success: false, error: "Invalid store" },
        { status: 400 }
      )
    }

    const { id } = await context.params
    const { reason } = RejectProductRequestSchema.parse(await request.json())

    await connectToDatabase()

    const rejected = await ProductRequest.findOneAndUpdate(
      { _id: id, store, status: "pending" },
      {
        status: "rejected",
        reviewedBy: session.userId,
        reviewedAt: new Date(),
        rejectionReason: reason,
      },
      { returnDocument: "after" }
    )

    if (!rejected) {
      return NextResponse.json(
        {
          success: false,
          error: "This request was already reviewed or withdrawn.",
        },
        { status: 409 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { success: false, error: error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { success: false, error: "Failed to reject product" },
      { status: 400 }
    )
  }
}
