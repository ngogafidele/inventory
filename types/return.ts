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
  returnItems: ReturnItem[]
  replacementItems: ReturnItem[]
  totalReturnAmount: number
  totalReplacementAmount: number
  notes?: string
  createdBy?: string
  createdAt?: string
}
