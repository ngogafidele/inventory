"use client"

// Manages return transactions and the associated stock-restoration UI.
import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Pencil, Plus, Trash2 } from "lucide-react"
import { formatCurrency } from "@/lib/utils/format"
import { formatInKigali } from "@/lib/utils/time"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const RETURNS_PER_PAGE = 20

type SaleOptionItem = {
  productId: string
  name: string
  sku: string
  unit: string
  sellingPrice: number
  returnableQuantity: number
}

type SaleOption = {
  _id: string
  dateLabel: string
  customerName: string
  totalAmount: number
  items: SaleOptionItem[]
}

type ReturnItemClient = {
  productId: string
  name?: string
  sku?: string
  unit?: string
  quantity: number
  basePrice?: number
  unitPrice: number
  lineTotal: number
}

type ReturnClient = {
  _id: string
  saleId?: string
  returnItems: ReturnItemClient[]
  totalReturnAmount: number
  notes?: string
  createdByName?: string
  createdAtLabel?: string
  createdAt?: string
}

type ReturnLine = {
  productId: string
  name: string
  sku: string
  unit: string
  maxQuantity: number
  quantity: string
  unitPrice: string
}

export function ReturnsManager({
  initialReturns,
  sales,
  currentUserLabel,
}: {
  initialReturns: ReturnClient[]
  sales: SaleOption[]
  currentUserLabel: string
}) {
  const router = useRouter()
  const [returns, setReturns] = useState(initialReturns)
  const [notes, setNotes] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [formOpen, setFormOpen] = useState(false)
  const [activeReturnId, setActiveReturnId] = useState<string | null>(null)
  const [selectedSaleId, setSelectedSaleId] = useState("")
  const [returnLines, setReturnLines] = useState<ReturnLine[]>([])

  const saleMap = useMemo(
    () => new Map(sales.map((sale) => [sale._id, sale])),
    [sales]
  )

  const pageCount = Math.max(1, Math.ceil(returns.length / RETURNS_PER_PAGE))
  const safeCurrentPage = Math.min(currentPage, pageCount)
  const pageStart = (safeCurrentPage - 1) * RETURNS_PER_PAGE
  const paginatedReturns = returns.slice(pageStart, pageStart + RETURNS_PER_PAGE)
  const visibleStart = returns.length === 0 ? 0 : pageStart + 1
  const visibleEnd = Math.min(pageStart + RETURNS_PER_PAGE, returns.length)

  useEffect(() => {
    if (currentPage > pageCount) {
      setCurrentPage(pageCount)
    }
  }, [currentPage, pageCount])

  const resetForm = () => {
    setSelectedSaleId("")
    setReturnLines([])
    setNotes("")
    setError(null)
    setActiveReturnId(null)
  }

  const openCreate = () => {
    resetForm()
    setFormOpen(true)
  }

  const selectSale = (saleId: string) => {
    setSelectedSaleId(saleId)
    setError(null)
    const sale = saleMap.get(saleId)
    if (!sale) {
      setReturnLines([])
      return
    }
    setReturnLines(
      sale.items.map((item) => ({
        productId: item.productId,
        name: item.name,
        sku: item.sku,
        unit: item.unit,
        maxQuantity: item.returnableQuantity,
        quantity: "",
        unitPrice: String(item.sellingPrice),
      }))
    )
  }

  const openEdit = (entry: ReturnClient) => {
    const sale = entry.saleId ? saleMap.get(entry.saleId) : undefined
    setActiveReturnId(entry._id)
    setSelectedSaleId(entry.saleId ?? "")
    setNotes(entry.notes ?? "")
    setError(null)
    setReturnLines(
      entry.returnItems.map((item) => {
        const saleItem = sale?.items.find(
          (candidate) => candidate.productId === item.productId
        )
        // The sale's returnableQuantity already excludes this return, so the
        // editable cap is that remainder plus what this return currently holds.
        const cap = (saleItem?.returnableQuantity ?? 0) + item.quantity
        return {
          productId: item.productId,
          name: item.name ?? saleItem?.name ?? "Item",
          sku: item.sku ?? saleItem?.sku ?? "",
          unit: item.unit ?? saleItem?.unit ?? "pcs",
          maxQuantity: cap,
          quantity: String(item.quantity),
          unitPrice: String(item.unitPrice),
        }
      })
    )
    setFormOpen(true)
  }

  const setLine = (
    index: number,
    key: "quantity" | "unitPrice",
    value: string
  ) => {
    setReturnLines((current) =>
      current.map((line, lineIndex) =>
        lineIndex === index ? { ...line, [key]: value } : line
      )
    )
  }

  const returnTotal = returnLines.reduce((sum, line) => {
    const quantity = Number(line.quantity)
    const unitPrice = Number(line.unitPrice)
    if (!Number.isFinite(quantity) || !Number.isFinite(unitPrice)) return sum
    return sum + Math.max(0, quantity) * Math.max(0, unitPrice)
  }, 0)

  const getItemLabel = (item: ReturnItemClient) =>
    item.name?.trim() || item.sku?.trim() || "Unnamed item"

  const selectedSale = selectedSaleId ? saleMap.get(selectedSaleId) : undefined

  const submitReturn = async () => {
    setError(null)

    if (!activeReturnId && !selectedSaleId) {
      setError("Select the sale being returned.")
      return
    }

    const parsedLines = returnLines.map((line) => ({
      productId: line.productId,
      name: line.name,
      maxQuantity: line.maxQuantity,
      quantity: line.quantity.trim() === "" ? 0 : Number(line.quantity),
      unitPrice: Number(line.unitPrice),
    }))

    const activeLines = parsedLines.filter((line) => line.quantity > 0)
    if (activeLines.length === 0) {
      setError("Enter a quantity for at least one item.")
      return
    }

    for (const line of activeLines) {
      if (!Number.isInteger(line.quantity) || line.quantity < 1) {
        setError("Quantities must be whole numbers of at least 1.")
        return
      }
      if (Number.isNaN(line.unitPrice) || line.unitPrice < 0) {
        setError("Unit price must be 0 or more.")
        return
      }
      if (line.quantity > line.maxQuantity) {
        setError(
          `Cannot return more than ${line.maxQuantity} of ${line.name}.`
        )
        return
      }
    }

    const returnItems = activeLines.map((line) => ({
      productId: line.productId,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
    }))

    setSubmitting(true)
    try {
      const response = await fetch(
        activeReturnId ? `/api/returns/${activeReturnId}` : "/api/returns",
        {
          method: activeReturnId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            activeReturnId
              ? { returnItems, notes: notes.trim() }
              : { saleId: selectedSaleId, returnItems, notes: notes.trim() }
          ),
        }
      )

      const body = await response.json()
      if (!response.ok || !body?.success) {
        setError(body?.error ?? "Failed to record return.")
        return
      }

      const saved = body.data as ReturnClient
      const createdAt = saved.createdAt ? new Date(saved.createdAt) : new Date()
      const normalized = {
        ...saved,
        createdAtLabel: formatInKigali(createdAt, {
          year: "numeric",
          month: "short",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
        }),
        createdByName: saved.createdByName ?? currentUserLabel,
      }

      setReturns((current) =>
        activeReturnId
          ? current.map((entry) =>
              entry._id === activeReturnId ? normalized : entry
            )
          : [normalized, ...current]
      )

      setFormOpen(false)
      resetForm()
      setCurrentPage(1)
      // Refresh so remaining returnable quantities reflect this return.
      router.refresh()
    } catch {
      setError("Failed to record return.")
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
      router.refresh()
    } catch {
      setError("Failed to delete return.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Customer Service
          </p>
          <h2 className="text-2xl font-semibold">Returns</h2>
          <p className="text-sm text-muted-foreground">
            Logged in as: {currentUserLabel}
          </p>
        </div>
        <Button onClick={openCreate} disabled={sales.length === 0}>
          <Plus className="size-4" />
          Add Return
        </Button>
      </div>

      {sales.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          There are no sales with items available to return.
        </p>
      ) : null}

      {formOpen ? (
        <section className="space-y-5 rounded-2xl border border-border bg-card p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                {activeReturnId ? "Editing" : "New"} return
              </p>
              <h3 className="text-lg font-semibold">
                {activeReturnId ? "Edit return" : "Add return"}
              </h3>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setFormOpen(false)
                resetForm()
              }}
              disabled={submitting}
            >
              Close
            </Button>
          </div>

          <div className="space-y-5">
            {activeReturnId ? (
              selectedSale ? (
                <p className="text-sm text-muted-foreground">
                  Return from sale: {selectedSale.dateLabel}
                  {selectedSale.customerName
                    ? ` · ${selectedSale.customerName}`
                    : ""}
                </p>
              ) : null
            ) : (
              <label className="grid gap-1 text-sm">
                Sale being returned
                <select
                  value={selectedSaleId}
                  onChange={(event) => selectSale(event.target.value)}
                  className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                >
                  <option value="">Select a sale…</option>
                  {sales.map((sale) => (
                    <option key={sale._id} value={sale._id}>
                      {sale.dateLabel} · {sale.customerName || "Walk-in"} ·{" "}
                      {formatCurrency(sale.totalAmount)}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {returnLines.length > 0 ? (
              <div className="space-y-3">
                <h4 className="text-lg font-semibold">Items to return</h4>
                {returnLines.map((line, index) => (
                  <div
                    key={line.productId}
                    className="grid gap-3 rounded-lg border border-border/80 p-3 md:grid-cols-[1.6fr_0.8fr_1fr]"
                  >
                    <div className="grid gap-1 text-sm">
                      <span className="font-medium">{line.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {line.sku ? `${line.sku} · ` : ""}Returnable:{" "}
                        {line.maxQuantity} {line.unit}
                      </span>
                    </div>

                    <label className="grid gap-1 text-sm">
                      Quantity
                      <Input
                        type="number"
                        min={0}
                        max={line.maxQuantity}
                        placeholder="0"
                        value={line.quantity}
                        onChange={(event) =>
                          setLine(index, "quantity", event.target.value)
                        }
                      />
                    </label>

                    <label className="grid gap-1 text-sm">
                      Unit Price
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={line.unitPrice}
                        onChange={(event) =>
                          setLine(index, "unitPrice", event.target.value)
                        }
                      />
                    </label>
                  </div>
                ))}
              </div>
            ) : !activeReturnId ? (
              <p className="text-sm text-muted-foreground">
                {selectedSaleId
                  ? "This sale has no items left to return."
                  : "Select a sale to choose items to return."}
              </p>
            ) : null}

            <div className="grid gap-3 rounded-lg border border-border/80 p-3 text-sm md:grid-cols-2">
              <div>
                <p className="text-xs text-muted-foreground">Return Total</p>
                <p className="text-base font-semibold">
                  {formatCurrency(returnTotal)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Stock Impact</p>
                <p className="text-base font-semibold text-success">
                  Returned items added back to stock
                </p>
              </div>
            </div>

            <label className="grid gap-1 text-sm">
              Notes (optional)
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                className="min-h-20 rounded-md border border-border px-3 py-2"
                placeholder="Reason for return, customer details, etc."
              />
            </label>

            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setFormOpen(false)
                resetForm()
              }}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="button" onClick={submitReturn} disabled={submitting}>
              {submitting
                ? "Saving..."
                : activeReturnId
                  ? "Save Changes"
                  : "Record Return"}
            </Button>
          </div>
        </section>
      ) : null}

      {!formOpen && error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : null}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Time</TableHead>
            <TableHead>Returned Items</TableHead>
            <TableHead>Total</TableHead>
            <TableHead>Logged By</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {paginatedReturns.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-muted-foreground">
                No returns recorded yet.
              </TableCell>
            </TableRow>
          ) : (
            paginatedReturns.map((entry, returnIndex) => (
              <TableRow
                key={entry._id}
                className={
                  returnIndex % 2 === 1
                    ? "bg-muted/60 hover:bg-muted/70"
                    : undefined
                }
              >
                <TableCell>{entry.createdAtLabel ?? "-"}</TableCell>
                <TableCell>
                  <div className="space-y-1">
                    {entry.returnItems.map((item, index) => (
                      <p key={`${entry._id}-return-${item.productId}-${index}`}>
                        <span className="font-medium">{getItemLabel(item)}</span>
                        <span className="text-xs text-muted-foreground">
                          {" "}- {item.quantity} {item.unit ?? "pcs"}
                        </span>
                      </p>
                    ))}
                  </div>
                </TableCell>
                <TableCell>{formatCurrency(entry.totalReturnAmount)}</TableCell>
                <TableCell>{entry.createdByName ?? "Unknown User"}</TableCell>
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

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
        <span>
          Showing {visibleStart}-{visibleEnd} of {returns.length}
        </span>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
            disabled={safeCurrentPage <= 1}
          >
            Previous
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              setCurrentPage((page) => Math.min(pageCount, page + 1))
            }
            disabled={safeCurrentPage >= pageCount}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  )
}
