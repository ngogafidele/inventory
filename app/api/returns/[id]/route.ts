// Updates or reverses a return while reconciling branch inventory.
import { NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/db/connection"
import { Product } from "@/lib/db/models/Product"
import { ReturnModel } from "@/lib/db/models/Return"
import { requireAuth } from "@/lib/auth/middleware"
import { resolveStoreFromRequest } from "@/lib/auth/session"
import { UpdateReturnSchema } from "@/lib/db/validators/return"
import { syncLowStockAlert } from "@/lib/db/alerts"

type ReturnItemInput = {
  productId: string
  quantity: number
  unitPrice: number
}

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

    await connectToDatabase()
    const existingReturn = await ReturnModel.findOne({ _id: id, store })
    if (!existingReturn) {
      return NextResponse.json(
        { success: false, error: "Return not found" },
        { status: 404 }
      )
    }

    const returnItemsInput = payload.returnItems
      ? payload.returnItems.map((item: ReturnItemInput) => ({
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        }))
      : existingReturn.returnItems.map((item) => ({
          productId: item.productId.toString(),
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

    let totalReturnAmount = 0
    const returnItems = returnItemsInput.map((item) => {
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

    const oldNetMap = new Map<string, number>()
    existingReturn.returnItems.forEach((item) => {
      const current = oldNetMap.get(item.productId.toString()) ?? 0
      oldNetMap.set(item.productId.toString(), current + item.quantity)
    })
    existingReturn.replacementItems.forEach((item) => {
      const current = oldNetMap.get(item.productId.toString()) ?? 0
      oldNetMap.set(item.productId.toString(), current - item.quantity)
    })

    const newNetMap = new Map<string, number>()
    returnItems.forEach((item) => {
      const current = newNetMap.get(item.productId.toString()) ?? 0
      newNetMap.set(item.productId.toString(), current + item.quantity)
    })

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

    if (updates.length > 0) {
      await Product.bulkWrite(
        updates.map((entry) => ({
          updateOne: {
            filter: { _id: entry.productId, store },
            update: { $inc: { quantity: entry.delta } },
          },
        }))
      )
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

    const updatedReturn = await ReturnModel.findOneAndUpdate(
      { _id: id, store },
      updateInput,
      { returnDocument: "after", runValidators: true }
    )

    if (!updatedReturn) {
      return NextResponse.json(
        { success: false, error: "Return not found" },
        { status: 404 }
      )
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

    const store = resolveStoreFromRequest(request, session)
    if (!store) {
      return NextResponse.json(
        { success: false, error: "Access denied" },
        { status: 403 }
      )
    }

    const { id } = await context.params

    await connectToDatabase()
    const existingReturn = await ReturnModel.findOne({ _id: id, store })

    if (!existingReturn) {
      return NextResponse.json(
        { success: false, error: "Return not found" },
        { status: 404 }
      )
    }

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

    const netChanges = new Map<string, number>()
    existingReturn.returnItems.forEach((item) => {
      const current = netChanges.get(item.productId.toString()) ?? 0
      netChanges.set(item.productId.toString(), current + item.quantity)
    })
    existingReturn.replacementItems.forEach((item) => {
      const current = netChanges.get(item.productId.toString()) ?? 0
      netChanges.set(item.productId.toString(), current - item.quantity)
    })

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

    await Product.bulkWrite(
      updates.map((entry) => ({
        updateOne: {
          filter: { _id: entry.productId, store },
          update: { $inc: { quantity: entry.delta } },
        },
      }))
    )

    await existingReturn.deleteOne()

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
