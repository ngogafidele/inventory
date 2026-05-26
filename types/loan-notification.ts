export type LoanNotification = {
  id: string
  customerName: string
  customerPhone?: string
  amount: number
  paymentDateLabel: string
  status: "due" | "overdue"
}
