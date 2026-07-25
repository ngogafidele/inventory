// Restores a soft-deleted sale, re-applying its stock movement and invoice.
import { NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/db/connection"
import { Invoice } from "@/lib/db/models/Invoice"
import { Product } from "@/lib/db/models/Product"
import { Sale } from "@/lib/db/models/Sale"
import { requireAdmin } from "@/lib/auth/middleware"
import { resolveStoreFromRequest } from "@/lib/auth/session"
import { syncLowStockAlert } from "@/lib/db/alerts"

type SaleItemForRestore = {
  productId: { toString(): string }
  quantity: number
}

type ProductForRestore = {
  _id: { toString(): string }
  name: string
  sku: string
  quantity: number
  lowStockThreshold?: number
}

function getRequiredQuantities(items: SaleItemForRestore[]) {
  const quantities = new Map<string, number>()
  items.forEach((item) => {
    const productId = item.productId.toString()
    quantities.set(productId, (quantities.get(productId) ?? 0) + item.quantity)
  })
  return quantities
}

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

    const db = await connectToDatabase()
    const sale = await Sale.findOne({ _id: id, store })

    if (!sale) {
      return NextResponse.json(
        { success: false, error: "Sale not found" },
        { status: 404 }
      )
    }

    if (!sale.deletedAt) {
      return NextResponse.json(
        { success: false, error: "Sale is not deleted" },
        { status: 400 }
      )
    }

    const requiredQuantities = getRequiredQuantities(
      sale.items as SaleItemForRestore[]
    )
    const productIds = Array.from(requiredQuantities.keys())
    const products = await Product.find({
      _id: { $in: productIds },
      store,
    }).lean<ProductForRestore[]>()
    const productMap = new Map(
      products.map((product) => [product._id.toString(), product])
    )

    // Restoring re-applies the original stock deduction, so every product
    // must still exist and hold enough quantity to cover the sale.
    if (products.length !== productIds.length) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Cannot restore this sale because one or more products no longer exist.",
        },
        { status: 409 }
      )
    }

    for (const [productId, quantity] of requiredQuantities.entries()) {
      const product = productMap.get(productId)
      if (!product || product.quantity < quantity) {
        return NextResponse.json(
          {
            success: false,
            error: product
              ? `Insufficient stock to restore ${product.name}.`
              : "Cannot restore this sale because a product no longer exists.",
          },
          { status: 400 }
        )
      }
    }

    const dbSession = await db.startSession()
    try {
      await dbSession.withTransaction(async () => {
        for (const [productId, quantity] of requiredQuantities.entries()) {
          const result = await Product.updateOne(
            { _id: productId, store, quantity: { $gte: quantity } },
            { $inc: { quantity: -quantity } },
            { session: dbSession }
          )

          if (result.modifiedCount !== 1) {
            const product = productMap.get(productId)
            throw new Error(
              product
                ? `Insufficient stock to restore ${product.name}.`
                : "Cannot restore this sale because a product no longer exists."
            )
          }
        }

        await Sale.updateOne(
          { _id: sale._id, store },
          { $set: { deletedAt: null, deletedBy: null } },
          { session: dbSession }
        )
        // Revive the invoice that was hidden alongside the sale.
        await Invoice.updateMany(
          { saleId: sale._id, store, deletedAt: { $ne: null } },
          { $set: { deletedAt: null, deletedBy: null } },
          { session: dbSession }
        )
      })
    } finally {
      await dbSession.endSession()
    }

    try {
      await Promise.all(
        Array.from(requiredQuantities.entries()).map(
          async ([productId, quantity]) => {
            const product = productMap.get(productId)
            if (!product) return
            await syncLowStockAlert({
              store,
              productId,
              name: product.name,
              sku: product.sku,
              quantity: product.quantity - quantity,
              threshold: product.lowStockThreshold ?? 0,
            })
          }
        )
      )
    } catch (error) {
      console.error("[Low Stock Alert Sync Error]", error)
    }

    const restored = await Sale.findOne({ _id: sale._id, store })

    return NextResponse.json({ success: true, data: restored })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to restore sale"
    return NextResponse.json({ success: false, error: message }, { status: 400 })
  }
}
