// Updates or reverses a return while reconciling branch inventory.
import { NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/db/connection"
import { Product } from "@/lib/db/models/Product"
import { ReturnModel } from "@/lib/db/models/Return"
import { Sale } from "@/lib/db/models/Sale"
import { requireAuth } from "@/lib/auth/middleware"
import { resolveStoreFromRequest } from "@/lib/auth/session"
import { verifyActionPassword } from "@/lib/auth/step-up"
import { UpdateReturnSchema } from "@/lib/db/validators/return"
import { syncLowStockAlert } from "@/lib/db/alerts"
import { reconcileLoanAfterReturn } from "@/lib/db/loan-reconciliation"
import {
  buildSaleReturnItems,
  getReturnedByLine,
  getReturnStockEffect,
  getSoldLines,
  ReturnLineError,
} from "@/lib/db/return-lines"
import {
  findUnitOption,
  getBaseUnit,
  roundCost,
  roundMoney,
  toBaseQuantity,
  type PackUnit,
} from "@/lib/utils/units"

type ReturnItemInput = {
  productId: string
  unit?: string
  quantity: number
  unitPrice: number
}

type ProductDocumentLike = {
  _id: { toString(): string }
  name: string
  sku: string
  unit?: string
  packUnits?: PackUnit[]
  quantity: number
  price: number
  costPrice?: number
  lowStockThreshold?: number
}

type SaleForReturn = {
  _id: { toString(): string }
  items: Array<{
    productId: { toString(): string }
    name: string
    sku: string
    unit?: string
    quantity: number
    unitFactor?: number
    baseUnit?: string
    basePrice: number
  }>
}

type PriorReturn = {
  returnItems: Array<{
    productId: { toString(): string }
    unit?: string
    quantity: number
  }>
}

export async function PUT(
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
    const payload = UpdateReturnSchema.parse(await request.json())

    const db = await connectToDatabase()
    const existingReturn = await ReturnModel.findOne({ _id: id, store })
    if (!existingReturn) {
      return NextResponse.json(
        { success: false, error: "Return not found" },
        { status: 404 }
      )
    }

    const returnItemsInput: ReturnItemInput[] = payload.returnItems
      ? payload.returnItems.map((item) => ({
          productId: item.productId,
          unit: item.unit,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        }))
      : existingReturn.returnItems.map((item) => ({
          productId: item.productId.toString(),
          unit: item.unit,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        }))

    const allProductIds = Array.from(
      new Set(
        [
          ...existingReturn.returnItems.map((item) => item.productId.toString()),
          ...existingReturn.replacementItems.map((item) => item.productId.toString()),
          ...returnItemsInput.map((item) => item.productId),
        ]
      )
    )

    const products = await Product.find({
      _id: { $in: allProductIds },
      store,
    })

    if (products.length !== allProductIds.length) {
      return NextResponse.json(
        { success: false, error: "One or more products not found" },
        { status: 404 }
      )
    }

    const productMap = new Map(
      products.map((product) => [product._id.toString(), product])
    )

    // Sale-linked returns stay capped per sale line (product and unit sold),
    // minus other returns against it; legacy returns without a sale keep
    // free-form edits priced from the product.
    const linkedSaleId = existingReturn.saleId
      ? existingReturn.saleId.toString()
      : null
    let returnItems
    let totalReturnAmount = 0
    try {
      if (linkedSaleId) {
        const sale = await Sale.findOne({ _id: linkedSaleId, store }).lean<SaleForReturn | null>()
        if (!sale) {
          return NextResponse.json(
            { success: false, error: "Linked sale not found" },
            { status: 404 }
          )
        }

        const otherReturns = await ReturnModel.find({
          store,
          saleId: linkedSaleId,
          _id: { $ne: existingReturn._id },
        })
          .select("returnItems")
          .lean<PriorReturn[]>()

        const built = buildSaleReturnItems(
          returnItemsInput,
          getSoldLines(sale.items),
          getReturnedByLine(otherReturns)
        )
        returnItems = built.items
        totalReturnAmount = built.totalReturnAmount
      } else {
        returnItems = returnItemsInput.map((item) => {
          const product = productMap.get(item.productId) as ProductDocumentLike | undefined
          if (!product) {
            throw new ReturnLineError("Product not found")
          }
          const unit = findUnitOption(product, item.unit)
          const baseQuantity = unit ? toBaseQuantity(item.quantity, unit.factor) : null
          if (!unit || baseQuantity === null) {
            throw new ReturnLineError(
              `${item.quantity} ${item.unit ?? ""} is not a valid quantity for ${product.name}.`
            )
          }
          const lineTotal = roundMoney(item.unitPrice * item.quantity)
          totalReturnAmount += lineTotal
          return {
            productId: product._id,
            name: product.name,
            sku: product.sku,
            unit: unit.name,
            quantity: item.quantity,
            unitFactor: unit.factor,
            baseQuantity,
            baseUnit: getBaseUnit(product),
            basePrice: roundCost((product.costPrice ?? product.price) * unit.factor),
            unitPrice: item.unitPrice,
            lineTotal,
          }
        })
        totalReturnAmount = roundMoney(totalReturnAmount)
      }
    } catch (error) {
      if (error instanceof ReturnLineError) {
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 400 }
        )
      }
      throw error
    }

    // Stock deltas in base units between the saved return and the edited one.
    const oldNetMap = getReturnStockEffect(existingReturn)
    const newNetMap = getReturnStockEffect({ returnItems })

    const updates: Array<{ productId: string; delta: number }> = []
    for (const productId of allProductIds) {
      const oldNet = oldNetMap.get(productId) ?? 0
      const newNet = newNetMap.get(productId) ?? 0
      const delta = newNet - oldNet
      if (delta === 0) continue

      const product = productMap.get(productId) as ProductDocumentLike | undefined
      if (!product) {
        throw new Error("Product not found")
      }
      if (product.quantity + delta < 0) {
        return NextResponse.json(
          { success: false, error: "Stock would go negative." },
          { status: 400 }
        )
      }

      updates.push({ productId, delta })
    }

    const updateInput: Record<string, unknown> = {
      returnItems,
      replacementItems: [],
      totalReturnAmount,
      totalReplacementAmount: 0,
      notes:
        typeof payload.notes === "string"
          ? payload.notes.trim()
          : existingReturn.notes,
    }

    let updatedReturn
    const dbSession = await db.startSession()
    try {
      await dbSession.withTransaction(async () => {
        if (updates.length > 0) {
          await Product.bulkWrite(
            updates.map((entry) => ({
              updateOne: {
                filter: { _id: entry.productId, store },
                update: { $inc: { quantity: entry.delta } },
              },
            })),
            { session: dbSession }
          )
        }

        updatedReturn = await ReturnModel.findOneAndUpdate(
          { _id: id, store },
          updateInput,
          { returnDocument: "after", runValidators: true, session: dbSession }
        )

        if (!updatedReturn) {
          throw new Error("Return not found")
        }

        if (linkedSaleId) {
          await reconcileLoanAfterReturn(linkedSaleId, store, dbSession)
        }
      })
    } finally {
      await dbSession.endSession()
    }

    try {
      await Promise.all(
        updates.map(async (entry) => {
          const product = productMap.get(entry.productId) as
            | ProductDocumentLike
            | undefined
          if (!product) return
          await syncLowStockAlert({
            store,
            productId: entry.productId,
            name: product.name,
            sku: product.sku,
            quantity: product.quantity + entry.delta,
            threshold: product.lowStockThreshold ?? 0,
          })
        })
      )
    } catch (error) {
      console.error("[Low Stock Alert Sync Error]", error)
    }

    return NextResponse.json({ success: true, data: updatedReturn })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update return"
    return NextResponse.json(
      { success: false, error: message },
      { status: 400 }
    )
  }
}

