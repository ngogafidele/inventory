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
  saleId: { toString(): string }
  items: Array<{
    productId: { toString(): string }
    name: string
    sku: string
    unit?: string
    quantity: number
    unitPrice: number
    lineTotal: number
  }>
  refundAmount: number
  refundMethod: "cash" | "mobile-money" | "bank"
  reason: string
  returnDate?: Date
  customerName: string
  customerPhone: string
  notes?: string
  createdBy?: PopulatedUser | { toString(): string }
  createdAt?: Date
}

type SaleOption = {
  _id: { toString(): string }
  createdAt?: Date
  totalAmount: number
  items: Array<{
    productId: { toString(): string }
    name: string
    sku: string
    unit?: string
    quantity: number
    sellingPrice: number
  }>
}

function isPopulatedUser(value: ReturnPageReturn["createdBy"]): value is PopulatedUser {
  return typeof value === "object" && value !== null && "_id" in value
}

export default async function ReturnsPage() {
  const session = await requireServerSession()
  const store = getCurrentStore(session)

  await connectToDatabase()
  const [returns, sales] = await Promise.all([
    ReturnModel.find({ store })
      .populate("createdBy", "name email")
      .sort({ returnDate: -1, createdAt: -1 })
      .lean<ReturnPageReturn[]>(),
    Sale.find({ store })
      .select("items totalAmount createdAt")
      .sort({ createdAt: -1 })
      .lean<SaleOption[]>(),
  ])

  const serializedReturns = returns.map((entry) => ({
    _id: entry._id.toString(),
    saleId: entry.saleId.toString(),
    items: entry.items.map((item) => ({
      productId: item.productId.toString(),
      name: item.name,
      sku: item.sku,
      unit: item.unit ?? "pcs",
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      lineTotal: item.lineTotal,
    })),
    refundAmount: entry.refundAmount,
    refundMethod: entry.refundMethod,
    reason: entry.reason,
    returnDate: entry.returnDate?.toISOString(),
    returnDateLabel: entry.returnDate
      ? formatInKigali(entry.returnDate, {
          year: "numeric",
          month: "short",
          day: "2-digit",
        })
      : "-",
    customerName: entry.customerName,
    customerPhone: entry.customerPhone,
    notes: entry.notes ?? "",
    createdByName: isPopulatedUser(entry.createdBy)
      ? entry.createdBy.name ?? entry.createdBy.email ?? "Unknown User"
      : "Unknown User",
  }))

  const serializedSales = sales.map((sale) => ({
    _id: sale._id.toString(),
    label: sale.createdAt
      ? formatInKigali(sale.createdAt, {
          year: "numeric",
          month: "short",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        })
      : sale._id.toString(),
    totalAmount: sale.totalAmount,
    items: sale.items.map((item) => ({
      productId: item.productId.toString(),
      name: item.name,
      sku: item.sku,
      unit: item.unit ?? "pcs",
      quantity: item.quantity,
      sellingPrice: item.sellingPrice,
    })),
  }))

  return (
    <ReturnsManager
      initialReturns={serializedReturns}
      sales={serializedSales}
    />
  )
}
