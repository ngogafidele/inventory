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

type OutstandingSale = {
  _id: { toString(): string }
  createdAt?: Date
  createdBy?: PopulatedSaleUser | { toString(): string }
  totalAmount: number
  items: OutstandingSaleItem[]
  outstanding?: OutstandingDetails
}

function isPopulatedSaleUser(
  value: OutstandingSale["createdBy"]
): value is PopulatedSaleUser {
  return typeof value === "object" && value !== null && "_id" in value
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
