"use client"

import { useMemo, useState } from "react"
import { Pencil, Plus, Search, Trash2 } from "lucide-react"
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
import { StatsCard } from "@/components/dashboard/stats-card"
import { formatCurrency } from "@/lib/utils/format"
import { formatInKigali } from "@/lib/utils/time"

const PAYMENT_METHODS: Array<{ value: "cash" | "mobile-money" | "bank"; label: string }> = [
  { value: "cash", label: "Cash" },
  { value: "bank", label: "Bank" },
  { value: "mobile-money", label: "Mobile Money" },
]

type SaleItemOption = {
  productId: string
  name: string
  sku: string
  unit: string
  quantity: number
  sellingPrice: number
}

type SaleOption = {
  _id: string
  label: string
  totalAmount: number
  items: SaleItemOption[]
}

type ReturnItemClient = {
  productId: string
  name: string
  sku: string
  unit?: string
  quantity: number
  unitPrice: number
  lineTotal: number
}

type ReturnClient = {
  _id: string
  saleId: string
  items: ReturnItemClient[]
  refundAmount: number
  refundMethod: "cash" | "mobile-money" | "bank"
  reason: string
  returnDate?: string
  returnDateLabel?: string
  customerName: string
  customerPhone: string
  notes?: string
  createdByName?: string
}

type ReturnItemDraft = {
  productId: string
  quantity: string
}

type FormState = {
  saleId: string
  reason: string
  returnDate: string
  refundAmount: string
  refundMethod: "cash" | "mobile-money" | "bank"
  customerName: string
  customerPhone: string
  notes: string
  items: ReturnItemDraft[]
}

const emptyItem: ReturnItemDraft = {
  productId: "",
  quantity: "",
}

const emptyForm: FormState = {
  saleId: "",
  reason: "",
  returnDate: "",
  refundAmount: "",
  refundMethod: "cash",
  customerName: "",
  customerPhone: "",
  notes: "",
  items: [emptyItem],
}

function summarizeItems(items: ReturnItemClient[]) {
  if (!items.length) return "-"
  return items
    .map((item) => `${item.name} (${item.quantity} ${item.unit ?? "pcs"})`)
    .join(", ")
}

