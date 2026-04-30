import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth/middleware"
import { resolveStoreFromRequest } from "@/lib/auth/session"
import { connectToDatabase } from "@/lib/db/connection"
import { Product } from "@/lib/db/models/Product"
import { Sale } from "@/lib/db/models/Sale"
import { Invoice } from "@/lib/db/models/Invoice"
import { LOW_STOCK_THRESHOLD } from "@/lib/db/alerts"

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

    const [productCount, lowStockCount, salesCount, invoiceCount] =
      await Promise.all([
        Product.countDocuments({ store }),
        Product.countDocuments({ store, quantity: { $lt: LOW_STOCK_THRESHOLD } }),
        Sale.countDocuments({ store }),
        Invoice.countDocuments({ store }),
      ])

    const sales = await Sale.aggregate([
      { $match: { store } },
      { $group: { _id: null, total: { $sum: "$totalAmount" } } },
    ])

    return NextResponse.json({
      success: true,
      data: {
        productCount,
        lowStockCount,
        salesCount,
        invoiceCount,
        revenue: sales[0]?.total || 0,
      },
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to fetch stats" },
      { status: 500 }
    )
  }
}
