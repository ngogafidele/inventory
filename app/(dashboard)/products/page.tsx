// Loads the store-scoped product catalog and current on-hand inventory.
import { connectToDatabase } from "@/lib/db/connection"
import { Product } from "@/lib/db/models/Product"
import { ProductReceipt } from "@/lib/db/models/ProductReceipt"
import { getCurrentStore, requireServerSession } from "@/lib/auth/server"
import { ProductsManager } from "@/components/products/products-manager"
import { formatInKigali } from "@/lib/utils/time"
import type { PackUnit } from "@/lib/utils/units"
import { storeUsesPackUnits } from "@/lib/utils/constants"

type ProductsPageProduct = {
  _id: { toString(): string }
  name: string
  sku: string
  unit?: string
  packUnits?: PackUnit[]
  quantity: number
  lowStockThreshold?: number
  costPrice: number
  price: number
  createdAt?: Date
  updatedAt?: Date
}

type ProductsPageReceipt = {
  productId: { toString(): string }
  supplierName: string
  receivedAt: Date
}

export default async function ProductsPage() {
  const session = await requireServerSession()
  const store = getCurrentStore(session)

  await connectToDatabase()
  const products = await Product.find({ store }).lean<ProductsPageProduct[]>()
  const receipts = await ProductReceipt.find({ store })
    .sort({ receivedAt: -1, createdAt: -1 })
    .lean<ProductsPageReceipt[]>()
  const latestReceiptByProduct = new Map<string, ProductsPageReceipt>()
  for (const receipt of receipts) {
    const productId = receipt.productId.toString()
    if (!latestReceiptByProduct.has(productId)) {
      latestReceiptByProduct.set(productId, receipt)
    }
  }

  const serializedProducts = products.map((product) => {
    const latestReceipt = latestReceiptByProduct.get(product._id.toString())
    return {
      ...product,
      _id: product._id.toString(),
      unit: product.unit ?? "pcs",
      packUnits: (product.packUnits ?? []).map((pack) => ({
        name: pack.name,
        factor: pack.factor,
        price: pack.price,
      })),
      lowStockThreshold: product.lowStockThreshold ?? 0,
      lastRestock: latestReceipt?.receivedAt.toISOString(),
      lastRestockLabel: latestReceipt
        ? formatInKigali(latestReceipt.receivedAt, {
            year: "numeric",
            month: "short",
            day: "2-digit",
          })
        : "-",
      supplierName: latestReceipt?.supplierName ?? "-",
      createdAt: product.createdAt?.toISOString(),
      updatedAt: product.updatedAt?.toISOString(),
    }
  })

  return (
    <ProductsManager
      initialProducts={serializedProducts}
      isAdmin={session.isAdmin}
      packUnitsEnabled={storeUsesPackUnits(store)}
    />
  )
}
