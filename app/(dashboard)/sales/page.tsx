// Loads recorded sales and sellable products for the active branch.
import { connectToDatabase } from "@/lib/db/connection"
import { Sale } from "@/lib/db/models/Sale"
import { Product } from "@/lib/db/models/Product"
import { Invoice } from "@/lib/db/models/Invoice"
import { ReturnModel } from "@/lib/db/models/Return"
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
  deletedAt?: Date
  deletedBy?: PopulatedSaleUser | { toString(): string }
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

type ReturnedQuantityRow = {
  _id: {
    saleId: { toString(): string } | null
    productId: { toString(): string } | null
  }
  quantity: number
}

type SalesReturnStatus = "none" | "partial" | "returned"

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
  const [sales, deletedSales, products, invoices, returnedRows] = await Promise.all([
    Sale.find({ store, deletedAt: null })
      .populate("createdBy", "name email")
      .sort({ createdAt: -1 })
      .lean<SalesPageSale[]>(),
    session.isAdmin
      ? Sale.find({ store, deletedAt: { $ne: null } })
          .populate("createdBy", "name email")
          .populate("deletedBy", "name email")
          .sort({ deletedAt: -1 })
          .lean<SalesPageSale[]>()
      : Promise.resolve<SalesPageSale[]>([]),
    Product.find({ store }).sort({ name: 1 }).lean<SalesPageProduct[]>(),
    Invoice.find({ store, sourceType: "sale", deletedAt: null })
      .select("saleId")
      .lean<SalesPageInvoice[]>(),
    ReturnModel.aggregate<ReturnedQuantityRow>([
      { $match: { store, saleId: { $ne: null } } },
      { $unwind: "$returnItems" },
      {
        $group: {
          _id: {
            saleId: "$saleId",
            productId: "$returnItems.productId",
          },
          quantity: { $sum: "$returnItems.quantity" },
        },
      },
    ]),
  ])

  const returnedQuantityBySaleId = new Map<string, number>()
  const returnedItemsBySaleId = new Map<
    string,
    Array<{ productId: string; quantity: number }>
  >()
  returnedRows.forEach((row) => {
    const saleId = row._id.saleId?.toString()
    const productId = row._id.productId?.toString()
    if (!saleId || !productId) return

    returnedQuantityBySaleId.set(
      saleId,
      (returnedQuantityBySaleId.get(saleId) ?? 0) + row.quantity
    )
    const items = returnedItemsBySaleId.get(saleId) ?? []
    items.push({ productId, quantity: row.quantity })
    returnedItemsBySaleId.set(saleId, items)
  })

  const getReturnStatus = (sale: SalesPageSale): SalesReturnStatus => {
    const soldQuantity = sale.items.reduce((sum, item) => sum + item.quantity, 0)
    const returnedQuantity =
      returnedQuantityBySaleId.get(sale._id.toString()) ?? 0
    if (returnedQuantity <= 0) return "none"
    return returnedQuantity >= soldQuantity ? "returned" : "partial"
  }

  const serializeSale = (sale: SalesPageSale) => ({
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
    returnedItems: returnedItemsBySaleId.get(sale._id.toString()) ?? [],
    returnStatus: getReturnStatus(sale),
  })

  const serializedSales = sales.map(serializeSale)
  const serializedDeletedSales = deletedSales.map((sale) => ({
    ...serializeSale(sale),
    deletedAtLabel: sale.deletedAt
      ? formatInKigali(sale.deletedAt, {
          year: "numeric",
          month: "short",
          day: "2-digit",
        })
      : "-",
    deletedByName: isPopulatedSaleUser(sale.deletedBy)
      ? sale.deletedBy.name ?? sale.deletedBy.email ?? "Unknown User"
      : "Unknown User",
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
      initialDeletedSales={serializedDeletedSales}
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
