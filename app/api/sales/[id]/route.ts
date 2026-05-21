import { NextRequest, NextResponse } from "next/server"
import type { ClientSession } from "mongoose"
import { connectToDatabase } from "@/lib/db/connection"
import { Invoice } from "@/lib/db/models/Invoice"
import { Product } from "@/lib/db/models/Product"
import { Sale } from "@/lib/db/models/Sale"
import { requireAdmin, requireAuth } from "@/lib/auth/middleware"
import { resolveStoreFromRequest } from "@/lib/auth/session"
import { syncLowStockAlert } from "@/lib/db/alerts"
import { UpdateSaleSchema } from "@/lib/db/validators/sale"
import { parseKigaliDateInput } from "@/lib/utils/time"

type SaleItemForRestock = {
  productId: { toString(): string }
  quantity: number
}

type SaleItemForEdit = {
  productId: { toString(): string }
  quantity: number
  name: string
  sku: string
  unit?: string
  basePrice?: number
  sellingPrice: number
  lineTotal: number
}

type ProductForEdit = {
  _id: { toString(): string }
  name: string
  sku: string
  unit?: string
  quantity: number
  price: number
  costPrice?: number
  lowStockThreshold?: number
}

function addQuantity(map: Map<string, number>, productId: string, quantity: number) {
  map.set(productId, (map.get(productId) ?? 0) + quantity)
}

function getSaleQuantities(items: SaleItemForEdit[]) {
  const quantities = new Map<string, number>()
  items.forEach((item) => addQuantity(quantities, item.productId.toString(), item.quantity))
  return quantities
}

async function applyStockChanges(
  entries: Array<{ productId: string; change: number }>,
  store: string,
  session?: ClientSession
) {
  const applied: Array<{ productId: string; change: number }> = []

  for (const entry of entries) {
    if (entry.change === 0) continue

    const filter =
      entry.change < 0
        ? { _id: entry.productId, store, quantity: { $gte: Math.abs(entry.change) } }
        : { _id: entry.productId, store }

    const result = await Product.updateOne(
      filter,
      { $inc: { quantity: entry.change } },
      { session }
    )

    if (result.modifiedCount !== 1) {
      if (applied.length > 0) {
        await Product.bulkWrite(
          applied.map((appliedEntry) => ({
            updateOne: {
              filter: { _id: appliedEntry.productId, store },
              update: { $inc: { quantity: -appliedEntry.change } },
            },
          })),
          { session }
        )
      }
      throw new Error("Insufficient stock for one or more products")
    }

    applied.push(entry)
  }

  return applied
}

export async function GET(
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
    const sale = await Sale.findOne({ _id: id, store })

    if (!sale) {
      return NextResponse.json(
        { success: false, error: "Sale not found" },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, data: sale })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to fetch sale" },
      { status: 500 }
    )
  }
}

export async function PATCH(
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
    const payload = (await request.json().catch(() => null)) as
      | {
          paymentStatus?: "paid" | "unpaid"
          paymentMethod?: "cash" | "bank" | "mobile"
        }
      | null

    if (!payload?.paymentStatus || payload.paymentStatus !== "paid") {
      return NextResponse.json(
        { success: false, error: "Only paymentStatus 'paid' is supported." },
        { status: 400 }
      )
    }
    if (
      !payload.paymentMethod ||
      !["cash", "bank", "mobile"].includes(payload.paymentMethod)
    ) {
      return NextResponse.json(
        { success: false, error: "Payment method is required." },
        { status: 400 }
      )
    }

    await connectToDatabase()
    const sale = await Sale.findOneAndUpdate(
      { _id: id, store },
      {
        paymentStatus: "paid",
        paymentMethod: payload.paymentMethod,
        $unset: { outstanding: "" },
      },
      { new: true }
    )

    if (!sale) {
      return NextResponse.json(
        { success: false, error: "Sale not found" },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, data: sale })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to update sale" },
      { status: 500 }
    )
  }
}

