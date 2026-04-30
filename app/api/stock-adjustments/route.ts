import { NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/db/connection"
import { Product } from "@/lib/db/models/Product"
import { StockAdjustment } from "@/lib/db/models/StockAdjustment"
import { requireAuth } from "@/lib/auth/middleware"
import { resolveStoreFromRequest } from "@/lib/auth/session"
import { CreateStockAdjustmentSchema } from "@/lib/db/validators/stock-adjustment"
import { syncLowStockAlert } from "@/lib/db/alerts"

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

    const payload = CreateStockAdjustmentSchema.parse(await request.json())

    await connectToDatabase()
    const product = await Product.findOne({ _id: payload.productId, store })

    if (!product) {
      return NextResponse.json(
        { success: false, error: "Product not found" },
        { status: 404 }
      )
    }

    const newQuantity = product.quantity + payload.quantityChange
    if (newQuantity < 0) {
      return NextResponse.json(
        { success: false, error: "Adjustment would make stock negative" },
        { status: 400 }
      )
    }

    product.quantity = newQuantity
    await product.save()

    const adjustment = await StockAdjustment.create({
      store,
      productId: product._id,
      sku: product.sku,
      quantityChange: payload.quantityChange,
      reason: payload.reason,
      adjustedBy: session.userId,
    })

    await syncLowStockAlert({
      store,
      productId: product._id.toString(),
      name: product.name,
      sku: product.sku,
      quantity: product.quantity,
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
