// Loads product returns and sellable sales for the active branch.
import "@/lib/db/models/User"
import { connectToDatabase } from "@/lib/db/connection"
import { ReturnModel } from "@/lib/db/models/Return"
import { Sale } from "@/lib/db/models/Sale"
import { ReturnsManager } from "@/components/returns/returns-manager"
import { getCurrentStore, requireServerSession } from "@/lib/auth/server"
import { formatInKigali } from "@/lib/utils/time"

type PopulatedUser = {
  _id: { toString(): string }
  name?: string
  email?: string
}

type ReturnPageReturn = {
  _id: { toString(): string }
  saleId?: { toString(): string }
  returnItems: Array<{
    productId: { toString(): string }
    name: string
    sku: string
    unit?: string
    quantity: number
    basePrice?: number
    unitPrice: number
    lineTotal: number
  }>
  totalReturnAmount: number
  notes?: string
  createdBy?: PopulatedUser | { toString(): string }
  createdAt?: Date
}

type ReturnPageSale = {
  _id: { toString(): string }
  createdAt?: Date
  totalAmount: number
  customer?: { name?: string }
  outstanding?: { customerName?: string }
  items: Array<{
    productId: { toString(): string }
    name: string
    sku: string
    unit?: string
    quantity: number
    sellingPrice: number
  }>
}

type ReturnedQuantityRow = {
  _id: { saleId: { toString(): string }; productId: { toString(): string } }
  qty: number
}

function isPopulatedUser(value: ReturnPageReturn["createdBy"]): value is PopulatedUser {
  return typeof value === "object" && value !== null && "_id" in value
}

export default async function ReturnsPage() {
  const session = await requireServerSession()
  const store = getCurrentStore(session)

  await connectToDatabase()
  const [returns, sales, returnedRows] = await Promise.all([
    ReturnModel.find({ store })
      .populate("createdBy", "name email")
      .sort({ createdAt: -1 })
      .lean<ReturnPageReturn[]>(),
    Sale.find({ store, deletedAt: null })
      .select("items totalAmount customer outstanding createdAt")
      .sort({ createdAt: -1 })
      .lean<ReturnPageSale[]>(),
    ReturnModel.aggregate<ReturnedQuantityRow>([
      { $match: { store, saleId: { $ne: null } } },
      { $unwind: "$returnItems" },
      {
        $group: {
          _id: { saleId: "$saleId", productId: "$returnItems.productId" },
          qty: { $sum: "$returnItems.quantity" },
        },
      },
    ]),
  ])

  const returnedByKey = new Map<string, number>()
  returnedRows.forEach((row) => {
    returnedByKey.set(
      `${row._id.saleId.toString()}:${row._id.productId.toString()}`,
      row.qty
    )
  })

  const serializedReturns = returns.map((entry) => ({
    _id: entry._id.toString(),
    saleId: entry.saleId ? entry.saleId.toString() : undefined,
    returnItems: (entry.returnItems ?? []).map((item) => ({
      productId: item.productId.toString(),
      name: item.name,
      sku: item.sku,
      unit: item.unit ?? "pcs",
      quantity: item.quantity,
      basePrice: item.basePrice ?? 0,
      unitPrice: item.unitPrice,
      lineTotal: item.lineTotal,
    })),
    totalReturnAmount: entry.totalReturnAmount,
    notes: entry.notes ?? "",
    createdByName: isPopulatedUser(entry.createdBy)
      ? entry.createdBy.name ?? entry.createdBy.email ?? "Unknown User"
      : "Unknown User",
    createdAt: entry.createdAt?.toISOString(),
    createdAtLabel: entry.createdAt
      ? formatInKigali(entry.createdAt, {
          year: "numeric",
          month: "short",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
        })
      : "-",
  }))

  const serializedSales = sales
    .map((sale) => {
      const saleId = sale._id.toString()
      // Aggregate sold quantity per product (a product can appear on multiple lines).
      const soldByProduct = new Map<
        string,
        { name: string; sku: string; unit: string; sellingPrice: number; sold: number }
      >()
      sale.items.forEach((item) => {
        const productId = item.productId.toString()
        const existing = soldByProduct.get(productId)
        if (existing) {
          existing.sold += item.quantity
        } else {
          soldByProduct.set(productId, {
            name: item.name,
            sku: item.sku,
            unit: item.unit ?? "pcs",
            sellingPrice: item.sellingPrice,
            sold: item.quantity,
          })
        }
      })

      const items = Array.from(soldByProduct.entries())
        .map(([productId, info]) => {
          const alreadyReturned = returnedByKey.get(`${saleId}:${productId}`) ?? 0
          return {
            productId,
            name: info.name,
            sku: info.sku,
            unit: info.unit,
            sellingPrice: info.sellingPrice,
            returnableQuantity: Math.max(0, info.sold - alreadyReturned),
          }
        })
        .filter((item) => item.returnableQuantity > 0)

      return {
        _id: saleId,
        dateLabel: sale.createdAt
          ? formatInKigali(sale.createdAt, {
              year: "numeric",
              month: "short",
              day: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
              hour12: true,
            })
          : "-",
        customerName:
          sale.customer?.name?.trim() ||
          sale.outstanding?.customerName?.trim() ||
          "",
        totalAmount: sale.totalAmount,
        items,
      }
    })
    // A sale with nothing left to return should not be selectable.
    .filter((sale) => sale.items.length > 0)

  return (
    <ReturnsManager
      initialReturns={serializedReturns}
      sales={serializedSales}
      currentUserLabel={session.email}
    />
  )
}
