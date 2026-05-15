"use client"

import { useMemo, useState } from "react"
import { formatCurrency } from "@/lib/utils/format"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  formatInKigali,
  formatKigaliDateInput,
  parseKigaliDateInput,
} from "@/lib/utils/time"

type InvoiceStatus = "unpaid" | "paid"

type InvoiceClient = {
  _id: string
  saleId: string
  invoiceNumber: string
  customerName: string
  customerEmail?: string
  customerPhone?: string
  totalAmount: number
  status: InvoiceStatus
  issuedAt?: string
  dueDate?: string
}

type SaleOption = {
  _id: string
  label: string
  totalAmount: number
  items: Array<{
    name: string
    sku: string
    unit: string
    quantity: number
    sellingPrice: number
    lineTotal: number
  }>
}

type FormState = {
  saleId: string
  customerName: string
  customerEmail: string
  customerPhone: string
  status: InvoiceStatus
  dueDate: string
}

const emptyForm: FormState = {
  saleId: "",
  customerName: "",
  customerEmail: "",
  customerPhone: "",
  status: "unpaid",
  dueDate: "",
}

function formatInvoiceDate(date: string | undefined) {
  if (!date) return "-"

  return formatInKigali(date, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  })
}

function toDateInputValue(date: string | undefined) {
  return formatKigaliDateInput(date)
}