export async function PUT(
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
    const payload = UpdateSaleSchema.parse(await request.json())

    await connectToDatabase()

    const sale = await Sale.findOne({ _id: id, store })
    if (!sale) {
      return NextResponse.json(
        { success: false, error: "Sale not found" },
        { status: 404 }
      )
    }

    const oldItems = sale.items as SaleItemForEdit[]
    const oldQuantities = getSaleQuantities(oldItems)
    const newQuantities = new Map<string, number>()
    payload.items.forEach((item) =>
      addQuantity(newQuantities, item.productId, item.quantity)
    )

    const productIds = Array.from(
      new Set([...oldQuantities.keys(), ...newQuantities.keys()])
    )
    const products = await Product.find({ _id: { $in: productIds }, store })
    const productMap = new Map(
      products.map((product) => [product._id.toString(), product as ProductForEdit])
    )

    for (const productId of newQuantities.keys()) {
      if (!productMap.has(productId)) {
        return NextResponse.json(
          { success: false, error: "One or more products not found" },
          { status: 404 }
        )
      }
    }

    for (const [productId, newQuantity] of newQuantities.entries()) {
      const product = productMap.get(productId)
      if (!product) {
        return NextResponse.json(
          { success: false, error: "One or more products not found" },
          { status: 404 }
        )
      }

      const oldQuantity = oldQuantities.get(productId) ?? 0
      const availableQuantity = product.quantity + oldQuantity
      if (availableQuantity < newQuantity) {
        return NextResponse.json(
          { success: false, error: `Insufficient stock for ${product.name}` },
          { status: 400 }
        )
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

      const requestedCostPrice = Number.isFinite(item.costPrice)
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
    const paymentDate =
      paymentStatus === "unpaid"
        ? parseKigaliDateInput(payload.outstanding?.paymentDate)
        : null

    if (paymentStatus === "unpaid" && !paymentDate) {
      return NextResponse.json(
        { success: false, error: "Invalid payment date." },
        { status: 400 }
      )
    }

    const stockChanges = productIds
      .map((productId) => ({
        productId,
        change:
          (oldQuantities.get(productId) ?? 0) -
          (newQuantities.get(productId) ?? 0),
      }))
      .filter((entry) => entry.change !== 0)

    const db = await connectToDatabase()
    const dbSession = await db.startSession()
    try {
      await dbSession.withTransaction(async () => {
        await applyStockChanges(stockChanges, store, dbSession)

        sale.items = saleItems
        sale.totalAmount = totalAmount
        sale.paymentStatus = paymentStatus
        sale.paymentMethod =
          paymentStatus === "paid" ? payload.paymentMethod : undefined
        sale.outstanding =
          paymentStatus === "unpaid"
            ? {
                customerName: payload.outstanding?.customerName ?? "",
                customerPhone: payload.outstanding?.customerPhone ?? "",
                paymentDate: paymentDate ?? undefined,
              }
            : undefined
        sale.notes = payload.notes?.trim() ?? ""

        const invoice = await Invoice.findOne({ saleId: sale._id, store }).session(
          dbSession
        )
        if (invoice) {
          invoice.items = saleItems.map((item) => ({
            description: item.name,
            sku: item.sku,
            unit: item.unit ?? "pcs",
            quantity: item.quantity,
            unitPrice: item.sellingPrice,
            lineTotal: item.lineTotal,
          }))
          invoice.totalAmount = totalAmount
        }

        await sale.save({ session: dbSession })
        if (invoice) {
          await invoice.save({ session: dbSession })
        }
      })
    } finally {
      await dbSession.endSession()
    }

    try {
      await Promise.all(
        productIds.map(async (productId) => {
          const product = productMap.get(productId)
          if (!product) return

          const newQuantity =
            product.quantity +
            ((oldQuantities.get(productId) ?? 0) -
              (newQuantities.get(productId) ?? 0))

          await syncLowStockAlert({
            store,
            productId,
            name: product.name,
            sku: product.sku,
            quantity: newQuantity,
            threshold: product.lowStockThreshold ?? 0,
          })
        })
      )
    } catch (error) {
      console.error("[Low Stock Alert Sync Error]", error)
    }

    return NextResponse.json({ success: true, data: sale })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update sale"
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

    await connectToDatabase()
    const sale = await Sale.findOne({ _id: id, store })

    if (!sale) {
      return NextResponse.json(
        { success: false, error: "Sale not found" },
        { status: 404 }
      )
    }

    const invoice = await Invoice.findOne({ saleId: sale._id, store })
    if (invoice) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Cannot delete a sale that already has an invoice. Delete the invoice first.",
        },
        { status: 409 }
      )
    }

    const saleItems = sale.items as SaleItemForRestock[]
    const productIds = saleItems.map((item) => item.productId)
    const products = await Product.find({ _id: { $in: productIds }, store })
    const productMap = new Map(
      products.map((product) => [product._id.toString(), product])
    )

    if (saleItems.length > 0) {
      await Product.bulkWrite(
        saleItems.map((item) => ({
          updateOne: {
            filter: { _id: item.productId, store },
            update: { $inc: { quantity: item.quantity } },
          },
        }))
      )
    }

    try {
      await sale.deleteOne()
    } catch (error) {
      if (saleItems.length > 0) {
        await Product.bulkWrite(
          saleItems.map((item) => ({
            updateOne: {
              filter: { _id: item.productId, store },
              update: { $inc: { quantity: -item.quantity } },
            },
          }))
        )
      }
      throw error
    }

    try {
      await Promise.all(
        saleItems.map(async (item) => {
          const product = productMap.get(item.productId.toString())
          if (!product) return
          const newQuantity = product.quantity + item.quantity
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
    } catch (error) {
      console.error("[Low Stock Alert Sync Error]", error)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to delete sale" },
      { status: 400 }
    )
  }
}
