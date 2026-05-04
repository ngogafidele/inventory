import { connectToDatabase } from "@/lib/db/connection"
import { Invoice } from "@/lib/db/models/Invoice"
import { Sale } from "@/lib/db/models/Sale"
import { getCurrentStore, requireServerSession } from "@/lib/auth/server"
import { InvoicesManager } from "@/components/invoices/invoices-manager"
import { formatInKigali } from "@/lib/utils/time"

type InvoiceSaleItem = {
  name: string
  sku: string
  unit?: string
  quantity: number
  sellingPrice: number
  lineTotal: number
}

type InvoiceSale = {
  _id: { toString(): string }
  createdAt?: Date
  totalAmount: number
  items: InvoiceSaleItem[]
}

type InvoicePageInvoice = {
  _id: { toString(): string }
  saleId: { toString(): string }
  invoiceNumber: string
  customerName: string
  customerEmail?: string
  customerPhone?: string
  totalAmount: number
  status: "unpaid" | "paid"
  issuedAt?: Date
  dueDate?: Date
}

export default async function InvoicesPage() {
  const session = await requireServerSession()
  const store = getCurrentStore(session)

  await connectToDatabase()
  const [invoices, sales] = await Promise.all([
    Invoice.find({ store }).sort({ issuedAt: -1 }).lean<InvoicePageInvoice[]>(),
    Sale.find({ store })
      .select("items totalAmount createdAt")
      .sort({ createdAt: -1 })
      .lean<InvoiceSale[]>(),
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
      ? formatInKigali(sale.createdAt, {
          month: "short",
          day: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
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
