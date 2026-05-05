import { connectToDatabase } from "@/lib/db/connection"
import { Product } from "@/lib/db/models/Product"
import { getCurrentStore, requireServerSession } from "@/lib/auth/server"
import { ProductsManager } from "@/components/products/products-manager"

type ProductsPageProduct = {
  _id: { toString(): string }
  name: string
  sku: string
  unit?: string
  quantity: number
  lowStockThreshold?: number
  costPrice: number
  price: number
  createdAt?: Date
  updatedAt?: Date
}

export default async function ProductsPage() {
  const session = await requireServerSession()
  const store = getCurrentStore(session)

  await connectToDatabase()
  const products = await Product.find({ store }).lean<ProductsPageProduct[]>()

  const serializedProducts = products.map((product) => {
    return {
      ...product,
      _id: product._id.toString(),
      unit: product.unit ?? "pcs",
      lowStockThreshold: product.lowStockThreshold ?? 0,
      createdAt: product.createdAt?.toISOString(),
      updatedAt: product.updatedAt?.toISOString(),
    }
  })

  return (
    <ProductsManager
      initialProducts={serializedProducts}
      isAdmin={session.isAdmin}
    />
  )
}
