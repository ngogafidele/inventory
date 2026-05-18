import { NextRequest, NextResponse } from "next/server"
import { ZodError } from "zod"
import { connectToDatabase } from "@/lib/db/connection"
import { Product } from "@/lib/db/models/Product"
import { ReturnModel } from "@/lib/db/models/Return"
import { Sale } from "@/lib/db/models/Sale"
import { requireAuth } from "@/lib/auth/middleware"
import { resolveStoreFromRequest } from "@/lib/auth/session"
import { UpdateReturnSchema } from "@/lib/db/validators/return"
import { parseKigaliDateInput } from "@/lib/utils/time"

type ReturnItemInput = {
  productId: string
  quantity: number
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

    const saleId = payload.saleId ?? existingReturn.saleId?.toString()
    const returnDate = payload.returnDate
      ? parseKigaliDateInput(payload.returnDate)
      : existingReturn.returnDate

    if (payload.returnDate && !returnDate) {
      return NextResponse.json(
        { success: false, error: "Invalid return date." },
        { status: 400 }
      )
    }

    let items = existingReturn.items
    if (payload.items) {
      const sale = await Sale.findOne({ _id: saleId, store })
      if (!sale) {
        return NextResponse.json(
          { success: false, error: "Sale not found" },
          { status: 404 }
        )
      }

      const saleItemMap = new Map(
        sale.items.map((item) => [item.productId.toString(), item])
      )

      items = payload.items.map((item: ReturnItemInput) => {
        const saleItem = saleItemMap.get(item.productId)
        if (!saleItem) {
          throw new Error("One or more return items are not in the sale")
        }
        if (item.quantity > saleItem.quantity) {
          throw new Error("Return quantity exceeds sold quantity")
        }

        const lineTotal = saleItem.sellingPrice * item.quantity

        return {
          productId: saleItem.productId,
          name: saleItem.name,
          sku: saleItem.sku,
          unit: saleItem.unit ?? "pcs",
          quantity: item.quantity,
          unitPrice: saleItem.sellingPrice,
          lineTotal,
        }
      })
    }

    if (payload.items) {
      const oldItems = existingReturn.items
      const allProductIds = new Set([
        ...oldItems.map((item) => item.productId.toString()),
        ...items.map((item) => item.productId.toString()),
      ])

      const products = await Product.find({
        _id: { $in: Array.from(allProductIds) },
        store,
      })

      if (products.length !== allProductIds.size) {
        return NextResponse.json(
          { success: false, error: "One or more products not found" },
          { status: 404 }
        )
      }

      const currentStock = new Map(
        products.map((product) => [product._id.toString(), product.quantity])
      )

      const oldMap = new Map(
        oldItems.map((item) => [item.productId.toString(), item.quantity])
      )
      const newMap = new Map(
        items.map((item) => [item.productId.toString(), item.quantity])
      )

      const updates: Array<{ productId: string; delta: number }> = []
      for (const productId of allProductIds) {
        const oldQty = oldMap.get(productId) ?? 0
        const newQty = newMap.get(productId) ?? 0
        const delta = newQty - oldQty
        if (delta === 0) continue

        const available = currentStock.get(productId) ?? 0
        if (delta < 0 && available + delta < 0) {
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
    }

    const updateInput: Record<string, unknown> = {
      saleId,
      items,
      refundAmount: payload.refundAmount ?? existingReturn.refundAmount,
      refundMethod: payload.refundMethod ?? existingReturn.refundMethod,
      reason: payload.reason?.trim() ?? existingReturn.reason,
      returnDate,
      customerName: payload.customerName?.trim() ?? existingReturn.customerName,
      customerPhone: payload.customerPhone?.trim() ?? existingReturn.customerPhone,
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

    return NextResponse.json({ success: true, data: updatedReturn })
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { success: false, error: error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      )
    }
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

    const productIds = existingReturn.items.map((item) => item.productId)
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

    for (const item of existingReturn.items) {
      const available = productMap.get(item.productId.toString()) ?? 0
      if (available - item.quantity < 0) {
        return NextResponse.json(
          { success: false, error: "Stock would go negative." },
          { status: 400 }
        )
      }
    }

    await Product.bulkWrite(
      existingReturn.items.map((item) => ({
        updateOne: {
          filter: { _id: item.productId, store },
          update: { $inc: { quantity: -item.quantity } },
        },
      }))
    )

    await existingReturn.deleteOne()

    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete return"
    return NextResponse.json(
      { success: false, error: message },
      { status: 400 }
    )
  }
}
