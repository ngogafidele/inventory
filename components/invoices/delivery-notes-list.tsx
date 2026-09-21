"use client"

// Lists and manages delivery notes for the selected branch.
import { useEffect, useMemo, useRef, useState } from "react"
import Image from "next/image"
import { Download, Eye, Pencil, Search, Trash2 } from "lucide-react"
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
import {
  formatInKigali,
  formatKigaliDateInput,
  parseKigaliDateInput,
} from "@/lib/utils/time"
import type { SaleInvoiceSaleOption } from "@/components/invoices/sales-list"

type DeliveryNote = {
  _id: string
  saleIds: string[]
  deliveryNoteNumber: string
  customerName: string
  customerLocation: string
  deliveryLocation: string
  deliveryDate?: string
  deliveredByName: string
  deliveredByPhone?: string
  deliveredByDate?: string
  issuedAt?: string
  items: Array<{
    description: string
    unit?: string
    quantity: number
  }>
}

type FormState = {
  saleIds: string[]
  customerName: string
  customerLocation: string
  deliveryLocation: string
  deliveryDate: string
  deliveredByName: string
  deliveredByPhone: string
}

const emptyForm: FormState = {
  saleIds: [],
  customerName: "",
  customerLocation: "",
  deliveryLocation: "",
  deliveryDate: "",
  deliveredByName: "",
  deliveredByPhone: "",
}

