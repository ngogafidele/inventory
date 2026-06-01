// Aggregates administrator dashboard metrics for a selected branch.
import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth/middleware"
import { resolveStoreFromRequest } from "@/lib/auth/session"
import { connectToDatabase } from "@/lib/db/connection"
import { Product } from "@/lib/db/models/Product"
import { ReturnModel } from "@/lib/db/models/Return"
import { Sale } from "@/lib/db/models/Sale"
import { Invoice } from "@/lib/db/models/Invoice"
import { Expense } from "@/lib/db/models/Expense"
import { formatKigaliDateInput, parseKigaliDateInput } from "@/lib/utils/time"

type DashboardSaleItem = {
  quantity: number
  unit?: string
}

type DashboardRecentSale = {
  _id: { toString(): string }
  createdAt?: Date
  totalAmount: number
  items: DashboardSaleItem[]
}

type DashboardLowStockProduct = {
  _id: { toString(): string }
  name: string
  sku: string
  unit?: string
  quantity: number
  lowStockThreshold?: number
}

type DashboardMoneyTotal = {
  total: number
}

type DashboardRevenueTotal = {
  revenue: number
}

type DashboardReturnTotal = {
  revenue: number
  grossProfit: number
}

type DashboardExpenseTotal = {
  total: number
}

type DashboardTopMovingProduct = {
  _id: {
    sku: string
    name: string
    unit?: string
  }
  soldQuantity: number
  salesValue: number
}

type DashboardTopReturnedProduct = {
  _id: {
    sku: string
    name: string
    unit?: string
  }
  returnedQuantity: number
  returnedValue: number
}

