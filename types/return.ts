// Describes returned items and recorded branch return transactions.
export type ReturnItem = {
  productId: string
  name: string
  sku: string
  unit: string
  quantity: number
  basePrice: number
  unitPrice: number
  lineTotal: number
}

export type Return = {
  id: string
  store: "store1" | "store2"
  returnItems: ReturnItem[]
  totalReturnAmount: number
  notes?: string
  createdBy?: string
  createdAt?: string
}