function createDefaultForm(): FormState {
  const today = formatKigaliDateInput(new Date())
  return {
    ...emptyForm,
    deliveryDate: today,
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

function toDateInputValue(date: string | undefined) {
  return formatKigaliDateInput(date)
}

function toDateTimePayload(date: string) {
  const parsed = parseKigaliDateInput(date)
  return parsed ? parsed.toISOString() : undefined
}

function normalizeDeliveryNote(note: DeliveryNote): DeliveryNote {
  return {
    ...note,
    _id: note._id.toString(),
    saleIds: note.saleIds.map((saleId) => saleId.toString()),
  }
}

export function DeliveryNotesList({
  storeId,
  sales,
  canCreateInvoices,
  canManageInvoices,
  canDeleteInvoices,
  newDeliveryNoteSignal,
}: {
  storeId: StoreKey
  sales: SaleInvoiceSaleOption[]
  canCreateInvoices: boolean
  canManageInvoices: boolean
  canDeleteInvoices: boolean
  newDeliveryNoteSignal: number
}) {
  const [deliveryNotes, setDeliveryNotes] = useState<DeliveryNote[]>([])
  const [search, setSearch] = useState("")
  const [saleSearch, setSaleSearch] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [detailNote, setDetailNote] = useState<DeliveryNote | null>(null)
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null)
  const [formState, setFormState] = useState<FormState>(() => createDefaultForm())
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const lastNewDeliveryNoteSignalRef = useRef(newDeliveryNoteSignal)

  useEffect(() => {
    async function loadDeliveryNotes() {
      const response = await fetch(`/api/delivery-notes?store=${storeId}`)
      const body = await response.json()
      if (response.ok && body?.success) {
        setDeliveryNotes(body.data.map(normalizeDeliveryNote))
      }
    }

    loadDeliveryNotes().catch(() => setError("Failed to load delivery notes."))
  }, [storeId])

  useEffect(() => {
    if (
      newDeliveryNoteSignal > lastNewDeliveryNoteSignalRef.current &&
      canCreateInvoices
    ) {
      setActiveNoteId(null)
      setFormState(createDefaultForm())
      setSaleSearch("")
      setError(null)
      setDialogOpen(true)
    }

    lastNewDeliveryNoteSignalRef.current = newDeliveryNoteSignal
  }, [canCreateInvoices, newDeliveryNoteSignal])

  const visibleDeliveryNotes = useMemo(() => {
    const needle = search.trim().toLowerCase()
    if (!needle) return deliveryNotes
    return deliveryNotes.filter((note) =>
      [
        note.deliveryNoteNumber,
        note.customerName,
        note.customerLocation,
        note.deliveryLocation,
        note.deliveredByName,
      ]
        .filter(Boolean)
        .some((value) => value?.toLowerCase().includes(needle))
    )
  }, [deliveryNotes, search])

  const selectedSalesTotal = useMemo(
    () =>
      sales
        .filter((sale) => formState.saleIds.includes(sale._id))
        .reduce((sum, sale) => sum + sale.totalAmount, 0),
    [formState.saleIds, sales]
  )

  const selectedSales = useMemo(
    () => sales.filter((sale) => formState.saleIds.includes(sale._id)),
    [formState.saleIds, sales]
  )

  const availableSales = useMemo(
    () => sales.filter((sale) => !formState.saleIds.includes(sale._id)),
    [formState.saleIds, sales]
  )

  const filteredAvailableSales = useMemo(() => {
    const needle = saleSearch.trim().toLowerCase()
    if (!needle) return availableSales

    return availableSales.filter((sale) =>
      [sale.label, sale.customerName, formatCurrency(sale.totalAmount)]
        .filter(Boolean)
        .some((value) => value?.toLowerCase().includes(needle))
    )
  }, [availableSales, saleSearch])

  const resetForm = () => {
    setActiveNoteId(null)
    setFormState(createDefaultForm())
    setSaleSearch("")
    setError(null)
  }

  const openEdit = (note: DeliveryNote) => {
    setActiveNoteId(note._id)
    setFormState({
      saleIds: note.saleIds,
      customerName: note.customerName,
      customerLocation: note.customerLocation,
      deliveryLocation: note.deliveryLocation,
      deliveryDate: toDateInputValue(note.deliveryDate),
      deliveredByName: note.deliveredByName,
      deliveredByPhone: note.deliveredByPhone ?? "",
    })
    setSaleSearch("")
    setError(null)
    setDialogOpen(true)
  }

  const toggleSale = (saleId: string) => {
    const selectedSale = sales.find((sale) => sale._id === saleId)
    setFormState((prev) => {
      if (prev.saleIds.includes(saleId)) {
        return {
          ...prev,
          saleIds: prev.saleIds.filter((id) => id !== saleId),
        }
      }

      return {
        ...prev,
        saleIds: [...prev.saleIds, saleId],
        customerName: prev.customerName || selectedSale?.customerName || "",
      }
    })
    setSaleSearch("")
  }

  const submitForm = async () => {
    if (formState.saleIds.length === 0) {
      setError("Select at least one sale.")
      return
    }

    if (
      !formState.customerName.trim() ||
      !formState.customerLocation.trim() ||
      !formState.deliveryLocation.trim()
    ) {
      setError("Enter the customer name, location, and delivery location.")
      return
    }

    if (!formState.deliveryDate) {
      setError("Enter the date of delivery.")
      return
    }

    if (!formState.deliveredByName.trim()) {
      setError("Enter who delivered the goods.")
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const payload = {
        saleIds: formState.saleIds,
        customerName: formState.customerName.trim(),
        customerLocation: formState.customerLocation.trim(),
        deliveryLocation: formState.deliveryLocation.trim(),
        deliveryDate: toDateTimePayload(formState.deliveryDate),
        deliveredByName: formState.deliveredByName.trim(),
        deliveredByPhone: formState.deliveredByPhone.trim() || undefined,
        deliveredByDate: toDateTimePayload(formState.deliveryDate),
      }

      const response = await fetch(
        activeNoteId
          ? `/api/delivery-notes/${activeNoteId}?store=${storeId}`
          : `/api/delivery-notes?store=${storeId}`,
        {
          method: activeNoteId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      )
      const body = await response.json()
      if (!response.ok || !body?.success) {
        setError(body?.error ?? "Failed to save delivery note.")
        return
      }

      const savedNote = normalizeDeliveryNote(body.data as DeliveryNote)
      setDeliveryNotes((current) =>
        activeNoteId
          ? current.map((note) => (note._id === activeNoteId ? savedNote : note))
          : [savedNote, ...current]
      )
      if (detailNote?._id === activeNoteId) {
        setDetailNote(savedNote)
      }
      setDialogOpen(false)
      resetForm()
    } catch {
      setError("Failed to save delivery note.")
    } finally {
      setSubmitting(false)
    }
  }

  const downloadPdf = async (note: DeliveryNote) => {
    setError(null)

    try {
      const response = await fetch(
        `/api/delivery-notes/${note._id}/pdf?store=${storeId}`
      )
      if (!response.ok) {
        const body = await response.json().catch(() => null)
        setError(body?.error ?? "Failed to download delivery note PDF.")
        return
      }

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `${note.deliveryNoteNumber}.pdf`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch {
      setError("Failed to download delivery note PDF.")
    }
  }

  const deleteDeliveryNote = async (note: DeliveryNote) => {
    if (!confirm(`Delete delivery note ${note.deliveryNoteNumber}?`)) {
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const response = await fetch(
        `/api/delivery-notes/${note._id}?store=${storeId}`,
        { method: "DELETE" }
      )
      const body = await response.json().catch(() => null)

      if (!response.ok || !body?.success) {
        setError(body?.error ?? "Failed to delete delivery note.")
        return
      }

      setDeliveryNotes((current) =>
        current.filter((item) => item._id !== note._id)
      )
      if (detailNote?._id === note._id) {
        setDetailNote(null)
      }
    } catch {
      setError("Failed to delete delivery note.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="relative w-full sm:max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Search delivery notes"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="overflow-x-auto rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Number</TableHead>
              <TableHead>Delivery date</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Sales</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleDeliveryNotes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-muted-foreground">
                  No delivery notes found.
                </TableCell>
              </TableRow>
            ) : (
              visibleDeliveryNotes.map((note, noteIndex) => (
                <TableRow
                  key={note._id}
                  className={
                    noteIndex % 2 === 1
                      ? "bg-muted/60 hover:bg-muted/70"
                      : undefined
                  }
                >
                  <TableCell className="font-semibold">
                    {note.deliveryNoteNumber}
                  </TableCell>
                  <TableCell>{formatDate(note.deliveryDate)}</TableCell>
                  <TableCell>{note.customerName}</TableCell>
                  <TableCell>{note.deliveryLocation}</TableCell>
                  <TableCell>{note.saleIds.length}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-wrap justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setDetailNote(note)}
                      >
                        <Eye className="size-4" />
                        View
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => downloadPdf(note)}
                      >
                        <Download className="size-4" />
                      </Button>
                      {canManageInvoices ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openEdit(note)}
                          disabled={submitting}
                        >
                          <Pencil className="size-4" />
                          Edit
                        </Button>
                      ) : null}
                      {canDeleteInvoices ? (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => deleteDeliveryNote(note)}
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
          if (!open) resetForm()
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {activeNoteId ? "Edit delivery note" : "New delivery note"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <label className="grid gap-1 text-sm">
                Search sale/customer
                <Input
                  value={saleSearch}
                  onChange={(event) => setSaleSearch(event.target.value)}
                  placeholder="Type customer name or sale date"
                />
              </label>
              <label className="grid gap-1 text-sm">
                Sale
                <Select
                  value=""
                  onValueChange={toggleSale}
                  disabled={availableSales.length === 0}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select sale" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredAvailableSales.length === 0 ? (
                      <div className="px-2 py-2 text-sm text-muted-foreground">
                        No matching sales.
                      </div>
                    ) : null}
                    {filteredAvailableSales.map((sale) => (
                      <SelectItem
                        key={sale._id}
                        value={sale._id}
                        textValue={`${sale.label} ${sale.customerName ?? ""} ${formatCurrency(sale.totalAmount)}`}
                      >
                        <span className="flex flex-col items-start gap-0.5">
                          <span>
                            {sale.label} - {formatCurrency(sale.totalAmount)}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {sale.customerName
                              ? `Customer: ${sale.customerName}`
                              : "Walk-in customer"}
                          </span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
              <div className="rounded-lg border border-border">
                {selectedSales.length === 0 ? (
                  <p className="p-3 text-sm text-muted-foreground">
                    No sales selected.
                  </p>
                ) : (
                  selectedSales.map((sale) => (
                    <div
                      key={sale._id}
                      className="flex items-center justify-between gap-3 border-b border-border px-3 py-2 text-sm last:border-b-0"
                    >
                      <span className="flex-1">
                        <span className="block">
                          {sale.label} - {formatCurrency(sale.totalAmount)}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {sale.customerName
                            ? `Customer: ${sale.customerName}`
                            : "Walk-in customer"}
                        </span>
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => toggleSale(sale._id)}
                      >
                        Remove
                      </Button>
                    </div>
                  ))
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Selected sales: {formState.saleIds.length}
                {selectedSalesTotal > 0
                  ? `, value ${formatCurrency(selectedSalesTotal)}`
                  : ""}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
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
              <label className="grid gap-1 text-sm">
                Customer location
                <Input
                  value={formState.customerLocation}
                  onChange={(event) =>
                    setFormState((prev) => ({
                      ...prev,
                      customerLocation: event.target.value,
                    }))
                  }
                />
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1 text-sm">
                Delivery location
                <Input
                  value={formState.deliveryLocation}
                  onChange={(event) =>
                    setFormState((prev) => ({
                      ...prev,
                      deliveryLocation: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="grid gap-1 text-sm">
                Date of delivery
                <Input
                  type="date"
                  value={formState.deliveryDate}
                  onChange={(event) =>
                    setFormState((prev) => ({
                      ...prev,
                      deliveryDate: event.target.value,
                    }))
                  }
                />
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1 text-sm">
                Delivered by
                <Input
                  value={formState.deliveredByName}
                  onChange={(event) =>
                    setFormState((prev) => ({
                      ...prev,
                      deliveredByName: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="grid gap-1 text-sm">
                Tel
                <Input
                  value={formState.deliveredByPhone}
                  onChange={(event) =>
                    setFormState((prev) => ({
                      ...prev,
                      deliveredByPhone: event.target.value,
                    }))
                  }
                />
              </label>
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitForm} disabled={submitting}>
              {submitting
                ? "Saving..."
                : activeNoteId
                  ? "Save changes"
                  : "Create delivery note"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(detailNote)}
        onOpenChange={(open) => !open && setDetailNote(null)}
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
              <DialogTitle>{detailNote?.deliveryNoteNumber}</DialogTitle>
            </div>
          </DialogHeader>
          {detailNote ? (
            <div className="space-y-3 text-sm">
              <p>Customer: {detailNote.customerName}</p>
              <p>Location: {detailNote.customerLocation}</p>
              <p>Delivery location: {detailNote.deliveryLocation}</p>
              <p>Date of delivery: {formatDate(detailNote.deliveryDate)}</p>
              <p>Delivered by: {detailNote.deliveredByName}</p>
              <div className="max-h-48 overflow-y-auto rounded-lg border border-border p-3">
                {detailNote.items.length === 0 ? (
                  <p className="text-muted-foreground">No items found.</p>
                ) : (
                  detailNote.items.map((item, index) => (
                    <p key={`${item.description}-${index}`}>
                      {index + 1}. {item.description} - {item.quantity}{" "}
                      {item.unit ?? "pcs"}
                    </p>
                  ))
                )}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
