// Lists and records customer returns that restore branch inventory.
import { NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/db/connection"
import { Product } from "@/lib/db/models/Product"
import { ReturnModel } from "@/lib/db/models/Return"
import { Sale } from "@/lib/db/models/Sale"
import { Types } from "mongoose"
import { requireAuth } from "@/lib/auth/middleware"
import { resolveStoreFromRequest } from "@/lib/auth/session"
import { CreateReturnSchema } from "@/lib/db/validators/return"
import { syncLowStockAlert } from "@/lib/db/alerts"
import { reconcileLoanAfterReturn } from "@/lib/db/loan-reconciliation"

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

type SaleForReturn = {
  _id: Types.ObjectId
  createdAt?: Date
  items: Array<{
    productId: { toString(): string }
    name: string
    sku: string
    unit?: string
    quantity: number
    basePrice: number
    sellingPrice: number
  }>
}

type PriorReturn = {
  returnItems: Array<{ productId: { toString(): string }; quantity: number }>
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

    const db = await connectToDatabase()

    // A return must reverse a real, active sale in this store.
    const sale = await Sale.findOne({
      _id: payload.saleId,
      store,
      deletedAt: null,
    }).lean<SaleForReturn | null>()

    if (!sale) {
      return NextResponse.json(
        { success: false, error: "Sale not found" },
        { status: 404 }
      )
    }

    // What the sale sold, aggregated per product.
    const soldMap = new Map<
      string,
      { name: string; sku: string; unit: string; basePrice: number; soldQuantity: number }
    >()
    sale.items.forEach((item) => {
      const key = item.productId.toString()
      const existing = soldMap.get(key)
      if (existing) {
        existing.soldQuantity += item.quantity
      } else {
        soldMap.set(key, {
          name: item.name,
          sku: item.sku,
          unit: item.unit ?? "pcs",
          basePrice: item.basePrice,
          soldQuantity: item.quantity,
        })
      }
    })

    // Quantities already returned against this sale cap what remains returnable.
    const priorReturns = await ReturnModel.find({ store, saleId: sale._id })
      .select("returnItems")
      .lean<PriorReturn[]>()
    const alreadyReturned = new Map<string, number>()
    priorReturns.forEach((entry) => {
      entry.returnItems.forEach((item) => {
        const key = item.productId.toString()
        alreadyReturned.set(key, (alreadyReturned.get(key) ?? 0) + item.quantity)
      })
    })

    // Requested quantities per product across all lines.
    const requested = new Map<string, number>()
    payload.returnItems.forEach((item) => {
      requested.set(
        item.productId,
        (requested.get(item.productId) ?? 0) + item.quantity
      )
    })

    for (const [productId, quantity] of requested.entries()) {
      const sold = soldMap.get(productId)
      if (!sold) {
        return NextResponse.json(
          { success: false, error: "A returned item was not part of the selected sale." },
          { status: 400 }
        )
      }
      const remaining = sold.soldQuantity - (alreadyReturned.get(productId) ?? 0)
      if (quantity > remaining) {
        return NextResponse.json(
          {
            success: false,
            error: `Cannot return more than was sold for ${sold.name}. ${Math.max(0, remaining)} remaining.`,
          },
          { status: 400 }
        )
      }
    }

    // Load the products so stock can be restored and low-stock alerts resynced.
    const productIds = Array.from(requested.keys())
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
      const sold = soldMap.get(item.productId)
      if (!sold) {
        throw new Error("A returned item was not part of the selected sale.")
      }

      const lineTotal = item.unitPrice * item.quantity
      totalReturnAmount += lineTotal

      return {
        productId: item.productId,
        name: sold.name,
        sku: sold.sku,
        unit: sold.unit,
        quantity: item.quantity,
        // Cost basis comes from the sale so report gross profit stays consistent.
        basePrice: sold.basePrice,
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

    let createdReturn
    const dbSession = await db.startSession()
    try {
      await dbSession.withTransaction(async () => {
        const stockResult = await Product.bulkWrite(
          stockUpdates.map((entry) => ({
            updateOne: {
              filter: { _id: entry.productId, store },
              update: { $inc: { quantity: entry.change } },
            },
          })),
          { session: dbSession }
        )
        if (stockResult.modifiedCount !== stockUpdates.length) {
          throw new Error("One or more products not found")
        }

        const createdReturns = await ReturnModel.create(
          [
            {
              store,
              saleId: sale._id,
              // Denormalized so reports attribute the return to the sale's period.
              saleDate: sale.createdAt ?? new Date(),
              returnItems,
              replacementItems: [],
              totalReturnAmount,
              totalReplacementAmount: 0,
              createdBy: session.userId,
              notes: payload.notes?.trim() ?? "",
            },
          ],
          { session: dbSession }
        )
        createdReturn = createdReturns[0]
        await reconcileLoanAfterReturn(sale._id, store, dbSession)
      })
    } finally {
      await dbSession.endSession()
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
