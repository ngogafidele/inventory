import { connectToDatabase } from "@/lib/db/connection"
import { Sale } from "@/lib/db/models/Sale"
import { getCurrentStore, requireServerSession } from "@/lib/auth/server"
import { InvoicesPageClient } from "@/components/invoices/invoices-page-client"
import { formatInKigali } from "@/lib/utils/time"

type InvoicePageSale = {
  _id: { toString(): string }
  createdAt?: Date
  totalAmount: number
}

export default async function InvoicesPage() {
  const session = await requireServerSession()
  const store = getCurrentStore(session)

  await connectToDatabase()
  const sales = await Sale.find({ store })
    .select("totalAmount createdAt")
    .sort({ createdAt: -1 })
    .lean<InvoicePageSale[]>()

  const serializedSales = sales.map((sale) => ({
    _id: sale._id.toString(),
    label: sale.createdAt
      ? formatInKigali(sale.createdAt, {
          month: "short",
          day: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : sale._id.toString(),
    totalAmount: sale.totalAmount,
  }))

  return (
    <InvoicesPageClient
      storeId={store}
      sales={serializedSales}
      canCreateInvoices={true}
      canManageInvoices={session.isAdmin || session.role === "manager"}
      canDeleteInvoices={session.isAdmin}
    />
  )
}
