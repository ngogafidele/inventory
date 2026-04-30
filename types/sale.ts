export type SaleItem = {
  id: string
  name: string
  unit: string
  quantity: number
  sellingPrice: number
  lineTotal: number
}

export type Sale = {
  id: string
  store: "store1" | "store2"
  items: SaleItem[]
  totalAmount: number
  createdAt: string
}
