import { connectToDatabase } from "@/lib/db/connection"
import { Category } from "@/lib/db/models/Category"
import { Product } from "@/lib/db/models/Product"
import { getCurrentStore, requireServerSession } from "@/lib/auth/server"
import { ProductsManager } from "@/components/products/products-manager"

type ProductsPageCategory = {
  _id: { toString(): string }
  name: string
  description: string
  createdAt?: Date
  updatedAt?: Date
}

type ProductsPageProduct = {
  _id: { toString(): string }
  name: string
  sku: string
  unit?: string
  quantity: number
  lowStockThreshold?: number
  costPrice: number
  price: number
  categoryId?: { toString(): string } | ProductsPageCategory
  createdAt?: Date
  updatedAt?: Date
}

function isPopulatedCategory(
  value: ProductsPageProduct["categoryId"]
): value is ProductsPageCategory {
  return (
    typeof value === "object" &&
    value !== null &&
    "_id" in value
  )
}

export default async function ProductsPage() {
  const session = await requireServerSession()
  const store = getCurrentStore(session)

  await connectToDatabase()
  const products = await Product.find({ store })
    .populate("categoryId")
    .lean<ProductsPageProduct[]>()
  const categories = await Category.find({ store })
    .lean<ProductsPageCategory[]>()

  const serializedProducts = products.map((product) => {
    const category =
      isPopulatedCategory(product.categoryId)
        ? {
            ...product.categoryId,
            _id: product.categoryId._id.toString(),
            description: product.categoryId.description ?? "",
            createdAt: product.categoryId.createdAt?.toISOString(),
            updatedAt: product.categoryId.updatedAt?.toISOString(),
          }
        : product.categoryId?.toString()

    return {
      ...product,
      _id: product._id.toString(),
      categoryId: category,
      unit: product.unit ?? "pcs",
      lowStockThreshold: product.lowStockThreshold ?? 0,
      createdAt: product.createdAt?.toISOString(),
      updatedAt: product.updatedAt?.toISOString(),
    }
  })

  const serializedCategories = categories.map((category) => ({
    ...category,
    _id: category._id.toString(),
    description: category.description ?? "",
    createdAt: category.createdAt?.toISOString(),
    updatedAt: category.updatedAt?.toISOString(),
  }))

  return (
    <ProductsManager
      initialProducts={serializedProducts}
      categories={serializedCategories}
      isAdmin={session.isAdmin}
    />
  )
}
