// Records supplier receipts for a product and increases available stock.
import { NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/db/connection"
import { Product } from "@/lib/db/models/Product"
import { ProductReceipt } from "@/lib/db/models/ProductReceipt"
import { requireAdmin } from "@/lib/auth/middleware"
import { resolveStoreFromRequest } from "@/lib/auth/session"
import { syncLowStockAlert } from "@/lib/db/alerts"
import { CreateProductReceiptSchema } from "@/lib/db/validators/product-receipt"
import { parseKigaliDateInput } from "@/lib/utils/time"
import { ZodError } from "zod"

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
        { success: false, error: "Access denied" },
        { status: 403 }
      )
    }

    const { id } = await context.params
    const payload = CreateProductReceiptSchema.parse(await request.json())
    const receivedAt = parseKigaliDateInput(payload.receivedAt)
    if (!receivedAt) {
      return NextResponse.json(
        { success: false, error: "Invalid received date." },
        { status: 400 }
      )
    }

    const totalCost = payload.quantity * payload.unitCost

    const db = await connectToDatabase()
    const dbSession = await db.startSession()
    let product
    let receipt

    try {
      await dbSession.withTransaction(async () => {
        product = await Product.findOneAndUpdate(
          { _id: id, store },
          {
            $inc: { quantity: payload.quantity },
            $set: { costPrice: payload.unitCost },
          },
          { returnDocument: "after", runValidators: true, session: dbSession }
        )

        if (!product) return

        const receipts = await ProductReceipt.create(
          [
            {
              store,
              productId: product._id,
              sku: product.sku,
              supplierName: payload.supplierName,
              supplierPhone: payload.supplierPhone,
              quantity: payload.quantity,
              unitCost: payload.unitCost,
              totalCost,
              receivedAt,
              receivedBy: session.userId,
            },
          ],
          { session: dbSession }
        )
        receipt = receipts[0]
      })
    } finally {
      await dbSession.endSession()
    }

    if (!product) {
      return NextResponse.json(
        { success: false, error: "Product not found" },
        { status: 404 }
      )
    }

    try {
      await syncLowStockAlert({
        store,
        productId: product._id.toString(),
        name: product.name,
        sku: product.sku,
        quantity: product.quantity,
        threshold: product.lowStockThreshold ?? 0,
      })
    } catch (error) {
      console.error("[Low Stock Alert Sync Error]", error)
    }

    return NextResponse.json(
      { success: true, data: { product, receipt } },
      { status: 201 }
    )
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { success: false, error: error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { success: false, error: "Failed to receive product" },
      { status: 400 }
    )
  }
}
