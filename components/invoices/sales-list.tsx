"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Image from "next/image"
import { Download, Eye, Filter, Pencil, Search, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import type { StoreKey } from "@/lib/auth/session"
import { formatCurrency } from "@/lib/utils/format"
import { formatInKigali } from "@/lib/utils/time"

type InvoiceStatus = "unpaid" | "paid"

type SalesInvoice = {
  _id: string
  saleId?: string
  invoiceNumber: string
  customerName: string
  customerEmail?: string
  customerPhone?: string
  totalAmount: number
  status: InvoiceStatus
  issuedAt?: string
  dueDate?: string
}

export type SaleInvoiceSaleOption = {
  _id: string
  label: string
  totalAmount: number
}

type FormState = {
  saleId: string
  customerName: string
  customerEmail: string
  customerPhone: string
  status: InvoiceStatus
}

const emptyForm: FormState = {
  saleId: "",
  customerName: "",
  customerEmail: "",
  customerPhone: "",
  status: "unpaid",
}

function formatDate(date: string | undefined) {
  if (!date) return "-"
  return formatInKigali(date, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  })
}

function StatusBadge({ status }: { status: InvoiceStatus }) {
  const classes =
    status === "paid"
      ? "bg-green-100 text-green-800 border-green-200"
      : "bg-amber-100 text-amber-800 border-amber-200"

  return (
    <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${classes}`}>
      {status}
    </span>
  )
}

export function SalesInvoicesList({
  storeId,
  sales,
  canManageInvoices,
  canDeleteInvoices,
  newInvoiceSignal,
}: {
  storeId: StoreKey
  sales: SaleInvoiceSaleOption[]
  canManageInvoices: boolean
  canDeleteInvoices: boolean
  newInvoiceSignal: number
}) {
  const [invoices, setInvoices] = useState<SalesInvoice[]>([])
  const [search, setSearch] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [detailInvoice, setDetailInvoice] = useState<SalesInvoice | null>(null)
  const [activeInvoiceId, setActiveInvoiceId] = useState<string | null>(null)
  const [formState, setFormState] = useState<FormState>(emptyForm)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const lastNewInvoiceSignalRef = useRef(newInvoiceSignal)

  useEffect(() => {
    async function loadInvoices() {
      const response = await fetch(`/api/sales-invoices?store=${storeId}`)
      const body = await response.json()
      if (response.ok && body?.success) {
        setInvoices(
          body.data.map((invoice: SalesInvoice) => ({
            ...invoice,
            _id: invoice._id.toString(),
            saleId: invoice.saleId?.toString(),
          }))
        )
      }
    }

    loadInvoices().catch(() => setError("Failed to load sales invoices."))
  }, [storeId])

  useEffect(() => {
    if (
      newInvoiceSignal > lastNewInvoiceSignalRef.current &&
      canManageInvoices
    ) {
      setActiveInvoiceId(null)
      setFormState(emptyForm)
      setError(null)
      setDialogOpen(true)
    }

    lastNewInvoiceSignalRef.current = newInvoiceSignal
  }, [canManageInvoices, newInvoiceSignal])

  const resetForm = () => {
    setActiveInvoiceId(null)
    setFormState(emptyForm)
    setError(null)
  }

  const openEdit = (invoice: SalesInvoice) => {
    setActiveInvoiceId(invoice._id)
    setFormState({
      saleId: invoice.saleId ?? "",
      customerName: invoice.customerName,
      customerEmail: invoice.customerEmail ?? "",
      customerPhone: invoice.customerPhone ?? "",
      status: invoice.status,
    })
    setError(null)
    setDialogOpen(true)
  }

  const availableSales = useMemo(() => {
    if (activeInvoiceId) return sales

    const invoicedSaleIds = new Set(
      invoices.map((invoice) => invoice.saleId).filter(Boolean)
    )
    return sales.filter((sale) => !invoicedSaleIds.has(sale._id))
  }, [activeInvoiceId, invoices, sales])

  const visibleInvoices = useMemo(() => {
    const needle = search.trim().toLowerCase()
    if (!needle) return invoices
    return invoices.filter((invoice) =>
      [invoice.invoiceNumber, invoice.customerName, invoice.customerEmail]
        .filter(Boolean)
        .some((value) => value?.toLowerCase().includes(needle))
    )
  }, [invoices, search])

  const submitForm = async () => {
    if (!activeInvoiceId && !formState.saleId) {
      setError("Select a sale.")
      return
    }

    if (!formState.customerName.trim()) {
      setError("Select a sale and enter the customer name.")
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const invoiceFields = {
        customerName: formState.customerName.trim(),
        customerEmail: formState.customerEmail.trim() || undefined,
        customerPhone: formState.customerPhone.trim() || undefined,
        status: formState.status,
      }
      const response = await fetch(
        activeInvoiceId
          ? `/api/sales-invoices/${activeInvoiceId}?store=${storeId}`
          : `/api/sales-invoices?store=${storeId}`,
        {
          method: activeInvoiceId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            activeInvoiceId
              ? invoiceFields
              : { ...invoiceFields, saleId: formState.saleId }
          ),
        }
      )
      const body = await response.json()
      if (!response.ok || !body?.success) {
        setError(body?.error ?? "Failed to save sales invoice.")
        return
      }

      const savedInvoice = {
        ...body.data,
        _id: body.data._id.toString(),
        saleId: body.data.saleId?.toString(),
      } as SalesInvoice

      setInvoices((current) =>
        activeInvoiceId
          ? current.map((invoice) =>
              invoice._id === activeInvoiceId ? savedInvoice : invoice
            )
          : [savedInvoice, ...current]
      )
      setDialogOpen(false)
      resetForm()
    } catch {
      setError("Failed to save sales invoice.")
    } finally {
      setSubmitting(false)
    }
  }

  const downloadPdf = async (invoice: SalesInvoice) => {
    setError(null)

    try {
      const response = await fetch(
        `/api/sales-invoices/${invoice._id}/pdf?store=${storeId}`
      )
      if (!response.ok) {
        const body = await response.json().catch(() => null)
        setError(body?.error ?? "Failed to download invoice PDF.")
        return
      }

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `${invoice.invoiceNumber}.pdf`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch {
      setError("Failed to download invoice PDF.")
    }
  }

  const deleteInvoice = async (invoice: SalesInvoice) => {
    if (!confirm(`Delete invoice ${invoice.invoiceNumber}?`)) {
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const response = await fetch(
        `/api/sales-invoices/${invoice._id}?store=${storeId}`,
        { method: "DELETE" }
      )
      const body = await response.json().catch(() => null)

      if (!response.ok || !body?.success) {
        setError(body?.error ?? "Failed to delete invoice.")
        return
      }

      setInvoices((current) =>
        current.filter((item) => item._id !== invoice._id)
      )
      if (detailInvoice?._id === invoice._id) {
        setDetailInvoice(null)
      }
    } catch {
      setError("Failed to delete invoice.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search sales invoices"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <Button variant="outline" type="button">
          <Filter className="size-4" />
          Filter
        </Button>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="overflow-x-auto rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Number</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleInvoices.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-muted-foreground">
                  No sales invoices found.
                </TableCell>
              </TableRow>
            ) : (
              visibleInvoices.map((invoice) => (
                <TableRow key={invoice._id}>
                  <TableCell className="font-semibold">
                    {invoice.invoiceNumber}
                  </TableCell>
                  <TableCell>{formatDate(invoice.issuedAt)}</TableCell>
                  <TableCell>{invoice.customerName}</TableCell>
                  <TableCell>{formatCurrency(invoice.totalAmount)}</TableCell>
                  <TableCell>
                    <StatusBadge status={invoice.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-wrap justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setDetailInvoice(invoice)}
                      >
                        <Eye className="size-4" />
                        View
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => downloadPdf(invoice)}
                      >
                        <Download className="size-4" />
                      </Button>
                      {canDeleteInvoices ? (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openEdit(invoice)}
                            disabled={submitting}
                          >
                            <Pencil className="size-4" />
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => deleteInvoice(invoice)}
                            disabled={submitting}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) resetForm()
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {activeInvoiceId ? "Edit sales invoice" : "New sales invoice"}
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
                  {availableSales.map((sale) => (
                    <SelectItem key={sale._id} value={sale._id}>
                      {sale.label} - {formatCurrency(sale.totalAmount)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            <label className="grid gap-1 text-sm">
              Customer
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
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                placeholder="Email"
                type="email"
                value={formState.customerEmail}
                onChange={(event) =>
                  setFormState((prev) => ({
                    ...prev,
                    customerEmail: event.target.value,
                  }))
                }
              />
              <Input
                placeholder="Phone"
                value={formState.customerPhone}
                onChange={(event) =>
                  setFormState((prev) => ({
                    ...prev,
                    customerPhone: event.target.value,
                  }))
                }
              />
            </div>
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
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
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

      <Dialog
        open={Boolean(detailInvoice)}
        onOpenChange={(open) => !open && setDetailInvoice(null)}
      >
        <DialogContent>
          <DialogHeader>
            <div className="flex items-center gap-3">
              <Image
                src="/images/logo.png"
                alt="Company logo"
                width={48}
                height={48}
                className="h-12 w-12 rounded-md object-contain"
              />
              <DialogTitle>{detailInvoice?.invoiceNumber}</DialogTitle>
            </div>
          </DialogHeader>
          {detailInvoice ? (
            <div className="space-y-2 text-sm">
              <p>Customer: {detailInvoice.customerName}</p>
              <p>Date: {formatDate(detailInvoice.issuedAt)}</p>
              <p>Amount: {formatCurrency(detailInvoice.totalAmount)}</p>
              <p>Status: {detailInvoice.status}</p>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
