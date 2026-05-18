export type Expense = {
  id: string
  store: "store1" | "store2"
  description: string
  amount: number
  category: string
  paymentMethod: "cash" | "mobile-money" | "bank"
  date: string
  notes?: string
  createdBy?: string
  createdAt?: string
}
