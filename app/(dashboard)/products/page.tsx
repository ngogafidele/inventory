import { connectToDatabase } from "@/lib/db/connection"
import { Category } from "@/lib/db/models/Category"
import { Product } from "@/lib/db/models/Product"
import { getCurrentStore, requireServerSession } from "@/lib/auth/server"
import { ProductsManager } from "@/components/products/products-manager"

export default async function ProductsPage() {
  const session = await requireServerSession()
  const store = getCurrentStore(session)

  await connectToDatabase()
  const products = await Product.find({ store }).populate("categoryId").lean()
  const categories = await Category.find({ store }).lean()

  const serializedProducts = products.map((product) => {
    const category =
      typeof product.categoryId === "object" && product.categoryId
        ? {
            ...product.categoryId,
            _id: product.categoryId._id.toString(),
            createdAt: product.categoryId.createdAt?.toISOString(),
            updatedAt: product.categoryId.updatedAt?.toISOString(),
          }
        : product.categoryId?.toString()

    return {
      ...product,
      _id: product._id.toString(),
      categoryId: category,
      createdAt: product.createdAt?.toISOString(),
      updatedAt: product.updatedAt?.toISOString(),
    }
  })

  const serializedCategories = categories.map((category) => ({
    ...category,
    _id: category._id.toString(),
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
