import { connectToDatabase } from "@/lib/db/connection"
import { Category } from "@/lib/db/models/Category"
import { getCurrentStore, requireServerSession } from "@/lib/auth/server"
import { CategoriesManager } from "@/components/categories/categories-manager"

export default async function CategoriesPage() {
  const session = await requireServerSession()
  const store = getCurrentStore(session)

  await connectToDatabase()
  const categories = await Category.find({ store }).lean()

  const serializedCategories = categories.map((category) => ({
    ...category,
    _id: category._id.toString(),
    createdAt: category.createdAt?.toISOString(),
    updatedAt: category.updatedAt?.toISOString(),
  }))

  return (
    <CategoriesManager
      initialCategories={serializedCategories}
      isAdmin={session.isAdmin}
    />
  )
}
