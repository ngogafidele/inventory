export type ReturnItem = {
  productId: string
  name: string
  sku: string
  unit: string
  quantity: number
  unitPrice: number
  lineTotal: number
}

export type Return = {
  id: string
  store: "store1" | "store2"
  saleId: string
  items: ReturnItem[]
  refundAmount: number
  refundMethod: "cash" | "mobile-money" | "bank"
  reason: string
  returnDate: string
  customerName: string
  customerPhone: string
  notes?: string
  createdBy?: string
  createdAt?: string
}