function toDateTimePayload(date: string) {
  if (!date) return undefined
  const parsed = parseKigaliDateInput(date)
  return parsed ? parsed.toISOString() : undefined
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

export function InvoicesManager({
  initialInvoices,
  sales,
  canManageInvoices,
  canDeleteInvoices,
}: {
  initialInvoices: InvoiceClient[]
  sales: SaleOption[]
  canManageInvoices: boolean
  canDeleteInvoices: boolean
}) {
  const [invoices, setInvoices] = useState(initialInvoices)
  const [formState, setFormState] = useState<FormState>(emptyForm)
  const [activeInvoiceId, setActiveInvoiceId] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const invoicedSaleIds = useMemo(
    () => new Set(invoices.map((invoice) => invoice.saleId)),
    [invoices]
  )

  const saleOptions = useMemo(() => {
    if (activeInvoiceId) return sales
    return sales.filter((sale) => !invoicedSaleIds.has(sale._id))
  }, [activeInvoiceId, invoicedSaleIds, sales])

  const salesById = useMemo(
    () => new Map(sales.map((sale) => [sale._id, sale])),
    [sales]
  )

  const resetForm = () => {
    setFormState(emptyForm)
    setActiveInvoiceId(null)
    setError(null)
  }

  const openCreate = () => {
    resetForm()
    setDialogOpen(true)
  }

  const openEdit = (invoice: InvoiceClient) => {
    setFormState({
      saleId: invoice.saleId,
      customerName: invoice.customerName,
      customerEmail: invoice.customerEmail ?? "",
      customerPhone: invoice.customerPhone ?? "",
      status: invoice.status,
      dueDate: toDateInputValue(invoice.dueDate),
    })
    setActiveInvoiceId(invoice._id)
    setError(null)
    setDialogOpen(true)
  }

  const submitForm = async () => {
    if (!formState.customerName.trim()) {
      setError("Please provide the customer name.")
      return
    }

    if (!activeInvoiceId && !formState.saleId) {
      setError("Please select a sale.")
      return
    }

    setSubmitting(true)
    setError(null)

    const invoiceFields = {
      customerName: formState.customerName.trim(),
      customerEmail: formState.customerEmail.trim() || undefined,
      customerPhone: formState.customerPhone.trim() || undefined,
      status: formState.status,
      dueDate: toDateTimePayload(formState.dueDate),
    }
    const payload = activeInvoiceId
      ? invoiceFields
      : { ...invoiceFields, saleId: formState.saleId }

    try {
      const response = await fetch(
        activeInvoiceId ? `/api/invoices/${activeInvoiceId}` : "/api/invoices",
        {
          method: activeInvoiceId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      )

      const body = await response.json()
      if (!response.ok || !body?.success) {
        setError(body?.error ?? "Failed to save invoice.")
        return
      }

      const updated = {
        ...body.data,
        _id: body.data._id.toString(),
        saleId: body.data.saleId.toString(),
      } as InvoiceClient

      setInvoices((current) => {
        if (activeInvoiceId) {
          return current.map((invoice) =>
            invoice._id === activeInvoiceId ? updated : invoice
          )
        }
        return [updated, ...current]
      })

      setDialogOpen(false)
      resetForm()
    } catch {
      setError("Failed to save invoice.")
    } finally {
      setSubmitting(false)
    }
  }

  const deleteInvoice = async (invoiceId: string) => {
    if (!confirm("Delete this invoice?")) {
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const response = await fetch(`/api/invoices/${invoiceId}`, {
        method: "DELETE",
      })
      const body = await response.json()
      if (!response.ok || !body?.success) {
        setError(body?.error ?? "Failed to delete invoice.")
        return
      }

      setInvoices((current) =>
        current.filter((invoice) => invoice._id !== invoiceId)
      )
    } catch {
      setError("Failed to delete invoice.")
    } finally {
      setSubmitting(false)
    }
  }

  const produceInvoicePdf = (invoice: InvoiceClient) => {
    const printWindow = window.open("", "_blank")
    if (!printWindow) {
      setError("Allow pop-ups to produce the invoice PDF.")
      return
    }

    const sale = salesById.get(invoice.saleId)
    const generatedAt = formatInKigali(new Date(), {
      month: "short",
      day: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })

    const rows = sale?.items
      .map(
        (item, index) => `
          <tr>
            <td>${index + 1}</td>
            <td>
              <strong>${escapeHtml(item.name)}</strong>
              <span>${escapeHtml(item.sku)}</span>
            </td>
            <td>${escapeHtml(String(item.quantity))} ${escapeHtml(item.unit)}</td>
            <td>${escapeHtml(formatCurrency(item.sellingPrice))}</td>
            <td>${escapeHtml(formatCurrency(item.lineTotal))}</td>
          </tr>
        `
      )
      .join("")

    printWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>${escapeHtml(invoice.invoiceNumber)}</title>
          <style>
            * { box-sizing: border-box; }
            body {
              margin: 0;
              padding: 36px;
              color: #111827;
              font-family: Arial, sans-serif;
              background: #ffffff;
            }
            header {
              display: flex;
              justify-content: space-between;
              gap: 32px;
              border-bottom: 2px solid #f08010;
              padding-bottom: 18px;
              margin-bottom: 28px;
            }
            h1 {
              margin: 0 0 8px;
              font-size: 32px;
              letter-spacing: 0;
            }
            h2 {
              margin: 0 0 8px;
              font-size: 16px;
            }
            p {
              margin: 0 0 5px;
              color: #5f6673;
              font-size: 13px;
            }
            .invoice-meta {
              text-align: right;
              white-space: nowrap;
            }
            .grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 24px;
              margin-bottom: 28px;
            }
            .panel {
              border: 1px solid #d8dee8;
              padding: 16px;
              min-height: 112px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              font-size: 12px;
            }
            th {
              background: #eef3f8;
              color: #00183d;
              text-align: left;
              border: 1px solid #cbd7e6;
              padding: 10px 8px;
            }
            td {
              border: 1px solid #d8dee8;
              padding: 9px 8px;
              vertical-align: top;
            }
            td span {
              display: block;
              margin-top: 3px;
              color: #6b7280;
              font-size: 11px;
            }
            .total {
              display: flex;
              justify-content: flex-end;
              margin-top: 18px;
            }
            .total div {
              min-width: 260px;
              border: 1px solid #cbd7e6;
              padding: 16px;
              background: #fbfcfe;
            }
            .total strong {
              display: flex;
              justify-content: space-between;
              gap: 24px;
              font-size: 18px;
            }
            @page {
              size: A4;
              margin: 14mm;
            }
            @media print {
              body { padding: 0; }
            }
          </style>
        </head>
        <body>
          <header>
            <div>
              <h1>Invoice</h1>
              <p>${escapeHtml(invoice.invoiceNumber)}</p>
            </div>
            <div class="invoice-meta">
              <p><strong>Status:</strong> ${escapeHtml(invoice.status)}</p>
              <p><strong>Issued:</strong> ${escapeHtml(formatInvoiceDate(invoice.issuedAt))}</p>
              <p><strong>Due:</strong> ${escapeHtml(formatInvoiceDate(invoice.dueDate))}</p>
              <p>Generated ${escapeHtml(generatedAt)}</p>
            </div>
          </header>

          <section class="grid">
            <div class="panel">
              <h2>Bill To</h2>
              <p><strong>${escapeHtml(invoice.customerName)}</strong></p>
              ${
                invoice.customerEmail
                  ? `<p>${escapeHtml(invoice.customerEmail)}</p>`
                  : ""
              }
              ${
                invoice.customerPhone
                  ? `<p>${escapeHtml(invoice.customerPhone)}</p>`
                  : ""
              }
            </div>
            <div class="panel">
              <h2>Sale Reference</h2>
              <p>${escapeHtml(sale?.label ?? invoice.saleId)}</p>
            </div>
          </section>

          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Item</th>
                <th>Quantity</th>
                <th>Price</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              ${rows || '<tr><td colspan="5">No sale items found.</td></tr>'}
            </tbody>
          </table>

          <section class="total">
            <div>
              <strong>
                <span>Total</span>
                <span>${escapeHtml(formatCurrency(invoice.totalAmount))}</span>
              </strong>
            </div>
          </section>

          <script>
            window.addEventListener("load", () => {
              window.print();
            });
          </script>
        </body>
      </html>
    `)
    printWindow.document.close()
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Billing
          </p>
          <h2 className="text-2xl font-semibold">Invoices</h2>
        </div>
        {canManageInvoices ? (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreate} disabled={saleOptions.length === 0}>
                Create Invoice
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {activeInvoiceId ? "Edit invoice" : "Create invoice"}
                </DialogTitle>
              </DialogHeader>
              <div className="grid gap-3">
                <label className="grid gap-1 text-sm">
                  Sale
                  <Select
                    value={formState.saleId}
                    onValueChange={(value) =>
                      setFormState((prev) => ({ ...prev, saleId: value }))
                    }
                    disabled={Boolean(activeInvoiceId)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select sale" />
                    </SelectTrigger>
                    <SelectContent>
                      {saleOptions.map((sale) => (
                        <SelectItem key={sale._id} value={sale._id}>
                          {sale.label} - {formatCurrency(sale.totalAmount)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>
                <label className="grid gap-1 text-sm">
                  Customer Name
                  <Input
                    value={formState.customerName}
                    onChange={(event) =>
                      setFormState((prev) => ({
                        ...prev,
                        customerName: event.target.value,
                      }))
                    }
                  />
                </label>
                <label className="grid gap-1 text-sm">
                  Customer Email
                  <Input
                    type="email"
                    value={formState.customerEmail}
                    onChange={(event) =>
                      setFormState((prev) => ({
                        ...prev,
                        customerEmail: event.target.value,
                      }))
                    }
                  />
                </label>
                <label className="grid gap-1 text-sm">
                  Customer Phone
                  <Input
                    value={formState.customerPhone}
                    onChange={(event) =>
                      setFormState((prev) => ({
                        ...prev,
                        customerPhone: event.target.value,
                      }))
                    }
                  />
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-1 text-sm">
                    Status
                    <Select
                      value={formState.status}
                      onValueChange={(value) =>
                        setFormState((prev) => ({
                          ...prev,
                          status: value as InvoiceStatus,
                        }))
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unpaid">Unpaid</SelectItem>
                        <SelectItem value="paid">Paid</SelectItem>
                      </SelectContent>
                    </Select>
                  </label>
                  <label className="grid gap-1 text-sm">
                    Due Date
                    <Input
                      type="date"
                      value={formState.dueDate}
                      onChange={(event) =>
                        setFormState((prev) => ({
                          ...prev,
                          dueDate: event.target.value,
                        }))
                      }
                    />
                  </label>
                </div>
                {error ? (
                  <p className="text-sm text-destructive">{error}</p>
                ) : null}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={submitForm} disabled={submitting}>
                  {submitting
                    ? "Saving..."
                    : activeInvoiceId
                    ? "Save changes"
                    : "Create invoice"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        ) : null}
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Invoice</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Total</TableHead>
            <TableHead>Due</TableHead>
            {canManageInvoices ? (
              <TableHead className="text-right">Actions</TableHead>
            ) : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {invoices.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={canManageInvoices ? 7 : 6}
                className="text-muted-foreground"
              >
                No invoices created yet.
              </TableCell>
            </TableRow>
          ) : (
            invoices.map((invoice) => (
              <TableRow key={invoice._id}>
                <TableCell>
                  <Button
                    type="button"
                    variant="link"
                    className="h-auto p-0 font-semibold"
                    onClick={() => produceInvoicePdf(invoice)}
                  >
                    {invoice.invoiceNumber}
                  </Button>
                </TableCell>
                <TableCell>{formatInvoiceDate(invoice.issuedAt)}</TableCell>
                <TableCell>
                  <p className="font-medium">{invoice.customerName}</p>
                  {invoice.customerEmail ? (
                    <p className="text-xs text-muted-foreground">
                      {invoice.customerEmail}
                    </p>
                  ) : null}
                </TableCell>
                <TableCell className="capitalize">{invoice.status}</TableCell>
                <TableCell>{formatCurrency(invoice.totalAmount)}</TableCell>
                <TableCell>{formatInvoiceDate(invoice.dueDate)}</TableCell>
                {canManageInvoices ? (
                  <TableCell className="text-right">
                    <div className="flex flex-wrap justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openEdit(invoice)}
                      >
                        Edit
                      </Button>
                      {canDeleteInvoices ? (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => deleteInvoice(invoice._id)}
                          disabled={submitting}
                        >
                          Delete
                        </Button>
                      ) : null}
                    </div>
                  </TableCell>
                ) : null}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
