// Loads recorded sales and sellable products for the active branch.
import { connectToDatabase } from "@/lib/db/connection"
import { Sale } from "@/lib/db/models/Sale"
import { Product } from "@/lib/db/models/Product"
import { Invoice } from "@/lib/db/models/Invoice"
import "@/lib/db/models/User"
import { getCurrentStore, requireServerSession } from "@/lib/auth/server"
import { SalesManager } from "@/components/sales/sales-manager"
import { formatInKigali, formatKigaliDateInput } from "@/lib/utils/time"

type PopulatedSaleUser = {
  _id: { toString(): string }
  name?: string
  email?: string
}

type SalesPageSaleItem = {
  productId: { toString(): string }
  name: string
  sku: string
  unit?: string
  quantity: number
  basePrice: number
  sellingPrice: number
  lineTotal: number
}

type SalesPageSale = {
  _id: { toString(): string }
  createdAt?: Date
  updatedAt?: Date
  createdBy?: PopulatedSaleUser | { toString(): string }
  totalAmount: number
  notes: string
  paymentStatus?: "paid" | "unpaid"
  paymentMethod?: "cash" | "bank" | "mobile"
  customer?: {
    name?: string
    phone?: string
  }
  outstanding?: {
    customerName?: string
    customerPhone?: string
    paymentDate?: Date
  }
  items: SalesPageSaleItem[]
}

type SalesPageProduct = {
  _id: { toString(): string }
  name: string
  sku: string
  unit?: string
  quantity: number
  price: number
  costPrice?: number
}

type SalesPageInvoice = {
  saleId?: { toString(): string }
}

function isPopulatedSaleUser(
  value: SalesPageSale["createdBy"]
): value is PopulatedSaleUser {
  return (
    typeof value === "object" &&
    value !== null &&
    "_id" in value
  )
}

export default async function SalesPage({
  searchParams,
}: {
  searchParams?: Promise<{
    customerName?: string
    customerPhone?: string
  }>
}) {
  const session = await requireServerSession()
  const store = getCurrentStore(session)
  const resolvedSearchParams = searchParams ? await searchParams : {}

  await connectToDatabase()
  const sales = await Sale.find({ store })
    .populate("createdBy", "name email")
    .sort({ createdAt: -1 })
    .lean<SalesPageSale[]>()
  const products = await Product.find({ store })
    .sort({ name: 1 })
    .lean<SalesPageProduct[]>()
  const invoices = await Invoice.find({ store, sourceType: "sale" })
    .select("saleId")
    .lean<SalesPageInvoice[]>()

  const serializedSales = sales.map((sale) => ({
    ...sale,
    _id: sale._id.toString(),
    createdAt: sale.createdAt?.toISOString(),
    createdAtLabel: sale.createdAt
      ? formatInKigali(sale.createdAt, {
          year: "numeric",
          month: "short",
          day: "2-digit",
        })
      : "-",
    updatedAt: sale.updatedAt?.toISOString(),
    createdBy:
      isPopulatedSaleUser(sale.createdBy)
        ? sale.createdBy._id.toString()
        : sale.createdBy?.toString(),
    createdByName:
      isPopulatedSaleUser(sale.createdBy)
        ? sale.createdBy.name ?? sale.createdBy.email ?? "Unknown User"
        : "Unknown User",
    paymentStatus: sale.paymentStatus ?? "paid",
    paymentMethod: sale.paymentMethod,
    customer: sale.customer
      ? {
          name: sale.customer.name ?? "",
          phone: sale.customer.phone ?? "",
        }
      : undefined,
    outstanding: sale.outstanding
      ? {
          customerName: sale.outstanding.customerName ?? "",
          customerPhone: sale.outstanding.customerPhone ?? "",
          paymentDate: formatKigaliDateInput(sale.outstanding.paymentDate),
        }
      : undefined,
    items: sale.items.map((item) => ({
      ...item,
      productId: item.productId.toString(),
    })),
  }))

  const serializedProducts = products.map((product) => ({
    _id: product._id.toString(),
    name: product.name,
    sku: product.sku,
    unit: product.unit ?? "pcs",
    quantity: product.quantity,
    price: product.price,
    costPrice: product.costPrice,
  }))

  return (
    <SalesManager
      initialSales={serializedSales}
      products={serializedProducts}
      currentUserLabel={session.email}
      isAdmin={session.isAdmin}
      initialInvoicedSaleIds={invoices
        .map((invoice) => invoice.saleId?.toString())
        .filter((saleId): saleId is string => Boolean(saleId))}
      initialCustomer={{
        name: resolvedSearchParams.customerName ?? "",
        phone: resolvedSearchParams.customerPhone ?? "",
      }}
    />
  )
}
