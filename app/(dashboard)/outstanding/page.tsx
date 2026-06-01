// Loads unpaid branch sales for customer loan collection and follow-up.
import "@/lib/db/models/User"
import { connectToDatabase } from "@/lib/db/connection"
import { Sale } from "@/lib/db/models/Sale"
import { OutstandingManager } from "@/components/outstanding/outstanding-manager"
import { getCurrentStore, requireServerSession } from "@/lib/auth/server"
import { formatInKigali } from "@/lib/utils/time"

type PopulatedSaleUser = {
  _id: { toString(): string }
  name?: string
  email?: string
}

type OutstandingSaleItem = {
  name: string
  unit?: string
  quantity: number
}

type OutstandingDetails = {
  customerName: string
  customerPhone?: string
  paymentDate?: Date
}

type LoanPayment = {
  amount: number
  paymentMethod: "cash" | "bank" | "mobile"
  paidAt?: Date
  notes?: string
}

type OutstandingSale = {
  _id: { toString(): string }
  createdAt?: Date
  createdBy?: PopulatedSaleUser | { toString(): string }
  totalAmount: number
  amountPaid?: number
  remainingBalance?: number
  payments?: LoanPayment[]
  items: OutstandingSaleItem[]
  outstanding?: OutstandingDetails
}

function isPopulatedSaleUser(
  value: OutstandingSale["createdBy"]
): value is PopulatedSaleUser {
  return typeof value === "object" && value !== null && "_id" in value
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100
}

function getAmountPaid(sale: OutstandingSale) {
  if (typeof sale.amountPaid === "number") return roundMoney(sale.amountPaid)
  return roundMoney(
    (sale.payments ?? []).reduce((sum, payment) => sum + payment.amount, 0)
  )
}

function getRemainingBalance(sale: OutstandingSale) {
  if (typeof sale.remainingBalance === "number") {
    return roundMoney(sale.remainingBalance)
  }
  return Math.max(0, roundMoney(sale.totalAmount - getAmountPaid(sale)))
}

export default async function OutstandingPage() {
  const session = await requireServerSession()
  const store = getCurrentStore(session)

  await connectToDatabase()
  const sales = await Sale.find({
    store,
    paymentStatus: "unpaid",
  })
    .populate("createdBy", "name email")
    .sort({ "outstanding.paymentDate": 1, createdAt: -1 })
    .lean<OutstandingSale[]>()

  const serializedSales = sales.map((sale) => ({
    _id: sale._id.toString(),
    createdAt: sale.createdAt?.toISOString(),
    createdAtLabel: sale.createdAt
      ? formatInKigali(sale.createdAt, {
          year: "numeric",
          month: "short",
          day: "2-digit",
        })
      : "-",
    createdByName: isPopulatedSaleUser(sale.createdBy)
      ? sale.createdBy.name ?? sale.createdBy.email ?? "Unknown User"
      : "Unknown User",
    totalAmount: sale.totalAmount,
    amountPaid: getAmountPaid(sale),
    remainingBalance: getRemainingBalance(sale),
    payments: (sale.payments ?? []).map((payment) => ({
      amount: payment.amount,
      paymentMethod: payment.paymentMethod,
      paidAt: payment.paidAt?.toISOString(),
      notes: payment.notes ?? "",
    })),
    items: sale.items.map((item) => ({
      name: item.name,
      unit: item.unit ?? "pcs",
      quantity: item.quantity,
    })),
    outstanding: sale.outstanding
      ? {
          customerName: sale.outstanding.customerName,
          customerPhone: sale.outstanding.customerPhone,
          paymentDate: sale.outstanding.paymentDate?.toISOString(),
        }
      : undefined,
  }))

  return (
    <OutstandingManager
      initialSales={serializedSales}
      isAdmin={session.isAdmin}
    />
  )
}
