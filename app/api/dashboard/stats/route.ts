import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth/middleware"
import { resolveStoreFromRequest } from "@/lib/auth/session"
import { connectToDatabase } from "@/lib/db/connection"
import { Product } from "@/lib/db/models/Product"
import { Sale } from "@/lib/db/models/Sale"
import { Invoice } from "@/lib/db/models/Invoice"

function getTodayRange() {
  const start = new Date()
  start.setHours(0, 0, 0, 0)

  const end = new Date(start)
  end.setDate(end.getDate() + 1)

  return { start, end }
}

export async function GET(request: NextRequest) {
  try {
    const { authorized, session } = await requireAuth(request)
    if (!authorized || !session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const store = resolveStoreFromRequest(request, session)
    if (!store) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    await connectToDatabase()

    const today = getTodayRange()
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
    ])

    const sales = await Sale.aggregate([
      { $match: { store } },
      { $group: { _id: null, total: { $sum: "$totalAmount" } } },
    ])

    const stockValue = await Product.aggregate([
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

    const unpaidTotals = await Invoice.aggregate([
      { $match: { store, status: "unpaid" } },
      { $group: { _id: null, total: { $sum: "$totalAmount" } } },
    ])

    const todaySalesTotals = await Sale.aggregate([
      { $match: todayFilter },
      {
        $group: {
          _id: null,
          revenue: { $sum: "$totalAmount" },
        },
      },
    ])

    const todayGrossProfit = await Sale.aggregate([
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
      .lean()

    const recentSales = await Sale.find({ store })
      .select("totalAmount items createdAt")
      .sort({ createdAt: -1 })
      .limit(6)
      .lean()

    const topMoving = await Sale.aggregate([
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
      { $limit: 6 },
    ])

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
        revenue: sales[0]?.total || 0,
        revenueToday: todaySalesTotals[0]?.revenue || 0,
        grossProfitToday: todayGrossProfit[0]?.total || 0,
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
        topMoving: topMoving.map((entry) => ({
          sku: entry._id.sku,
          name: entry._id.name,
          unit: entry._id.unit ?? "pcs",
          soldQuantity: entry.soldQuantity,
          salesValue: entry.salesValue,
        })),
      },
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to fetch stats" },
      { status: 500 }
    )
  }
}
