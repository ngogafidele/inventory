import { NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/db/connection"
import { requireAdmin } from "@/lib/auth/middleware"
import { resolveStoreFromRequest, type StoreKey } from "@/lib/auth/session"
import { Expense } from "@/lib/db/models/Expense"
import { Invoice } from "@/lib/db/models/Invoice"
import { Product } from "@/lib/db/models/Product"
import { ReturnModel } from "@/lib/db/models/Return"
import { Sale } from "@/lib/db/models/Sale"
import { StockAdjustment } from "@/lib/db/models/StockAdjustment"
import {
  formatInKigali,
  formatKigaliDateInput,
  getKigaliDateParts,
  parseKigaliDateInput,
} from "@/lib/utils/time"
import {
  generateReportPDF,
  type RecentSale,
  type StoreReport,
  type TopMovingProduct,
} from "@/lib/pdf/report-generator"

export const runtime = "nodejs"

type SaleTotals = {
  _id: StoreKey
  sales: number
  revenue: number
  grossProfit: number
}

type ReturnTotals = {
  _id: StoreKey
  revenue: number
  grossProfit: number
}

type ProductTotals = {
  _id: StoreKey
  products: number
  inventoryCost: number
  inventoryRetail: number
}

type InvoiceTotals = {
  _id: StoreKey
  invoices: number
  unpaidInvoices: number
  outstanding: number
}

type AdjustmentTotals = {
  _id: StoreKey
  adjustments: number
}

type ExpenseTotals = {
  _id: StoreKey
  expenses: number
}

type OutstandingSaleTotals = {
  _id: StoreKey
  outstanding: number
}

type ReturnedProductTotals = {
  sku: string
  name: string
  unit: string
  returnedQuantity: number
  revenue: number
  grossProfit: number
}

type ReportSale = {
  _id: { toString(): string }
  store: StoreKey
  createdAt?: Date
  totalAmount: number
  items: Array<{
    name: string
    sku: string
  }>
}

function getSingleParam(value: string | null) {
  return value ?? undefined
}

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

function formatDateOnly(date: Date) {
  return formatInKigali(date, {
    month: "short",
    day: "2-digit",
    year: "numeric",
  })
}

function getReportRange(request: NextRequest) {
  const now = new Date()
  const nowParts = getKigaliDateParts(now)
  const todayInput = `${nowParts.year}-${String(nowParts.month).padStart(
    2,
    "0"
  )}-${String(nowParts.day).padStart(2, "0")}`
  const monthStartInput = `${nowParts.year}-${String(nowParts.month).padStart(
    2,
    "0"
  )}-01`
  const today = parseKigaliDateInput(todayInput) ?? now
  const monthStart = parseKigaliDateInput(monthStartInput) ?? today

  const parsedFrom = parseKigaliDateInput(
    getSingleParam(request.nextUrl.searchParams.get("from"))
  )
  const parsedTo = parseKigaliDateInput(
    getSingleParam(request.nextUrl.searchParams.get("to"))
  )

  let from = parsedFrom ?? monthStart
  let to = parsedTo ?? today

  if (from > to) {
    const earlierDate = to
    to = from
    from = earlierDate
  }

  return {
    from,
    to,
    endExclusive: addDays(to, 1),
    fromInput: formatKigaliDateInput(from),
    toInput: formatKigaliDateInput(to),
    fromLabel: formatDateOnly(from),
    toLabel: formatDateOnly(to),
  }
}

function buildReportFilename(store: StoreKey, fromInput: string, toInput: string) {
  return `report-${store}-${fromInput}-to-${toInput}.pdf`
}

export async function GET(request: NextRequest) {
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

    const range = getReportRange(request)
    const periodFilter = {
      $gte: range.from,
      $lt: range.endExclusive,
    }

    await connectToDatabase()

    const [
      productTotals,
      saleTotals,
      returnTotals,
      invoiceTotals,
      adjustmentTotals,
      expenseTotals,
      outstandingSalesTotals,
      topMovingProducts,
      returnedProductTotals,
      recentSales,
    ] = await Promise.all([
      Product.aggregate<ProductTotals>([
        { $match: { store } },
        {
          $group: {
            _id: "$store",
            products: { $sum: 1 },
            inventoryCost: {
              $sum: { $multiply: ["$quantity", "$costPrice"] },
            },
            inventoryRetail: {
              $sum: { $multiply: ["$quantity", "$price"] },
            },
          },
        },
      ]),
      Sale.aggregate<SaleTotals>([
        { $match: { store, createdAt: periodFilter } },
        { $unwind: { path: "$items", preserveNullAndEmptyArrays: true } },
        {
          $group: {
            _id: "$store",
            saleIds: { $addToSet: "$_id" },
            revenue: { $sum: "$items.lineTotal" },
            grossProfit: {
              $sum: {
                $subtract: [
                  "$items.lineTotal",
                  { $multiply: ["$items.basePrice", "$items.quantity"] },
                ],
              },
            },
          },
        },
        {
          $project: {
            sales: { $size: "$saleIds" },
            revenue: 1,
            grossProfit: 1,
          },
        },
      ]),
      ReturnModel.aggregate<ReturnTotals>([
        { $match: { store, createdAt: periodFilter } },
        { $unwind: "$returnItems" },
        {
          $lookup: {
            from: "products",
            localField: "returnItems.productId",
            foreignField: "_id",
            as: "product",
          },
        },
        { $unwind: { path: "$product", preserveNullAndEmptyArrays: true } },
        {
          $group: {
            _id: "$store",
            revenue: { $sum: "$returnItems.lineTotal" },
            grossProfit: {
              $sum: {
                $subtract: [
                  "$returnItems.lineTotal",
                  {
                    $multiply: [
                      {
                        $ifNull: [
                          "$returnItems.basePrice",
                          { $ifNull: ["$product.costPrice", 0] },
                        ],
                      },
                      "$returnItems.quantity",
                    ],
                  },
                ],
              },
            },
          },
        },
      ]),
      Invoice.aggregate<InvoiceTotals>([
        { $match: { store, issuedAt: periodFilter } },
        {
          $group: {
            _id: "$store",
            invoices: { $sum: 1 },
            unpaidInvoices: {
              $sum: { $cond: [{ $eq: ["$status", "unpaid"] }, 1, 0] },
            },
            outstanding: {
              $sum: {
                $cond: [{ $eq: ["$status", "unpaid"] }, "$totalAmount", 0],
              },
            },
          },
        },
      ]),
      StockAdjustment.aggregate<AdjustmentTotals>([
        { $match: { store, createdAt: periodFilter } },
        {
          $group: {
            _id: "$store",
            adjustments: { $sum: 1 },
          },
        },
      ]),
      Expense.aggregate<ExpenseTotals>([
        { $match: { store, date: periodFilter } },
        {
          $group: {
            _id: "$store",
            expenses: { $sum: "$amount" },
          },
        },
      ]),
      Sale.aggregate<OutstandingSaleTotals>([
        {
          $match: {
            store,
            createdAt: periodFilter,
            paymentStatus: "unpaid",
          },
        },
        {
          $group: {
            _id: "$store",
            outstanding: { $sum: "$totalAmount" },
          },
        },
      ]),
      Sale.aggregate<TopMovingProduct>([
        { $match: { store, createdAt: periodFilter } },
        { $unwind: "$items" },
        {
          $group: {
            _id: {
              sku: "$items.sku",
              name: "$items.name",
              unit: "$items.unit",
            },
            soldQuantity: { $sum: "$items.quantity" },
            revenue: { $sum: "$items.lineTotal" },
            grossProfit: {
              $sum: {
                $subtract: [
                  "$items.lineTotal",
                  { $multiply: ["$items.basePrice", "$items.quantity"] },
                ],
              },
            },
          },
        },
        { $sort: { revenue: -1 } },
        {
          $project: {
            _id: 0,
            sku: "$_id.sku",
            name: "$_id.name",
            unit: "$_id.unit",
            soldQuantity: 1,
            revenue: 1,
            grossProfit: 1,
          },
        },
      ]),
      ReturnModel.aggregate<ReturnedProductTotals>([
        { $match: { store, createdAt: periodFilter } },
        { $unwind: "$returnItems" },
        {
          $lookup: {
            from: "products",
            localField: "returnItems.productId",
            foreignField: "_id",
            as: "product",
          },
        },
        { $unwind: { path: "$product", preserveNullAndEmptyArrays: true } },
        {
          $group: {
            _id: {
              sku: "$returnItems.sku",
              name: "$returnItems.name",
              unit: "$returnItems.unit",
            },
            returnedQuantity: { $sum: "$returnItems.quantity" },
            revenue: { $sum: "$returnItems.lineTotal" },
            grossProfit: {
              $sum: {
                $subtract: [
                  "$returnItems.lineTotal",
                  {
                    $multiply: [
                      {
                        $ifNull: [
                          "$returnItems.basePrice",
                          { $ifNull: ["$product.costPrice", 0] },
                        ],
                      },
                      "$returnItems.quantity",
                    ],
                  },
                ],
              },
            },
          },
        },
        {
          $project: {
            _id: 0,
            sku: "$_id.sku",
            name: "$_id.name",
            unit: "$_id.unit",
            returnedQuantity: 1,
            revenue: 1,
            grossProfit: 1,
          },
        },
      ]),
      Sale.find({ store, createdAt: periodFilter })
        .select("store items totalAmount createdAt")
        .sort({ createdAt: -1 })
        .limit(8)
        .lean<ReportSale[]>(),
    ])

    const productMap = new Map(productTotals.map((item) => [item._id, item]))
    const saleMap = new Map(saleTotals.map((item) => [item._id, item]))
    const returnMap = new Map(returnTotals.map((item) => [item._id, item]))
    const invoiceMap = new Map(invoiceTotals.map((item) => [item._id, item]))
    const adjustmentMap = new Map(
      adjustmentTotals.map((item) => [item._id, item])
    )
    const expenseMap = new Map(expenseTotals.map((item) => [item._id, item]))
    const outstandingSalesMap = new Map(
      outstandingSalesTotals.map((item) => [item._id, item])
    )

    const reports = [store].map((reportStore) => {
      const products = productMap.get(reportStore)
      const sales = saleMap.get(reportStore)
      const returns = returnMap.get(reportStore)
      const invoices = invoiceMap.get(reportStore)
      const adjustments = adjustmentMap.get(reportStore)
      const expenses = expenseMap.get(reportStore)
      const outstandingSales = outstandingSalesMap.get(reportStore)

      const grossProfit =
        (sales?.grossProfit ?? 0) - (returns?.grossProfit ?? 0)
      const netRevenue = (sales?.revenue ?? 0) - (returns?.revenue ?? 0)
      const costOfSales = netRevenue - grossProfit
      const expenseTotal = expenses?.expenses ?? 0

      return {
        store: reportStore,
        products: products?.products ?? 0,
        inventoryCost: products?.inventoryCost ?? 0,
        inventoryRetail: products?.inventoryRetail ?? 0,
        sales: sales?.sales ?? 0,
        revenue: netRevenue,
        costOfSales,
        expenses: expenseTotal,
        profit: grossProfit - expenseTotal,
        invoices: invoices?.invoices ?? 0,
        unpaidInvoices: invoices?.unpaidInvoices ?? 0,
        outstanding: outstandingSales?.outstanding ?? 0,
        adjustments: adjustments?.adjustments ?? 0,
      } satisfies StoreReport
    })

    const topMovingMap = new Map(
      topMovingProducts.map((product) => [product.sku, { ...product }])
    )
    returnedProductTotals.forEach((returnedProduct) => {
      const current = topMovingMap.get(returnedProduct.sku)
      if (current) {
        current.soldQuantity -= returnedProduct.returnedQuantity
        current.revenue -= returnedProduct.revenue
        current.grossProfit -= returnedProduct.grossProfit
        return
      }

      topMovingMap.set(returnedProduct.sku, {
        sku: returnedProduct.sku,
        name: returnedProduct.name,
        unit: returnedProduct.unit,
        soldQuantity: -returnedProduct.returnedQuantity,
        revenue: -returnedProduct.revenue,
        grossProfit: -returnedProduct.grossProfit,
      })
    })

    const netTopMovingProducts = Array.from(topMovingMap.values())
      .filter((product) => product.soldQuantity !== 0 || product.revenue !== 0)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 8)

    const pdf = await generateReportPDF({
      store,
      fromLabel: range.fromLabel,
      toLabel: range.toLabel,
      generatedAt: new Date(),
      reports,
      topMovingProducts: netTopMovingProducts,
      recentSales: recentSales.map((sale) => ({
        store: sale.store,
        createdAt: sale.createdAt,
        totalAmount: sale.totalAmount,
        items: sale.items.map((item) => ({
          name: item.name,
          sku: item.sku,
        })),
      })) satisfies RecentSale[],
    })

    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${buildReportFilename(
          store,
          range.fromInput,
          range.toInput
        )}"`,
      },
    })
  } catch (error) {
    console.error("[Report PDF Error]", error)
    const detail =
      process.env.NODE_ENV !== "production" && error instanceof Error
        ? `: ${error.message}`
        : ""
    return NextResponse.json(
      { success: false, error: `Failed to generate report PDF${detail}` },
      { status: 500 }
    )
  }
}
