"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Image from "next/image"
import {
  Download,
  Eye,
  Plus,
  Search,
  Trash2,
} from "lucide-react"
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

type ProformaInvoice = {
  _id: string
  proformaNumber: string
  customerName: string
  customerEmail?: string
  customerPhone?: string
  totalAmount: number
  issuedAt?: string
  items: Array<{
    description: string
    unit?: string
    quantity: number
    unitPrice: number
    lineTotal: number
  }>
}

type FormState = {
  customerName: string
  customerEmail: string
  customerPhone: string
  items: FormItem[]
}

type FormItem = {
  id: string
  description: string
  unit: string
  quantity: string
  unitPrice: string
}

function createItemId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID()
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function createEmptyItem(): FormItem {
  return {
    id: createItemId(),
    description: "",
    unit: "pcs",
    quantity: "1",
    unitPrice: "0",
  }
}

function createEmptyForm(): FormState {
  return {
    customerName: "",
    customerEmail: "",
    customerPhone: "",
    items: [createEmptyItem()],
  }
}

function formatDate(date: string | undefined) {
  if (!date) return "-"
  return formatInKigali(date, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  })
}

export function ProformaInvoicesList({
  storeId,
  canManageInvoices,
  canDeleteInvoices,
  newInvoiceSignal,
}: {
  storeId: StoreKey
  canManageInvoices: boolean
  canDeleteInvoices: boolean
  newInvoiceSignal: number
}) {
  const [proformas, setProformas] = useState<ProformaInvoice[]>([])
  const [search, setSearch] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [detailProforma, setDetailProforma] = useState<ProformaInvoice | null>(
    null
  )
  const [formState, setFormState] = useState<FormState>(() => createEmptyForm())
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const lastNewInvoiceSignalRef = useRef(newInvoiceSignal)

  useEffect(() => {
    async function loadProformas() {
      const params = new URLSearchParams({ store: storeId })
      const response = await fetch(`/api/proformas?${params.toString()}`)
      const body = await response.json()
      if (response.ok && body?.success) {
        setProformas(
          body.data.map((proforma: ProformaInvoice) => ({
            ...proforma,
            _id: proforma._id.toString(),
          }))
        )
      }
    }

    loadProformas().catch(() => setError("Failed to load proforma invoices."))
  }, [storeId])

  useEffect(() => {
    if (
      newInvoiceSignal > lastNewInvoiceSignalRef.current &&
      canManageInvoices
    ) {
      setFormState(createEmptyForm())
      setError(null)
      setDialogOpen(true)
    }

    lastNewInvoiceSignalRef.current = newInvoiceSignal
  }, [canManageInvoices, newInvoiceSignal])

  const visibleProformas = useMemo(() => {
    const needle = search.trim().toLowerCase()
    if (!needle) return proformas
    return proformas.filter((proforma) =>
      [
        proforma.proformaNumber,
        proforma.customerName,
        proforma.customerEmail,
      ]
        .filter(Boolean)
        .some((value) => value?.toLowerCase().includes(needle))
    )
  }, [proformas, search])

  const updateItem = (
    itemId: string,
    field: keyof Omit<FormItem, "id">,
    value: string
  ) => {
    setFormState((prev) => ({
      ...prev,
      items: prev.items.map((item) =>
        item.id === itemId ? { ...item, [field]: value } : item
      ),
    }))
  }

  const addItem = () => {
    setFormState((prev) => ({
      ...prev,
      items: [...prev.items, createEmptyItem()],
    }))
  }

  const removeItem = (itemId: string) => {
    setFormState((prev) => ({
      ...prev,
      items:
        prev.items.length === 1
          ? prev.items
          : prev.items.filter((item) => item.id !== itemId),
    }))
  }

  const submitForm = async () => {
    const items = formState.items
      .map((item) => ({
        description: item.description.trim(),
        unit: item.unit.trim() || "pcs",
        quantity: Number(item.quantity || 1),
        unitPrice: Number(item.unitPrice || 0),
      }))
      .filter((item) => item.description)

    if (!formState.customerName.trim() || items.length === 0) {
      setError("Enter the customer and at least one item.")
      return
    }

    if (
      items.some(
        (item) =>
          !Number.isFinite(item.quantity) ||
          item.quantity < 1 ||
          !Number.isInteger(item.quantity) ||
          !Number.isFinite(item.unitPrice) ||
          item.unitPrice < 0
      )
    ) {
      setError("Quantities must be whole numbers and prices cannot be negative.")
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const response = await fetch(`/api/proformas?store=${storeId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: formState.customerName.trim(),
          customerEmail: formState.customerEmail.trim() || undefined,
          customerPhone: formState.customerPhone.trim() || undefined,
          items,
        }),
      })
      const body = await response.json()
      if (!response.ok || !body?.success) {
        setError(body?.error ?? "Failed to create proforma invoice.")
        return
      }

      setProformas((current) => [body.data, ...current])
      setDialogOpen(false)
      setFormState(createEmptyForm())
    } catch {
      setError("Failed to create proforma invoice.")
    } finally {
      setSubmitting(false)
    }
  }

  const downloadPdf = async (proforma: ProformaInvoice) => {
    setError(null)

    try {
      const response = await fetch(
        `/api/proformas/${proforma._id}/pdf?store=${storeId}`
      )
      if (!response.ok) {
        const body = await response.json().catch(() => null)
        setError(body?.error ?? "Failed to download proforma PDF.")
        return
      }

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `${proforma.proformaNumber}.pdf`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch {
      setError("Failed to download proforma PDF.")
    }
  }

  const deleteProforma = async (proforma: ProformaInvoice) => {
    if (!confirm(`Delete proforma ${proforma.proformaNumber}?`)) {
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const response = await fetch(
        `/api/proformas/${proforma._id}?store=${storeId}`,
        { method: "DELETE" }
      )
      const body = await response.json().catch(() => null)

      if (!response.ok || !body?.success) {
        setError(body?.error ?? "Failed to delete proforma.")
        return
      }

      setProformas((current) =>
        current.filter((item) => item._id !== proforma._id)
      )
      if (detailProforma?._id === proforma._id) {
        setDetailProforma(null)
      }
    } catch {
      setError("Failed to delete proforma.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full lg:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search proforma invoices"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
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
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleProformas.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-muted-foreground">
                  No proforma invoices found.
                </TableCell>
              </TableRow>
            ) : (
              visibleProformas.map((proforma) => (
                <TableRow key={proforma._id}>
                  <TableCell className="font-semibold">
                    {proforma.proformaNumber}
                  </TableCell>
                  <TableCell>{formatDate(proforma.issuedAt)}</TableCell>
                  <TableCell>{proforma.customerName}</TableCell>
                  <TableCell>{formatCurrency(proforma.totalAmount)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-wrap justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setDetailProforma(proforma)}
                      >
                        <Eye className="size-4" />
                        View
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => downloadPdf(proforma)}
                      >
                        <Download className="size-4" />
                      </Button>
                      {canDeleteInvoices ? (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => deleteProforma(proforma)}
                          disabled={submitting}
                        >
                          <Trash2 className="size-4" />
                        </Button>
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
          if (!open) {
            setFormState(createEmptyForm())
            setError(null)
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>New proforma invoice</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <label className="grid gap-1 text-sm">
              Customer name
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
              <label className="grid gap-1 text-sm">
                Customer email optional
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
                Customer phone optional
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
            </div>
            <div className="grid gap-3">
              <h3 className="text-sm font-semibold">Items</h3>

              <div className="grid gap-3">
                {formState.items.map((item, index) => (
                  <div
                    key={item.id}
                    className="grid gap-3 rounded-lg border border-border p-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium">Item {index + 1}</p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => removeItem(item.id)}
                        disabled={formState.items.length === 1}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                    <label className="grid gap-1 text-sm">
                      Item name
                      <Input
                        value={item.description}
                        onChange={(event) =>
                          updateItem(item.id, "description", event.target.value)
                        }
                      />
                    </label>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <label className="grid gap-1 text-sm">
                        Unit
                        <Input
                          value={item.unit}
                          onChange={(event) =>
                            updateItem(item.id, "unit", event.target.value)
                          }
                        />
                      </label>
                      <label className="grid gap-1 text-sm">
                        Quantity
                        <Input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(event) =>
                            updateItem(item.id, "quantity", event.target.value)
                          }
                        />
                      </label>
                      <label className="grid gap-1 text-sm">
                        Unit price
                        <Input
                          type="number"
                          min="0"
                          value={item.unitPrice}
                          onChange={(event) =>
                            updateItem(item.id, "unitPrice", event.target.value)
                          }
                        />
                      </label>
                    </div>
                  </div>
                ))}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addItem}
                className="w-fit"
              >
                <Plus className="size-4" />
                Add item
              </Button>
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitForm} disabled={submitting}>
              {submitting ? "Creating..." : "Create proforma"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(detailProforma)}
        onOpenChange={(open) => !open && setDetailProforma(null)}
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
              <DialogTitle>{detailProforma?.proformaNumber}</DialogTitle>
            </div>
          </DialogHeader>
          {detailProforma ? (
            <div className="space-y-3 text-sm">
              <p>Customer: {detailProforma.customerName}</p>
              <p>Date: {formatDate(detailProforma.issuedAt)}</p>
              <p>Amount: {formatCurrency(detailProforma.totalAmount)}</p>
              <div className="rounded-lg border border-border p-3">
                {detailProforma.items.map((item, index) => (
                  <p key={`${item.description}-${index}`}>
                    {item.description} - {item.quantity}{" "}
                    {item.unit ?? "pcs"} -{" "}
                    {formatCurrency(item.lineTotal)}
                  </p>
                ))}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
