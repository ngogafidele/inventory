import { connectToDatabase } from "@/lib/db/connection"
import { StockAdjustment } from "@/lib/db/models/StockAdjustment"
import { Product } from "@/lib/db/models/Product"
import { getCurrentStore, requireServerSession } from "@/lib/auth/server"
import { redirect } from "next/navigation"
import { StockAdjustmentsManager } from "@/components/stock-adjustments/stock-adjustments-manager"

type StockAdjustmentPageAdjustment = {
  _id: { toString(): string }
  productId: { toString(): string }
  adjustedBy: { toString(): string }
  sku: string
  quantityChange: number
  reason: string
  createdAt?: Date
  updatedAt?: Date
}

type StockAdjustmentPageProduct = {
  _id: { toString(): string }
  name: string
  sku: string
  unit?: string
  quantity: number
}

export default async function StockAdjustmentsPage() {
  const session = await requireServerSession()
  if (!session.isAdmin) {
    redirect("/sales")
  }
  const store = getCurrentStore(session)

  await connectToDatabase()
  const adjustments = await StockAdjustment.find({ store })
    .sort({ createdAt: -1 })
    .lean<StockAdjustmentPageAdjustment[]>()
  const products = await Product.find({ store })
    .sort({ name: 1 })
    .lean<StockAdjustmentPageProduct[]>()

  const serializedAdjustments = adjustments.map((adjustment) => ({
    ...adjustment,
    _id: adjustment._id.toString(),
    productId: adjustment.productId.toString(),
    adjustedBy: adjustment.adjustedBy.toString(),
    createdAt: adjustment.createdAt?.toISOString(),
    updatedAt: adjustment.updatedAt?.toISOString(),
  }))

  const serializedProducts = products.map((product) => ({
    _id: product._id.toString(),
    name: product.name,
    sku: product.sku,
    unit: product.unit ?? "pcs",
    quantity: product.quantity,
  }))

  return (
    <StockAdjustmentsManager
      initialAdjustments={serializedAdjustments}
      products={serializedProducts}
    />
  )
}
