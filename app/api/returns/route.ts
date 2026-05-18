import { NextRequest, NextResponse } from "next/server"
import { ZodError } from "zod"
import { connectToDatabase } from "@/lib/db/connection"
import { Product } from "@/lib/db/models/Product"
import { ReturnModel } from "@/lib/db/models/Return"
import { Sale } from "@/lib/db/models/Sale"
import { requireAuth } from "@/lib/auth/middleware"
import { resolveStoreFromRequest } from "@/lib/auth/session"
import { CreateReturnSchema } from "@/lib/db/validators/return"
import { parseKigaliDateInput } from "@/lib/utils/time"

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
    const returns = await ReturnModel.find({ store }).sort({ returnDate: -1 })

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
    const returnDate = parseKigaliDateInput(payload.returnDate)
    if (!returnDate) {
      return NextResponse.json(
        { success: false, error: "Invalid return date." },
        { status: 400 }
      )
    }

    await connectToDatabase()
    const sale = await Sale.findOne({ _id: payload.saleId, store })
    if (!sale) {
      return NextResponse.json(
        { success: false, error: "Sale not found" },
        { status: 404 }
      )
    }

    const existingReturns = await ReturnModel.find({
      store,
      saleId: sale._id,
    })
      .select("items")
      .lean()

    const returnedMap = new Map<string, number>()
    for (const entry of existingReturns) {
      for (const item of entry.items ?? []) {
        const productId = item.productId.toString()
        returnedMap.set(productId, (returnedMap.get(productId) ?? 0) + item.quantity)
      }
    }

    const saleItemMap = new Map(
      sale.items.map((item) => [item.productId.toString(), item])
    )

    const items = payload.items.map((item) => {
      const saleItem = saleItemMap.get(item.productId)
      if (!saleItem) {
        throw new Error("One or more return items are not in the sale")
      }
      const alreadyReturned = returnedMap.get(item.productId) ?? 0
      const availableToReturn = saleItem.quantity - alreadyReturned
      if (item.quantity > availableToReturn) {
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

    const productIds = items.map((item) => item.productId)
    const products = await Product.find({ _id: { $in: productIds }, store })

    if (products.length !== productIds.length) {
      return NextResponse.json(
        { success: false, error: "One or more products not found" },
        { status: 404 }
      )
    }

    await Product.bulkWrite(
      items.map((item) => ({
        updateOne: {
          filter: { _id: item.productId, store },
          update: { $inc: { quantity: item.quantity } },
        },
      }))
    )

    const createdReturn = await ReturnModel.create({
      store,
      saleId: sale._id,
      items,
      refundAmount: payload.refundAmount,
      refundMethod: payload.refundMethod,
      reason: payload.reason.trim(),
      returnDate,
      customerName: payload.customerName.trim(),
      customerPhone: payload.customerPhone.trim(),
      notes: payload.notes?.trim() ?? "",
      createdBy: session.userId,
    })

    return NextResponse.json(
      { success: true, data: createdReturn },
      { status: 201 }
    )
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { success: false, error: error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      )
    }
    const message = error instanceof Error ? error.message : "Failed to create return"
    return NextResponse.json(
      { success: false, error: message },
      { status: 400 }
    )
  }
}
