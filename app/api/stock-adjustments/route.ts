import { NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/db/connection"
import { Product } from "@/lib/db/models/Product"
import { StockAdjustment } from "@/lib/db/models/StockAdjustment"
import { requireAdmin } from "@/lib/auth/middleware"
import { resolveStoreFromRequest } from "@/lib/auth/session"
import { CreateStockAdjustmentSchema } from "@/lib/db/validators/stock-adjustment"
import { syncLowStockAlert } from "@/lib/db/alerts"

export async function GET(request: NextRequest) {
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

    await connectToDatabase()
    const adjustments = await StockAdjustment.find({ store }).sort({ createdAt: -1 })

    return NextResponse.json({ success: true, data: adjustments })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to fetch adjustments" },
      { status: 500 }
    )
  }
}

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

    const payload = CreateStockAdjustmentSchema.parse(await request.json())

    await connectToDatabase()
    const product = await Product.findOne({ _id: payload.productId, store })

    if (!product) {
      return NextResponse.json(
        { success: false, error: "Product not found" },
        { status: 404 }
      )
    }

    const updatedProduct = await Product.findOneAndUpdate(
      {
        _id: payload.productId,
        store,
        quantity: { $gte: Math.max(0, -payload.quantityChange) },
      },
      { $inc: { quantity: payload.quantityChange } },
      { returnDocument: "after", runValidators: true }
    )

    if (!updatedProduct) {
      return NextResponse.json(
        { success: false, error: "Adjustment would make stock negative" },
        { status: 400 }
      )
    }

    const adjustment = await StockAdjustment.create({
      store,
      productId: updatedProduct._id,
      sku: updatedProduct.sku,
      quantityChange: payload.quantityChange,
      reason: payload.reason,
      adjustedBy: session.userId,
    })

    await syncLowStockAlert({
      store,
      productId: updatedProduct._id.toString(),
      name: updatedProduct.name,
      sku: updatedProduct.sku,
      quantity: updatedProduct.quantity,
      threshold: updatedProduct.lowStockThreshold ?? 0,
    })

    return NextResponse.json(
      { success: true, data: adjustment },
      { status: 201 }
    )
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to create adjustment" },
      { status: 400 }
    )
  }
}
