import { Alert } from "@/lib/db/models/Alert"

export const LOW_STOCK_THRESHOLD = 10

export async function syncLowStockAlert(params: {
  store: "store1" | "store2"
  productId: string
  name: string
  sku: string
  quantity: number
}) {
  const { store, productId, name, sku, quantity } = params

  if (quantity < LOW_STOCK_THRESHOLD) {
    const severity = quantity <= 3 ? "high" : "medium"
    const message = `Low stock: ${name} (${sku}) has ${quantity} left`

    await Alert.findOneAndUpdate(
      { store, productId, type: "low-stock", isResolved: false },
      { message, severity, isResolved: false },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    )
    return
  }

  await Alert.updateMany(
    { store, productId, type: "low-stock", isResolved: false },
    { isResolved: true, resolvedAt: new Date() }
  )
}