function getKigaliTodayRange() {
  const todayKigali = formatKigaliDateInput(new Date())
  const start = parseKigaliDateInput(todayKigali)

  if (!start) {
    const fallback = new Date()
    fallback.setHours(0, 0, 0, 0)
    const end = new Date(fallback)
    end.setDate(end.getDate() + 1)
    return { start: fallback, end }
  }

  const end = new Date(start)
  end.setDate(end.getDate() + 1)

  return { start, end }
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
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    await connectToDatabase()

    const today = getKigaliTodayRange()
    const todayFilter = {
      store,
      createdAt: { $gte: today.start, $lt: today.end },
    }

    const [
      productCount,
      lowStockCount,
      salesCount,
      salesToday,
      invoiceCount,
      unpaidCount,
      loansToday,
    ] = await Promise.all([
      Product.countDocuments({ store }),
      Product.countDocuments({
        store,
        $expr: { $lte: ["$quantity", { $ifNull: ["$lowStockThreshold", 0] }] },
      }),
      Sale.countDocuments({ store }),
      Sale.countDocuments(todayFilter),
      Invoice.countDocuments({ store }),
      Invoice.countDocuments({ store, status: "unpaid" }),
      Sale.aggregate<DashboardMoneyTotal>([
        { $match: { ...todayFilter, paymentStatus: "unpaid" } },
        {
          $group: {
            _id: null,
            total: {
              $sum: { $ifNull: ["$remainingBalance", "$totalAmount"] },
            },
          },
        },
      ]),
    ])

    const sales = await Sale.aggregate<DashboardMoneyTotal>([
      { $match: { store } },
      { $group: { _id: null, total: { $sum: "$totalAmount" } } },
    ])

    const returns = await ReturnModel.aggregate<DashboardReturnTotal>([
      { $match: { store } },
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
          _id: null,
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
    ])

    const stockValue = await Product.aggregate<DashboardMoneyTotal>([
      { $match: { store } },
      {
        $group: {
          _id: null,
          total: {
            $sum: {
              $multiply: [
                { $ifNull: ["$quantity", 0] },
                { $ifNull: ["$costPrice", 0] },
              ],
            },
          },
        },
      },
    ])

    const unpaidTotals = await Sale.aggregate<DashboardMoneyTotal>([
      { $match: { store, paymentStatus: "unpaid" } },
      {
        $group: {
          _id: null,
          total: {
            $sum: { $ifNull: ["$remainingBalance", "$totalAmount"] },
          },
        },
      },
    ])

    const todaySalesTotals = await Sale.aggregate<DashboardRevenueTotal>([
      { $match: todayFilter },
      {
        $group: {
          _id: null,
          revenue: { $sum: "$totalAmount" },
        },
      },
    ])

    const todayReturnTotals = await ReturnModel.aggregate<DashboardReturnTotal>([
      { $match: todayFilter },
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
          _id: null,
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
    ])

    const todayExpenses = await Expense.aggregate<DashboardExpenseTotal>([
      {
        $match: {
          store,
          date: { $gte: today.start, $lt: today.end },
        },
      },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ])

    const todayGrossProfit = await Sale.aggregate<DashboardMoneyTotal>([
      { $match: todayFilter },
      { $unwind: "$items" },
      {
        $group: {
          _id: null,
          total: {
            $sum: {
              $subtract: [
                "$items.lineTotal",
                { $multiply: ["$items.basePrice", "$items.quantity"] },
              ],
            },
          },
        },
      },
    ])

    const lowStockProducts = await Product.find({
      store,
      $expr: { $lte: ["$quantity", { $ifNull: ["$lowStockThreshold", 0] }] },
    })
      .select("name sku quantity unit lowStockThreshold")
      .sort({ quantity: 1, name: 1 })
      .limit(8)
      .lean<DashboardLowStockProduct[]>()

    const recentSales = await Sale.find({ store })
      .select("totalAmount items createdAt")
      .sort({ createdAt: -1 })
      .limit(6)
      .lean<DashboardRecentSale[]>()

    const topMoving = await Sale.aggregate<DashboardTopMovingProduct>([
      { $match: { store } },
      { $unwind: "$items" },
      {
        $group: {
          _id: {
            sku: "$items.sku",
            name: "$items.name",
            unit: "$items.unit",
          },
          soldQuantity: { $sum: "$items.quantity" },
          salesValue: { $sum: "$items.lineTotal" },
        },
      },
      { $sort: { soldQuantity: -1 } },
    ])

    const topReturned = await ReturnModel.aggregate<DashboardTopReturnedProduct>([
      { $match: { store } },
      { $unwind: "$returnItems" },
      {
        $group: {
          _id: {
            sku: "$returnItems.sku",
            name: "$returnItems.name",
            unit: "$returnItems.unit",
          },
          returnedQuantity: { $sum: "$returnItems.quantity" },
          returnedValue: { $sum: "$returnItems.lineTotal" },
        },
      },
    ])

    const netTopMoving = new Map(
      topMoving.map((entry) => [
        entry._id.sku,
        {
          sku: entry._id.sku,
          name: entry._id.name,
          unit: entry._id.unit ?? "pcs",
          soldQuantity: entry.soldQuantity,
          salesValue: entry.salesValue,
        },
      ])
    )
    topReturned.forEach((entry) => {
      const current = netTopMoving.get(entry._id.sku)
      if (current) {
        current.soldQuantity -= entry.returnedQuantity
        current.salesValue -= entry.returnedValue
        return
      }

      netTopMoving.set(entry._id.sku, {
        sku: entry._id.sku,
        name: entry._id.name,
        unit: entry._id.unit ?? "pcs",
        soldQuantity: -entry.returnedQuantity,
        salesValue: -entry.returnedValue,
      })
    })

    const netTopMovingProducts = Array.from(netTopMoving.values())
      .filter((entry) => entry.soldQuantity !== 0 || entry.salesValue !== 0)
      .sort((a, b) => b.soldQuantity - a.soldQuantity)
      .slice(0, 6)

    const returnedRevenue = returns[0]?.revenue || 0
    const returnedRevenueToday = todayReturnTotals[0]?.revenue || 0
    const returnedGrossProfitToday = todayReturnTotals[0]?.grossProfit || 0
    const grossProfitToday =
      (todayGrossProfit[0]?.total || 0) - returnedGrossProfitToday
    const expensesTodayTotal = todayExpenses[0]?.total || 0
    const revenueToday =
      (todaySalesTotals[0]?.revenue || 0) - returnedRevenueToday
    const costOfSalesToday = revenueToday - grossProfitToday

    return NextResponse.json({
      success: true,
      data: {
        productCount,
        lowStockCount,
        salesCount,
        salesToday,
        invoiceCount,
        unpaidCount,
        stockValue: stockValue[0]?.total || 0,
        revenue: (sales[0]?.total || 0) - returnedRevenue,
        revenueToday,
        costOfSalesToday,
        loansToday: loansToday[0]?.total || 0,
        grossProfitToday,
        expensesToday: expensesTodayTotal,
        profitToday: grossProfitToday - expensesTodayTotal,
        outstandingAmount: unpaidTotals[0]?.total || 0,
        lowStockProducts: lowStockProducts.map((product) => ({
          _id: product._id.toString(),
          name: product.name,
          sku: product.sku,
          quantity: product.quantity,
          unit: product.unit ?? "pcs",
          lowStockThreshold: product.lowStockThreshold ?? 0,
        })),
        recentSales: recentSales.map((sale) => ({
          _id: sale._id.toString(),
          createdAt: sale.createdAt,
          totalAmount: sale.totalAmount,
          quantitySold: sale.items.reduce((acc, item) => acc + item.quantity, 0),
          units: Array.from(
            new Set(sale.items.map((item) => item.unit ?? "pcs"))
          ),
        })),
        topMoving: netTopMovingProducts,
      },
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to fetch stats" },
      { status: 500 }
    )
  }
}
