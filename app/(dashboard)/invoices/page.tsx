import { connectToDatabase } from "@/lib/db/connection"
import { Invoice } from "@/lib/db/models/Invoice"
import { Sale } from "@/lib/db/models/Sale"
import { getCurrentStore, requireServerSession } from "@/lib/auth/server"
import { InvoicesManager } from "@/components/invoices/invoices-manager"

export default async function InvoicesPage() {
  const session = await requireServerSession()
  const store = getCurrentStore(session)

  await connectToDatabase()
  const [invoices, sales] = await Promise.all([
    Invoice.find({ store }).sort({ issuedAt: -1 }).lean(),
    Sale.find({ store })
      .select("items totalAmount createdAt")
      .sort({ createdAt: -1 })
      .lean(),
  ])

  const serializedInvoices = invoices.map((invoice) => ({
    _id: invoice._id.toString(),
    saleId: invoice.saleId.toString(),
    invoiceNumber: invoice.invoiceNumber,
    customerName: invoice.customerName,
    customerEmail: invoice.customerEmail ?? "",
    customerPhone: invoice.customerPhone ?? "",
    totalAmount: invoice.totalAmount,
    status: invoice.status,
    issuedAt: invoice.issuedAt?.toISOString(),
    dueDate: invoice.dueDate?.toISOString(),
  }))

  const serializedSales = sales.map((sale) => ({
    _id: sale._id.toString(),
    label: sale.createdAt
      ? new Intl.DateTimeFormat("en-US", {
          month: "short",
          day: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }).format(sale.createdAt)
      : sale._id.toString(),
    totalAmount: sale.totalAmount,
    items: sale.items.map((item) => ({
      name: item.name,
      sku: item.sku,
      unit: item.unit ?? "pcs",
      quantity: item.quantity,
      sellingPrice: item.sellingPrice,
      lineTotal: item.lineTotal,
    })),
  }))

  return (
    <InvoicesManager
      initialInvoices={serializedInvoices}
      sales={serializedSales}
      canManageInvoices={session.isAdmin || session.role === "manager"}
      canDeleteInvoices={session.isAdmin}
    />
  )
}
