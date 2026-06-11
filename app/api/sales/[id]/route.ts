// Handles settlement, correction, and deletion of a recorded branch sale.
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

type ExistingLoanPayment = {
  amount?: number
}

function addQuantity(map: Map<string, number>, productId: string, quantity: number) {
  map.set(productId, (map.get(productId) ?? 0) + quantity)
}

function getSaleQuantities(items: SaleItemForEdit[]) {
  const quantities = new Map<string, number>()
  items.forEach((item) => addQuantity(quantities, item.productId.toString(), item.quantity))
  return quantities
}

function getRestockQuantities(items: SaleItemForRestock[]) {
  const quantities = new Map<string, number>()
  items.forEach((item) =>
    addQuantity(quantities, item.productId.toString(), item.quantity)
  )
  return quantities
}

function getAmountPaidFromPayments(payments: ExistingLoanPayment[] | undefined) {
  if (!Array.isArray(payments)) return 0
  return payments.reduce((sum, payment) => sum + (payment.amount ?? 0), 0)
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

    const saleResponse =
      typeof sale.toObject === "function" ? sale.toObject() : sale

    return NextResponse.json({ success: true, data: saleResponse })
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

    // Collection settles the receivable only; inventory moved at sale creation.
    await connectToDatabase()
    const existingSale = await Sale.findOne({ _id: id, store })
    if (!existingSale) {
      return NextResponse.json(
        { success: false, error: "Sale not found" },
        { status: 404 }
      )
    }

    const customerFromOutstanding = existingSale.outstanding
      ? {
          name: existingSale.outstanding.customerName ?? "",
          phone: existingSale.outstanding.customerPhone ?? "",
        }
      : null
    const sale = await Sale.findOneAndUpdate(
      { _id: id, store },
      {
        paymentStatus: "paid",
        paymentMethod: payload.paymentMethod,
        remainingBalance: 0,
        amountPaid: existingSale.totalAmount,
        ...(customerFromOutstanding && !existingSale.customer
          ? { customer: customerFromOutstanding }
          : {}),
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

    if (customerFromOutstanding && !existingSale.customer) {
      await Sale.collection.updateOne(
        { _id: sale._id, store },
        { $set: { customer: customerFromOutstanding } }
      )
    }
    await Invoice.updateOne({ saleId: sale._id, store }, { status: "paid" })

    const saleResponse =
      typeof sale.toObject === "function" ? sale.toObject() : sale
    if (customerFromOutstanding && !saleResponse.customer) {
      saleResponse.customer = customerFromOutstanding
    }

    return NextResponse.json({ success: true, data: saleResponse })
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

    // Keep the sale, linked invoice, and inventory correction atomic.
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
        const existingPayments = sale.payments as ExistingLoanPayment[] | undefined
        const amountPaid = getAmountPaidFromPayments(existingPayments)
        if (paymentStatus === "unpaid" && amountPaid > totalAmount) {
          throw new Error("Existing payments exceed the updated sale total.")
        }
        sale.amountPaid = paymentStatus === "unpaid" ? amountPaid : totalAmount
        sale.remainingBalance =
          paymentStatus === "unpaid" ? totalAmount - amountPaid : 0
        sale.customer =
          customer.name || customer.phone
            ? {
                name: customer.name,
                phone: customer.phone,
              }
            : undefined
        sale.outstanding =
          paymentStatus === "unpaid"
            ? {
                customerName: customer.name,
                customerPhone: customer.phone,
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
        } else {
          await Sale.collection.updateOne(
            { _id: sale._id, store },
            { $unset: { customer: "" } },
            { session: dbSession }
          )
        }

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
    const loanOnly = request.nextUrl.searchParams.get("loan") === "true"

    const db = await connectToDatabase()
    const sale = await Sale.findOne({ _id: id, store })

    if (!sale) {
      return NextResponse.json(
        { success: false, error: "Sale not found" },
        { status: 404 }
      )
    }

    if (loanOnly && sale.paymentStatus !== "unpaid") {
      return NextResponse.json(
        { success: false, error: "Only unpaid loan sales can be deleted here." },
        { status: 400 }
      )
    }

    const saleItems = sale.items as SaleItemForRestock[]
    const restockQuantities = getRestockQuantities(saleItems)
    const productIds = Array.from(restockQuantities.keys())
    const products = await Product.find({ _id: { $in: productIds }, store })
    const productMap = new Map(
      products.map((product) => [product._id.toString(), product])
    )

    if (products.length !== productIds.length) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Cannot delete this sale because one or more products are missing.",
        },
        { status: 409 }
      )
    }

    const dbSession = await db.startSession()
    try {
      await dbSession.withTransaction(async () => {
        // Removing a recorded sale reverses its physical stock movement.
        if (restockQuantities.size > 0) {
          await Product.bulkWrite(
            Array.from(restockQuantities.entries()).map(
              ([productId, quantity]) => ({
                updateOne: {
                  filter: { _id: productId, store },
                  update: { $inc: { quantity } },
                },
              })
            ),
            { session: dbSession }
          )
        }

        await sale.deleteOne({ session: dbSession })
        await Invoice.deleteMany(
          { saleId: sale._id, store },
          { session: dbSession }
        )
      })
    } finally {
      await dbSession.endSession()
    }

    try {
      await Promise.all(
        Array.from(restockQuantities.entries()).map(
          async ([productId, quantity]) => {
            const product = productMap.get(productId)
            if (!product) return
            const newQuantity = product.quantity + quantity
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

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to delete sale" },
      { status: 400 }
    )
  }
}
