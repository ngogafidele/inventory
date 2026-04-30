import { connectToDatabase } from "@/lib/db/connection"
import { Sale } from "@/lib/db/models/Sale"
import { Product } from "@/lib/db/models/Product"
import "@/lib/db/models/User"
import { getCurrentStore, requireServerSession } from "@/lib/auth/server"
import { SalesManager } from "@/components/sales/sales-manager"

export default async function SalesPage() {
  const session = await requireServerSession()
  const store = getCurrentStore(session)

  await connectToDatabase()
  const sales = await Sale.find({ store })
    .populate("createdBy", "name email")
    .sort({ createdAt: -1 })
    .lean()
  const products = await Product.find({ store }).sort({ name: 1 }).lean()

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
      typeof sale.createdBy === "object" && sale.createdBy
        ? sale.createdBy._id.toString()
        : sale.createdBy?.toString(),
    createdByName:
      typeof sale.createdBy === "object" && sale.createdBy
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
