// Reconstructs a product's stock-movement history for the monitor view.
import { NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/db/connection"
import { Product } from "@/lib/db/models/Product"
import { ProductReceipt } from "@/lib/db/models/ProductReceipt"
import { StockAdjustment } from "@/lib/db/models/StockAdjustment"
import { Sale } from "@/lib/db/models/Sale"
import { ReturnModel } from "@/lib/db/models/Return"
import { requireAdmin } from "@/lib/auth/middleware"
import { resolveStoreFromRequest } from "@/lib/auth/session"

// A single normalized inventory event, unified across the source collections.
type MovementType =
  | "receipt"
  | "sale"
  | "loan"
  | "return"
  | "replacement"
  | "adjustment"

type MovementDirection = "in" | "out"

type MovementEvent = {
  date: string
  type: MovementType
  direction: MovementDirection
  quantity: number
  reason: string
  balanceAfter: number
  meta?: Record<string, string | number>
}

const MOVEMENT_LABELS: Record<MovementType, string> = {
  receipt: "Supplier receipt",
  sale: "Sale",
  loan: "Loan issued",
  return: "Customer return",
  replacement: "Replacement issued",
  adjustment: "Stock adjustment",
}

function toTime(value: Date | string | undefined) {
  if (!value) return 0
  return new Date(value).getTime()
}

export async function GET(
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

    const product = await Product.findOne({ _id: id, store }).lean<{
      _id: unknown
      name: string
      sku: string
      unit: string
      quantity: number
      createdAt?: Date
    } | null>()

    if (!product) {
      return NextResponse.json(
        { success: false, error: "Product not found" },
        { status: 404 }
      )
    }

    const [receipts, adjustments, sales, returns] = await Promise.all([
      ProductReceipt.find({ store, productId: id })
        .select("quantity receivedAt supplierName")
        .lean<{ quantity: number; receivedAt: Date; supplierName: string }[]>(),
      StockAdjustment.find({ store, productId: id })
        .select("quantityChange reason createdAt")
        .lean<{ quantityChange: number; reason: string; createdAt: Date }[]>(),
      Sale.find({ store, "items.productId": id })
        .select("items paymentStatus createdAt")
        .lean<
          {
            items: { productId: unknown; quantity: number }[]
            paymentStatus: "paid" | "unpaid"
            createdAt: Date
          }[]
        >(),
      ReturnModel.find({
        store,
        $or: [{ "returnItems.productId": id }, { "replacementItems.productId": id }],
      })
        .select("returnItems replacementItems createdAt")
        .lean<
          {
            returnItems: { productId: unknown; quantity: number }[]
            replacementItems: { productId: unknown; quantity: number }[]
            createdAt: Date
          }[]
        >(),
    ])

    // Build the unified, unsorted event stream from every source.
    type RawEvent = Omit<MovementEvent, "balanceAfter">
    const raw: RawEvent[] = []

    for (const receipt of receipts) {
      raw.push({
        date: new Date(receipt.receivedAt).toISOString(),
        type: "receipt",
        direction: "in",
        quantity: receipt.quantity,
        reason: receipt.supplierName
          ? `Received from ${receipt.supplierName}`
          : MOVEMENT_LABELS.receipt,
      })
    }

    for (const adjustment of adjustments) {
      const change = adjustment.quantityChange
      if (change === 0) continue
      raw.push({
        date: new Date(adjustment.createdAt).toISOString(),
        type: "adjustment",
        direction: change > 0 ? "in" : "out",
        quantity: Math.abs(change),
        reason: adjustment.reason || MOVEMENT_LABELS.adjustment,
      })
    }

    for (const sale of sales) {
      const quantity = sale.items
        .filter((item) => String(item.productId) === id)
        .reduce((sum, item) => sum + item.quantity, 0)
      if (quantity === 0) continue
      const isLoan = sale.paymentStatus === "unpaid"
      raw.push({
        date: new Date(sale.createdAt).toISOString(),
        type: isLoan ? "loan" : "sale",
        direction: "out",
        quantity,
        reason: isLoan ? MOVEMENT_LABELS.loan : MOVEMENT_LABELS.sale,
      })
    }

    for (const entry of returns) {
      const returned = entry.returnItems
        .filter((item) => String(item.productId) === id)
        .reduce((sum, item) => sum + item.quantity, 0)
      if (returned > 0) {
        raw.push({
          date: new Date(entry.createdAt).toISOString(),
          type: "return",
          direction: "in",
          quantity: returned,
          reason: MOVEMENT_LABELS.return,
        })
      }

      const replaced = entry.replacementItems
        .filter((item) => String(item.productId) === id)
        .reduce((sum, item) => sum + item.quantity, 0)
      if (replaced > 0) {
        raw.push({
          date: new Date(entry.createdAt).toISOString(),
          type: "replacement",
          direction: "out",
          quantity: replaced,
          reason: MOVEMENT_LABELS.replacement,
        })
      }
    }

    // Oldest first so the running balance walks forward in time.
    raw.sort((a, b) => toTime(a.date) - toTime(b.date))

    const signed = (event: RawEvent) =>
      event.direction === "in" ? event.quantity : -event.quantity

    const totalIn = raw
      .filter((event) => event.direction === "in")
      .reduce((sum, event) => sum + event.quantity, 0)
    const totalOut = raw
      .filter((event) => event.direction === "out")
      .reduce((sum, event) => sum + event.quantity, 0)

    const currentQuantity = product.quantity
    const netFromEvents = totalIn - totalOut
    // Anchor to the true current stock; the residual becomes the opening balance.
    const openingBalance = currentQuantity - netFromEvents

    let running = openingBalance
    const events: MovementEvent[] = raw.map((event) => {
      running += signed(event)
      return { ...event, balanceAfter: running }
    })

    // Balance line: an opening point, then a point per event.
    const openingDate = product.createdAt
      ? new Date(product.createdAt).toISOString()
      : events[0]?.date ?? new Date().toISOString()
    const balanceSeries = [
      { date: openingDate, balance: openingBalance },
      ...events.map((event) => ({ date: event.date, balance: event.balanceAfter })),
    ]

    // Breakdown grouped by movement type for the in/out bar chart.
    const breakdownMap = new Map<
      MovementType,
      { direction: MovementDirection; quantity: number; count: number }
    >()
    for (const event of raw) {
      const existing = breakdownMap.get(event.type)
      if (existing) {
        existing.quantity += event.quantity
        existing.count += 1
      } else {
        breakdownMap.set(event.type, {
          direction: event.direction,
          quantity: event.quantity,
          count: 1,
        })
      }
    }
    const breakdown = Array.from(breakdownMap.entries()).map(
      ([type, value]) => ({
        type,
        label: MOVEMENT_LABELS[type],
        direction: value.direction,
        quantity: value.quantity,
        count: value.count,
      })
    )

    return NextResponse.json({
      success: true,
      data: {
        product: {
          id: String(product._id),
          name: product.name,
          sku: product.sku,
          unit: product.unit ?? "pcs",
          quantity: currentQuantity,
        },
        openingBalance,
        currentQuantity,
        totals: { in: totalIn, out: totalOut, net: netFromEvents },
        breakdown,
        balanceSeries,
        // Most recent first for the event table.
        events: [...events].reverse(),
      },
    })
  } catch (error) {
    console.error("[Product Movements Error]", error)
    return NextResponse.json(
      { success: false, error: "Failed to load stock movements" },
      { status: 500 }
    )
  }
}