export async function DELETE(
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

    // Before any lookup, so a wrong password cannot be used to probe which
    // ids exist.
    const verified = await verifyActionPassword(request, session)
    if (!verified.ok) {
      return verified.response
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
    const existingReturn = await ReturnModel.findOne({ _id: id, store })

    if (!existingReturn) {
      return NextResponse.json(
        { success: false, error: "Return not found" },
        { status: 404 }
      )
    }
    const linkedSaleId = existingReturn.saleId
      ? existingReturn.saleId.toString()
      : null

    const productIds = Array.from(
      new Set([
        ...existingReturn.returnItems.map((item) => item.productId.toString()),
        ...existingReturn.replacementItems.map((item) => item.productId.toString()),
      ])
    )
    const products = await Product.find({ _id: { $in: productIds }, store })

    if (products.length !== productIds.length) {
      return NextResponse.json(
        { success: false, error: "One or more products not found" },
        { status: 404 }
      )
    }

    const productMap = new Map(
      products.map((product) => [product._id.toString(), product.quantity])
    )

    // Undoing the return takes its restored stock back out, in base units.
    const netChanges = getReturnStockEffect(existingReturn)

    for (const [productId, change] of netChanges.entries()) {
      const available = productMap.get(productId) ?? 0
      const delta = -change
      if (available + delta < 0) {
        return NextResponse.json(
          { success: false, error: "Stock would go negative." },
          { status: 400 }
        )
      }
    }

    const updates = Array.from(netChanges.entries()).map(([productId, change]) => ({
      productId,
      delta: -change,
    }))

    const dbSession = await db.startSession()
    try {
      await dbSession.withTransaction(async () => {
        await Product.bulkWrite(
          updates.map((entry) => ({
            updateOne: {
              filter: { _id: entry.productId, store },
              update: { $inc: { quantity: entry.delta } },
            },
          })),
          { session: dbSession }
        )

        await existingReturn.deleteOne({ session: dbSession })
        if (linkedSaleId) {
          await reconcileLoanAfterReturn(linkedSaleId, store, dbSession)
        }
      })
    } finally {
      await dbSession.endSession()
    }

    try {
      await Promise.all(
        updates.map(async (entry) => {
          const product = products.find(
            (item) => item._id.toString() === entry.productId
          ) as ProductDocumentLike | undefined
          if (!product) return
          await syncLowStockAlert({
            store,
            productId: entry.productId,
            name: product.name,
            sku: product.sku,
            quantity: product.quantity + entry.delta,
            threshold: product.lowStockThreshold ?? 0,
          })
        })
      )
    } catch (error) {
      console.error("[Low Stock Alert Sync Error]", error)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete return"
    return NextResponse.json(
      { success: false, error: message },
      { status: 400 }
    )
  }
}
