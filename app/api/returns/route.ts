import { NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/db/connection"
import { Product } from "@/lib/db/models/Product"
import { ReturnModel } from "@/lib/db/models/Return"
import { requireAuth } from "@/lib/auth/middleware"
import { resolveStoreFromRequest } from "@/lib/auth/session"
import { CreateReturnSchema } from "@/lib/db/validators/return"
import { syncLowStockAlert } from "@/lib/db/alerts"

type ProductDocumentLike = {
  _id: { toString(): string }
  name: string
  sku: string
  unit?: string
  quantity: number
  price: number
  costPrice?: number
  lowStockThreshold?: number
}

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
    const returns = await ReturnModel.find({ store }).sort({ createdAt: -1 })

    return NextResponse.json({ success: true, data: returns })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to fetch returns" },
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

    const payload = CreateReturnSchema.parse(await request.json())

    await connectToDatabase()

    const productIds = Array.from(
      new Set(
        payload.returnItems.map((item) => item.productId)
      )
    )

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

    let totalReturnAmount = 0
    const returnItems = payload.returnItems.map((item) => {
      const product = productMap.get(item.productId) as ProductDocumentLike | undefined
      if (!product) {
        throw new Error("Product not found")
      }

      const lineTotal = item.unitPrice * item.quantity
      totalReturnAmount += lineTotal

      return {
        productId: product._id,
        name: product.name,
        sku: product.sku,
        unit: product.unit ?? "pcs",
        quantity: item.quantity,
        basePrice: product.costPrice ?? product.price,
        unitPrice: item.unitPrice,
        lineTotal,
      }
    })

    const netChanges = new Map<string, number>()

    payload.returnItems.forEach((item) => {
      const current = netChanges.get(item.productId) ?? 0
      netChanges.set(item.productId, current + item.quantity)
    })

    const stockUpdates = Array.from(netChanges.entries()).map(
      ([productId, change]) => ({
        productId,
        change,
      })
    )

    await Product.bulkWrite(
      stockUpdates.map((entry) => ({
        updateOne: {
          filter: { _id: entry.productId, store },
          update: { $inc: { quantity: entry.change } },
        },
      }))
    )

    let createdReturn
    try {
      createdReturn = await ReturnModel.create({
        store,
        returnItems,
        replacementItems: [],
        totalReturnAmount,
        totalReplacementAmount: 0,
        createdBy: session.userId,
        notes: payload.notes?.trim() ?? "",
      })
    } catch (error) {
      await Product.bulkWrite(
        stockUpdates.map((entry) => ({
          updateOne: {
            filter: { _id: entry.productId, store },
            update: { $inc: { quantity: -entry.change } },
          },
        }))
      )
      throw error
    }

    try {
      await Promise.all(
        Array.from(netChanges.entries()).map(async ([productId, change]) => {
          const product = productMap.get(productId) as ProductDocumentLike | undefined
          if (!product) return
          await syncLowStockAlert({
            store,
            productId,
            name: product.name,
            sku: product.sku,
            quantity: product.quantity + change,
            threshold: product.lowStockThreshold ?? 0,
          })
        })
      )
    } catch (error) {
      console.error("[Low Stock Alert Sync Error]", error)
    }

    return NextResponse.json(
      { success: true, data: createdReturn },
      { status: 201 }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create return"
    return NextResponse.json(
      { success: false, error: message },
      { status: 400 }
    )
  }
}
