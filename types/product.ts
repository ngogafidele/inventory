export type Product = {
  id: string
  name: string
  sku: string
  unit: string
  quantity: number
  lowStockThreshold: number
  costPrice: number
  price: number
  store: "store1" | "store2"
}
