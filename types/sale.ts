// Describes sales records and their line-item value snapshots.
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
  paymentStatus?: "paid" | "unpaid"
  paymentMethod?: "cash" | "bank" | "mobile"
  outstanding?: {
    customerName: string
    customerPhone?: string
    paymentDate?: string
  }
  createdAt: string
}
