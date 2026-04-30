import { NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/db/connection"
import { Product } from "@/lib/db/models/Product"
import { Sale } from "@/lib/db/models/Sale"
import { requireAuth } from "@/lib/auth/middleware"
import { resolveStoreFromRequest } from "@/lib/auth/session"
import { CreateSaleSchema } from "@/lib/db/validators/sale"
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
    const sales = await Sale.find({ store }).sort({ createdAt: -1 })

    return NextResponse.json({ success: true, data: sales })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to fetch sales" },
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

    const payload = CreateSaleSchema.parse(await request.json())

    await connectToDatabase()

    const productIds = payload.items.map((item) => item.productId)
    const products = await Product.find({ _id: { $in: productIds }, store })

    if (products.length !== productIds.length) {
      return NextResponse.json(
        { success: false, error: "One or more products not found" },
        { status: 404 }
      )
    }

    const productMap = new Map(
      products.map((product) => [product._id.toString(), product])
    )

    const requestedQuantities = new Map<string, number>()
    payload.items.forEach((item) => {
      const current = requestedQuantities.get(item.productId) ?? 0
      requestedQuantities.set(item.productId, current + item.quantity)
    })

    for (const [productId, quantity] of requestedQuantities.entries()) {
      const product = productMap.get(productId)
      if (!product) {
        throw new Error("Product not found")
      }
      if (product.quantity < quantity) {
        throw new Error(`Insufficient stock for ${product.name}`)
      }
    }

    let totalAmount = 0
    const saleItems = payload.items.map((item) => {
      const product = productMap.get(item.productId)
      if (!product) {
        throw new Error("Product not found")
      }

      const lineTotal = item.sellingPrice * item.quantity
      totalAmount += lineTotal

      return {
        productId: product._id,
        name: product.name,
        sku: product.sku,
        unit: product.unit ?? "pcs",
        quantity: item.quantity,
        basePrice: product.costPrice ?? product.price,
        sellingPrice: item.sellingPrice,
        lineTotal,
      }
    })

    await Product.bulkWrite(
      payload.items.map((item) => ({
        updateOne: {
          filter: { _id: item.productId, store },
          update: { $inc: { quantity: -item.quantity } },
        },
      }))
    )

    const sale = await Sale.create({
      store,
      items: saleItems,
      totalAmount,
      createdBy: session.userId,
      notes: payload.notes ?? "",
    })

    await Promise.all(
      payload.items.map(async (item) => {
        const product = productMap.get(item.productId)
        if (!product) return
        const newQuantity = product.quantity - item.quantity
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

    return NextResponse.json({ success: true, data: sale }, { status: 201 })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create sale"
    return NextResponse.json({ success: false, error: message }, { status: 400 })
  }
}