export function ReturnsManager({
  initialReturns,
  sales,
}: {
  initialReturns: ReturnClient[]
  sales: SaleOption[]
}) {
  const [returns, setReturns] = useState(initialReturns)
  const [search, setSearch] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [activeReturnId, setActiveReturnId] = useState<string | null>(null)
  const [formState, setFormState] = useState<FormState>(emptyForm)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const salesMap = useMemo(
    () => new Map(sales.map((sale) => [sale._id, sale])),
    [sales]
  )

  const filteredReturns = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return returns

    return returns.filter((entry) =>
      [entry.customerName, entry.customerPhone, entry.reason]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(query))
    )
  }, [returns, search])

  const totalRefunds = useMemo(() => {
    return filteredReturns.reduce((sum, entry) => sum + entry.refundAmount, 0)
  }, [filteredReturns])

  const resetForm = () => {
    setFormState(emptyForm)
    setActiveReturnId(null)
    setError(null)
  }

  const openCreate = () => {
    resetForm()
    setDialogOpen(true)
  }

  const openEdit = (entry: ReturnClient) => {
    setFormState({
      saleId: entry.saleId,
      reason: entry.reason,
      returnDate: entry.returnDate ? entry.returnDate.slice(0, 10) : "",
      refundAmount: String(entry.refundAmount),
      refundMethod: entry.refundMethod,
      customerName: entry.customerName,
      customerPhone: entry.customerPhone,
      notes: entry.notes ?? "",
      items: entry.items.map((item) => ({
        productId: item.productId,
        quantity: String(item.quantity),
      })),
    })
    setActiveReturnId(entry._id)
    setError(null)
    setDialogOpen(true)
  }

  const updateItem = (index: number, field: keyof ReturnItemDraft, value: string) => {
    setFormState((prev) => ({
      ...prev,
      items: prev.items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item
      ),
    }))
  }

  const addItem = () => {
    setFormState((prev) => ({
      ...prev,
      items: [...prev.items, emptyItem],
    }))
  }

  const removeItem = (index: number) => {
    setFormState((prev) =>
      prev.items.length === 1
        ? prev
        : { ...prev, items: prev.items.filter((_, i) => i !== index) }
    )
  }

  const submitForm = async () => {
    const sale = salesMap.get(formState.saleId)
    if (!sale) {
      setError("Select a sale for this return.")
      return
    }

    if (!formState.reason.trim()) {
      setError("Reason is required.")
      return
    }

    if (!formState.customerName.trim() || !formState.customerPhone.trim()) {
      setError("Customer name and phone are required.")
      return
    }

    if (!formState.returnDate) {
      setError("Select a return date.")
      return
    }

    const refundAmount = Number(formState.refundAmount)
    if (!Number.isFinite(refundAmount) || refundAmount < 0) {
      setError("Refund amount must be 0 or more.")
      return
    }

    const payloadItems = formState.items.map((item) => ({
      productId: item.productId,
      quantity: Number(item.quantity),
    }))

    if (payloadItems.some((item) => !item.productId)) {
      setError("Select an item for each return line.")
      return
    }

    if (payloadItems.some((item) => !Number.isInteger(item.quantity) || item.quantity < 1)) {
      setError("Return quantity must be at least 1.")
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const response = await fetch(
        activeReturnId ? `/api/returns/${activeReturnId}` : "/api/returns",
        {
          method: activeReturnId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            saleId: formState.saleId,
            items: payloadItems,
            refundAmount,
            refundMethod: formState.refundMethod,
            reason: formState.reason.trim(),
            returnDate: formState.returnDate,
            customerName: formState.customerName.trim(),
            customerPhone: formState.customerPhone.trim(),
            notes: formState.notes.trim(),
          }),
        }
      )

      const body = await response.json()
      if (!response.ok || !body?.success) {
        setError(body?.error ?? "Failed to save return.")
        return
      }

      const saved = body.data as ReturnClient
      const dateLabel = saved.returnDate
        ? formatInKigali(saved.returnDate, {
            year: "numeric",
            month: "short",
            day: "2-digit",
          })
        : "-"

      const normalized = {
        ...saved,
        _id: saved._id.toString(),
        saleId: saved.saleId.toString(),
        returnDateLabel: dateLabel,
      }

      setReturns((current) =>
        activeReturnId
          ? current.map((entry) => (entry._id === activeReturnId ? normalized : entry))
          : [normalized, ...current]
      )

      setDialogOpen(false)
      resetForm()
    } catch {
      setError("Failed to save return.")
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (returnId: string) => {
    if (!confirm("Delete this return?")) {
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const response = await fetch(`/api/returns/${returnId}`, {
        method: "DELETE",
      })
      const body = await response.json().catch(() => null)

      if (!response.ok || !body?.success) {
        setError(body?.error ?? "Failed to delete return.")
        return
      }

      setReturns((current) => current.filter((entry) => entry._id !== returnId))
    } catch {
      setError("Failed to delete return.")
    } finally {
      setSubmitting(false)
    }
  }

  const saleOptions = sales.map((sale) => ({
    value: sale._id,
    label: `${sale.label} · ${formatCurrency(sale.totalAmount)}`,
  }))

  const selectedSale = salesMap.get(formState.saleId)
  const saleItems = selectedSale?.items ?? []

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            After Sales
          </p>
          <h2 className="text-2xl font-semibold">Returns</h2>
          <p className="text-sm text-muted-foreground">
            Record returned items, refunds, and restocks.
          </p>
        </div>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          <div className="relative w-full sm:w-56">
            <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search returns"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreate}>
                <Plus className="size-4" />
                Add Return
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {activeReturnId ? "Edit return" : "Add return"}
                </DialogTitle>
              </DialogHeader>
              <div className="grid gap-3">
                <label className="grid gap-1 text-sm">
                  Sale
                  <Select
                    value={formState.saleId}
                    onValueChange={(value) =>
                      setFormState((prev) => ({
                        ...prev,
                        saleId: value,
                        items: [emptyItem],
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select sale" />
                    </SelectTrigger>
                    <SelectContent>
                      {saleOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>

                <label className="grid gap-1 text-sm">
                  Reason
                  <Input
                    value={formState.reason}
                    onChange={(event) =>
                      setFormState((prev) => ({
                        ...prev,
                        reason: event.target.value,
                      }))
                    }
                  />
                </label>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-1 text-sm">
                    Return date
                    <Input
                      type="date"
                      value={formState.returnDate}
                      onChange={(event) =>
                        setFormState((prev) => ({
                          ...prev,
                          returnDate: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className="grid gap-1 text-sm">
                    Refund amount
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={formState.refundAmount}
                      onChange={(event) =>
                        setFormState((prev) => ({
                          ...prev,
                          refundAmount: event.target.value,
                        }))
                      }
                    />
                  </label>
                </div>

                <label className="grid gap-1 text-sm">
                  Refund method
                  <Select
                    value={formState.refundMethod}
                    onValueChange={(value) =>
                      setFormState((prev) => ({
                        ...prev,
                        refundMethod: value as FormState["refundMethod"],
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select method" />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_METHODS.map((method) => (
                        <SelectItem key={method.value} value={method.value}>
                          {method.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>

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
                    Customer phone
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

                <label className="grid gap-1 text-sm">
                  Items
                  <div className="space-y-2">
                    {formState.items.map((item, index) => (
                      <div
                        key={`${index}-${item.productId}`}
                        className="grid gap-2 rounded-md border border-border/80 p-2 sm:grid-cols-[1.6fr_0.6fr_auto]"
                      >
                        <Select
                          value={item.productId}
                          onValueChange={(value) => updateItem(index, "productId", value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select item" />
                          </SelectTrigger>
                          <SelectContent>
                            {saleItems.map((saleItem) => (
                              <SelectItem key={saleItem.productId} value={saleItem.productId}>
                                {saleItem.name} ({saleItem.quantity} {saleItem.unit ?? "pcs"})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <Input
                          type="number"
                          min={1}
                          value={item.quantity}
                          onChange={(event) =>
                            updateItem(index, "quantity", event.target.value)
                          }
                          placeholder="Qty"
                        />

                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => removeItem(index)}
                          disabled={formState.items.length === 1}
                        >
                          Remove
                        </Button>
                      </div>
                    ))}
                  </div>
                </label>

                <Button type="button" variant="outline" onClick={addItem}>
                  Add Item
                </Button>

                <label className="grid gap-1 text-sm">
                  Notes (optional)
                  <textarea
                    value={formState.notes}
                    onChange={(event) =>
                      setFormState((prev) => ({
                        ...prev,
                        notes: event.target.value,
                      }))
                    }
                    className="min-h-20 rounded-md border border-border px-3 py-2"
                  />
                </label>

                {error ? <p className="text-sm text-destructive">{error}</p> : null}
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                  disabled={submitting}
                >
                  Cancel
                </Button>
                <Button type="button" onClick={submitForm} disabled={submitting}>
                  {submitting ? "Saving..." : "Save"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <StatsCard label="Returns" value={filteredReturns.length} />
        <StatsCard label="Total Refunds" value={formatCurrency(totalRefunds)} />
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>Reason</TableHead>
            <TableHead>Items</TableHead>
            <TableHead>Refund</TableHead>
            <TableHead>Method</TableHead>
            <TableHead>Recorded By</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredReturns.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="text-muted-foreground">
                No returns recorded yet.
              </TableCell>
            </TableRow>
          ) : (
            filteredReturns.map((entry) => (
              <TableRow key={entry._id}>
                <TableCell>
                  {entry.returnDateLabel ??
                    (entry.returnDate
                      ? formatInKigali(entry.returnDate, {
                          year: "numeric",
                          month: "short",
                          day: "2-digit",
                        })
                      : "-")}
                </TableCell>
                <TableCell className="whitespace-normal wrap-break-word">
                  {entry.customerName}
                  <p className="text-xs text-muted-foreground">
                    {entry.customerPhone}
                  </p>
                </TableCell>
                <TableCell className="whitespace-normal wrap-break-word">
                  {entry.reason}
                </TableCell>
                <TableCell className="whitespace-normal wrap-break-word">
                  {summarizeItems(entry.items)}
                </TableCell>
                <TableCell>{formatCurrency(entry.refundAmount)}</TableCell>
                <TableCell>
                  {PAYMENT_METHODS.find((method) => method.value === entry.refundMethod)?.label ??
                    entry.refundMethod}
                </TableCell>
                <TableCell>{entry.createdByName ?? "-"}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEdit(entry)}
                    >
                      <Pencil className="size-4" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(entry._id)}
                      disabled={submitting}
                    >
                      <Trash2 className="size-4" />
                      Delete
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
