// Summarizes branch customers, suppliers, and their transaction histories.
import "@/lib/db/models/Product"
import { connectToDatabase } from "@/lib/db/connection"
import { ProductReceipt } from "@/lib/db/models/ProductReceipt"
import { Sale } from "@/lib/db/models/Sale"
import { getCurrentStore, requireServerSession } from "@/lib/auth/server"
import { CustomersSuppliersManager } from "@/components/customers-suppliers/customers-suppliers-manager"
import { formatInKigali } from "@/lib/utils/time"

type CustomerSaleItem = {
  name?: string
  sku?: string
  unit?: string
  quantity: number
}

type CustomerSale = {
  _id: { toString(): string }
  createdAt?: Date
  totalAmount: number
  paymentStatus?: "paid" | "unpaid"
  customer?: {
    name?: string
    phone?: string
  }
  outstanding?: {
    customerName?: string
    customerPhone?: string
  }
  items: CustomerSaleItem[]
}

type PopulatedReceiptProduct = {
  _id: { toString(): string }
  name?: string
  sku?: string
  unit?: string
}

type SupplierReceipt = {
  _id: { toString(): string }
  productId?: PopulatedReceiptProduct | { toString(): string }
  sku: string
  supplierName: string
  supplierPhone: string
  quantity: number
  unitCost: number
  totalCost: number
  receivedAt?: Date
}

function normalizeKey(name: string, phone: string) {
  return `${name.trim().toLowerCase()}::${phone.trim().toLowerCase()}`
}

function formatDate(date: Date | undefined) {
  return date
    ? formatInKigali(date, {
        year: "numeric",
        month: "short",
        day: "2-digit",
      })
    : "-"
}

function summarizeItems(items: CustomerSaleItem[]) {
  if (!items.length) return "-"
  return items
    .map((item) => {
      const label = item.name?.trim() || item.sku?.trim() || "Item"
      return `${label} (${item.quantity} ${item.unit ?? "pcs"})`
    })
    .join(", ")
}

function isPopulatedProduct(
  value: SupplierReceipt["productId"]
): value is PopulatedReceiptProduct {
  return typeof value === "object" && value !== null && "_id" in value
}

export default async function CustomersSuppliersPage() {
  const session = await requireServerSession()
  const store = getCurrentStore(session)

  await connectToDatabase()
  const [sales, receipts] = await Promise.all([
    Sale.find({ store }).sort({ createdAt: -1 }).lean<CustomerSale[]>(),
    ProductReceipt.find({ store })
      .populate("productId", "name sku unit")
      .sort({ receivedAt: -1, createdAt: -1 })
      .lean<SupplierReceipt[]>(),
  ])

  const customersByKey = new Map<
    string,
    {
      id: string
      name: string
      phone: string
      totalPurchases: number
      salesCount: number
      purchases: Array<{
        _id: string
        createdAtLabel: string
        items: string
        totalAmount: number
        paymentStatus: "paid" | "unpaid"
      }>
    }
  >()

  for (const sale of sales) {
    const name =
      sale.customer?.name?.trim() ||
      sale.outstanding?.customerName?.trim() ||
      ""
    const phone =
      sale.customer?.phone?.trim() ||
      sale.outstanding?.customerPhone?.trim() ||
      ""
    if (!name && !phone) continue

    const customerName = name || "Unnamed Customer"
    const key = normalizeKey(customerName, phone)
    const existing =
      customersByKey.get(key) ??
      {
        id: key,
        name: customerName,
        phone,
        totalPurchases: 0,
        salesCount: 0,
        purchases: [],
      }

    existing.totalPurchases += sale.totalAmount
    existing.salesCount += 1
    existing.purchases.push({
      _id: sale._id.toString(),
      createdAtLabel: formatDate(sale.createdAt),
      items: summarizeItems(sale.items),
      totalAmount: sale.totalAmount,
      paymentStatus: sale.paymentStatus ?? "paid",
    })
    customersByKey.set(key, existing)
  }

  const suppliersByKey = new Map<
    string,
    {
      id: string
      name: string
      phone: string
      totalSupplied: number
      receiptsCount: number
      receipts: Array<{
        _id: string
        receivedAtLabel: string
        productName: string
        sku: string
        quantity: number
        unit: string
        unitCost: number
        totalCost: number
      }>
    }
  >()

  for (const receipt of receipts) {
    const supplierName = receipt.supplierName.trim()
    const supplierPhone = receipt.supplierPhone.trim()
    const key = normalizeKey(supplierName, supplierPhone)
    const product = isPopulatedProduct(receipt.productId)
      ? receipt.productId
      : null
    const existing =
      suppliersByKey.get(key) ??
      {
        id: key,
        name: supplierName,
        phone: supplierPhone,
        totalSupplied: 0,
        receiptsCount: 0,
        receipts: [],
      }

    existing.totalSupplied += receipt.totalCost
    existing.receiptsCount += 1
    existing.receipts.push({
      _id: receipt._id.toString(),
      receivedAtLabel: formatDate(receipt.receivedAt),
      productName: product?.name ?? receipt.sku,
      sku: product?.sku ?? receipt.sku,
      quantity: receipt.quantity,
      unit: product?.unit ?? "pcs",
      unitCost: receipt.unitCost,
      totalCost: receipt.totalCost,
    })
    suppliersByKey.set(key, existing)
  }

  return (
    <CustomersSuppliersManager
      customers={Array.from(customersByKey.values()).sort(
        (a, b) => b.totalPurchases - a.totalPurchases
      )}
      suppliers={Array.from(suppliersByKey.values()).sort(
        (a, b) => b.totalSupplied - a.totalSupplied
      )}
    />
  )
}
