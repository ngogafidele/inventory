import { NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/db/connection"
import { Product } from "@/lib/db/models/Product"
import { Sale } from "@/lib/db/models/Sale"
import { requireAdmin, requireAuth } from "@/lib/auth/middleware"
import { resolveStoreFromRequest } from "@/lib/auth/session"
import { syncLowStockAlert } from "@/lib/db/alerts"

type SaleItemForRestock = {
  productId: { toString(): string }
  quantity: number
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
    const sale = await Sale.findOne({ _id: id, store })

    if (!sale) {
      return NextResponse.json(
        { success: false, error: "Sale not found" },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, data: sale })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to fetch sale" },
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
    const sale = await Sale.findOne({ _id: id, store })

    if (!sale) {
      return NextResponse.json(
        { success: false, error: "Sale not found" },
        { status: 404 }
      )
    }

    const saleItems = sale.items as SaleItemForRestock[]
    const productIds = saleItems.map((item) => item.productId)
    const products = await Product.find({ _id: { $in: productIds }, store })
    const productMap = new Map(
      products.map((product) => [product._id.toString(), product])
    )

    await Product.bulkWrite(
      saleItems.map((item) => ({
        updateOne: {
          filter: { _id: item.productId, store },
          update: { $inc: { quantity: item.quantity } },
        },
      }))
    )

    await Promise.all(
      saleItems.map(async (item) => {
        const product = productMap.get(item.productId.toString())
        if (!product) return
        const newQuantity = product.quantity + item.quantity
        await syncLowStockAlert({
          store,
          productId: product._id.toString(),
          name: product.name,
          sku: product.sku,
          quantity: newQuantity,
          threshold: product.lowStockThreshold ?? 0,
        })
      })
    )

    await sale.deleteOne()

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to delete sale" },
      { status: 400 }
    )
  }
}
