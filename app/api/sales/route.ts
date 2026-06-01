// Lists and records sales while applying their inventory movement.
import { NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/db/connection"
import { Product } from "@/lib/db/models/Product"
import { Sale } from "@/lib/db/models/Sale"
import { requireAuth } from "@/lib/auth/middleware"
import { resolveStoreFromRequest } from "@/lib/auth/session"
import { CreateSaleSchema } from "@/lib/db/validators/sale"
import { syncLowStockAlert } from "@/lib/db/alerts"
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

    const db = await connectToDatabase()

    const productIds = Array.from(
      new Set(payload.items.map((item) => item.productId))
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

      const requestedCostPrice =
        session.isAdmin && Number.isFinite(item.costPrice)
          ? item.costPrice
          : undefined

      return {
        productId: product._id,
        name: product.name,
        sku: product.sku,
        unit: product.unit ?? "pcs",
        quantity: item.quantity,
        basePrice: requestedCostPrice ?? product.costPrice ?? product.price,
        sellingPrice: item.sellingPrice,
        lineTotal,
      }
    })

    const paymentStatus = payload.paymentStatus ?? "paid"
    const customer = {
      name:
        payload.customer?.name?.trim() ||
        payload.outstanding?.customerName?.trim() ||
        "",
      phone:
        payload.customer?.phone?.trim() ||
        payload.outstanding?.customerPhone?.trim() ||
        "",
    }
    let outstanding: {
      customerName: string
      customerPhone?: string
      paymentDate?: Date
    } | null = null

    if (paymentStatus === "unpaid") {
      const paymentDate = parseKigaliDateInput(payload.outstanding?.paymentDate)
      if (!paymentDate) {
        return NextResponse.json(
          { success: false, error: "Invalid payment date." },
          { status: 400 }
        )
      }

      outstanding = {
        customerName: customer.name,
        customerPhone: customer.phone,
        paymentDate,
      }
    }

    let sale
    const dbSession = await db.startSession()
    try {
      await dbSession.withTransaction(async () => {
        // Goods leave inventory when sold, including sales awaiting payment.
        for (const [productId, quantity] of requestedQuantities.entries()) {
          const result = await Product.updateOne(
            { _id: productId, store, quantity: { $gte: quantity } },
            { $inc: { quantity: -quantity } },
            { session: dbSession }
          )

          if (result.modifiedCount !== 1) {
            const product = productMap.get(productId)
            throw new Error(
              product
                ? `Insufficient stock for ${product.name}`
                : "One or more products not found"
            )
          }
        }

        const createdSales = await Sale.create(
          [
            {
              store,
              items: saleItems,
              totalAmount,
              createdBy: session.userId,
              paymentStatus,
              paymentMethod:
                paymentStatus === "paid" ? payload.paymentMethod : undefined,
              customer:
                customer.name || customer.phone
                  ? {
                      name: customer.name,
                      phone: customer.phone,
                    }
                  : undefined,
              outstanding: paymentStatus === "unpaid" ? outstanding : undefined,
              payments: [],
              amountPaid: 0,
              remainingBalance:
                paymentStatus === "unpaid" ? totalAmount : 0,
              notes: payload.notes ?? "",
            },
          ],
          { session: dbSession }
        )
        sale = createdSales[0]

        if (customer.name || customer.phone) {
          await Sale.collection.updateOne(
            { _id: sale._id, store },
            {
              $set: {
                customer: {
                  name: customer.name,
                  phone: customer.phone,
                },
              },
            },
            { session: dbSession }
          )
        }
      })
    } finally {
      await dbSession.endSession()
    }

    try {
      await Promise.all(
        Array.from(requestedQuantities.entries()).map(
          async ([productId, quantity]) => {
            const product = productMap.get(productId)
            if (!product) return
            const newQuantity = product.quantity - quantity
            await syncLowStockAlert({
              store,
              productId: product._id.toString(),
              name: product.name,
              sku: product.sku,
              quantity: newQuantity,
              threshold: product.lowStockThreshold ?? 0,
            })
          }
        )
      )
    } catch (error) {
      console.error("[Low Stock Alert Sync Error]", error)
    }

    const saleResponse =
      typeof sale.toObject === "function" ? sale.toObject() : sale
    if (customer.name || customer.phone) {
      saleResponse.customer = {
        name: customer.name,
        phone: customer.phone,
      }
    }

    return NextResponse.json(
      { success: true, data: saleResponse },
      { status: 201 }
    )
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create sale"
    return NextResponse.json({ success: false, error: message }, { status: 400 })
  }
}
