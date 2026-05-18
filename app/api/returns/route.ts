import { NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/db/connection"
import { Product } from "@/lib/db/models/Product"
import { ReturnModel } from "@/lib/db/models/Return"
import { requireAuth } from "@/lib/auth/middleware"
import { resolveStoreFromRequest } from "@/lib/auth/session"
import { CreateReturnSchema } from "@/lib/db/validators/return"

const TOTAL_TOLERANCE = 0.01

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
        [...payload.returnItems, ...payload.replacementItems].map(
          (item) => item.productId
        )
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
        unitPrice: item.unitPrice,
        lineTotal,
      }
    })

    let totalReplacementAmount = 0
    const replacementItems = payload.replacementItems.map((item) => {
      const product = productMap.get(item.productId) as ProductDocumentLike | undefined
      if (!product) {
        throw new Error("Product not found")
      }

      const lineTotal = item.unitPrice * item.quantity
      totalReplacementAmount += lineTotal

      return {
        productId: product._id,
        name: product.name,
        sku: product.sku,
        unit: product.unit ?? "pcs",
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        lineTotal,
      }
    })

    if (totalReplacementAmount - totalReturnAmount > TOTAL_TOLERANCE) {
      return NextResponse.json(
        {
          success: false,
          error: "Replacement total cannot exceed the return total.",
        },
        { status: 400 }
      )
    }

    const netChanges = new Map<string, number>()

    payload.returnItems.forEach((item) => {
      const current = netChanges.get(item.productId) ?? 0
      netChanges.set(item.productId, current + item.quantity)
    })

    payload.replacementItems.forEach((item) => {
      const current = netChanges.get(item.productId) ?? 0
      netChanges.set(item.productId, current - item.quantity)
    })

    for (const [productId, change] of netChanges.entries()) {
      const product = productMap.get(productId) as ProductDocumentLike | undefined
      if (!product) {
        throw new Error("Product not found")
      }
      if (product.quantity + change < 0) {
        throw new Error(`Insufficient stock for ${product.name}`)
      }
    }

    await Product.bulkWrite(
      Array.from(netChanges.entries()).map(([productId, change]) => ({
        updateOne: {
          filter: { _id: productId, store },
          update: { $inc: { quantity: change } },
        },
      }))
    )

    const createdReturn = await ReturnModel.create({
      store,
      returnItems,
      replacementItems,
      totalReturnAmount,
      totalReplacementAmount,
      createdBy: session.userId,
      notes: payload.notes?.trim() ?? "",
    })

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
