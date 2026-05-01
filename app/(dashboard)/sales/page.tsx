import { connectToDatabase } from "@/lib/db/connection"
import { Sale } from "@/lib/db/models/Sale"
import { Product } from "@/lib/db/models/Product"
import "@/lib/db/models/User"
import { getCurrentStore, requireServerSession } from "@/lib/auth/server"
import { SalesManager } from "@/components/sales/sales-manager"

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
  items: SalesPageSaleItem[]
}

type SalesPageProduct = {
  _id: { toString(): string }
  name: string
  sku: string
  unit?: string
  quantity: number
  price: number
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

export default async function SalesPage() {
  const session = await requireServerSession()
  const store = getCurrentStore(session)

  await connectToDatabase()
  const sales = await Sale.find({ store })
    .populate("createdBy", "name email")
    .sort({ createdAt: -1 })
    .lean<SalesPageSale[]>()
  const products = await Product.find({ store })
    .sort({ name: 1 })
    .lean<SalesPageProduct[]>()

  const serializedSales = sales.map((sale) => ({
    ...sale,
    _id: sale._id.toString(),
    createdAt: sale.createdAt?.toISOString(),
    createdAtLabel: sale.createdAt
      ? new Date(sale.createdAt).toLocaleString("en-US", {
          year: "numeric",
          month: "short",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
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
  }))

  return (
    <SalesManager
      initialSales={serializedSales}
      products={serializedProducts}
      currentUserLabel={session.email}
    />
  )
}
