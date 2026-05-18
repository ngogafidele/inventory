"use client"

import { useEffect, useMemo, useState } from "react"
import { Pencil, Plus, Trash2 } from "lucide-react"
import { formatCurrency } from "@/lib/utils/format"
import { formatInKigali } from "@/lib/utils/time"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ProductSearchSelect } from "@/components/products/product-search-select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const TOTAL_TOLERANCE = 0.01
const RETURNS_PER_PAGE = 20

type ProductOption = {
  _id: string
  name: string
  sku: string
  unit: string
  price: number
  quantity: number
}

type ReturnItemClient = {
  productId: string
  name?: string
  sku?: string
  unit?: string
  quantity: number
  unitPrice: number
  lineTotal: number
}

type ReturnClient = {
  _id: string
  returnItems: ReturnItemClient[]
  replacementItems: ReturnItemClient[]
  totalReturnAmount: number
  totalReplacementAmount: number
  notes?: string
  createdByName?: string
  createdAtLabel?: string
  createdAt?: string
}

type DraftItem = {
  productId: string
  quantity: string
  unitPrice: string
}

const emptyDraft: DraftItem = {
  productId: "",
  quantity: "",
  unitPrice: "",
}

function computeTotal(items: DraftItem[]) {
  return items.reduce((sum, item) => {
    const quantity = Number(item.quantity)
    const unitPrice = Number(item.unitPrice)
    if (Number.isNaN(quantity) || Number.isNaN(unitPrice)) {
      return sum
    }
    return sum + quantity * unitPrice
  }, 0)
}

function buildNetMap(returnItems: ReturnItemClient[], replacementItems: ReturnItemClient[]) {
  const netChanges = new Map<string, number>()
  returnItems.forEach((item) => {
    const current = netChanges.get(item.productId) ?? 0
    netChanges.set(item.productId, current + item.quantity)
  })
  replacementItems.forEach((item) => {
    const current = netChanges.get(item.productId) ?? 0
    netChanges.set(item.productId, current - item.quantity)
  })
  return netChanges
}

export function ReturnsManager({
  initialReturns,
  products,
  currentUserLabel,
}: {
  initialReturns: ReturnClient[]
  products: ProductOption[]
  currentUserLabel: string
}) {
  const [returns, setReturns] = useState(initialReturns)
  const [returnDraftItems, setReturnDraftItems] = useState<DraftItem[]>([emptyDraft])
  const [replacementDraftItems, setReplacementDraftItems] = useState<DraftItem[]>([
    emptyDraft,
  ])
  const [notes, setNotes] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [formOpen, setFormOpen] = useState(false)
  const [activeReturnId, setActiveReturnId] = useState<string | null>(null)

  const productMap = useMemo(
    () => new Map(products.map((product) => [product._id, product])),
    [products]
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

  const setDraftItem = (
    list: "return" | "replacement",
    index: number,
    key: keyof DraftItem,
    value: string
  ) => {
    const setter = list === "return" ? setReturnDraftItems : setReplacementDraftItems
    setter((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [key]: value } : item
      )
    )
  }

  const addDraftItem = (list: "return" | "replacement") => {
    const setter = list === "return" ? setReturnDraftItems : setReplacementDraftItems
    setter((current) => [...current, emptyDraft])
  }

  const removeDraftItem = (list: "return" | "replacement", index: number) => {
    const setter = list === "return" ? setReturnDraftItems : setReplacementDraftItems
    setter((current) =>
      current.length === 1 ? current : current.filter((_, itemIndex) => itemIndex !== index)
    )
  }

  const resetForm = () => {
    setReturnDraftItems([emptyDraft])
    setReplacementDraftItems([emptyDraft])
    setNotes("")
    setError(null)
    setActiveReturnId(null)
  }

  const openCreate = () => {
    resetForm()
    setFormOpen(true)
  }

  const openEdit = (entry: ReturnClient) => {
    setReturnDraftItems(
      entry.returnItems.map((item) => ({
        productId: item.productId,
        quantity: String(item.quantity),
        unitPrice: String(item.unitPrice),
      }))
    )
    setReplacementDraftItems(
      entry.replacementItems.map((item) => ({
        productId: item.productId,
        quantity: String(item.quantity),
        unitPrice: String(item.unitPrice),
      }))
    )
    setNotes(entry.notes ?? "")
    setError(null)
    setActiveReturnId(entry._id)
    setFormOpen(true)
  }

  const returnTotal = computeTotal(returnDraftItems)
  const replacementTotal = computeTotal(replacementDraftItems)
  const replacementWithinReturn = replacementTotal - returnTotal <= TOTAL_TOLERANCE

  const getItemLabel = (item: ReturnItemClient) => {
    return item.name?.trim() || item.sku?.trim() || "Unnamed item"
  }

  const validateItems = (items: DraftItem[]) => {
    return items.map((item) => ({
      productId: item.productId,
      quantity: Number(item.quantity),
      unitPrice: Number(item.unitPrice),
    }))
  }

  const submitReturn = async () => {
    setError(null)

    const returnItems = validateItems(returnDraftItems)
    const replacementItems = validateItems(replacementDraftItems)

    if (returnItems.some((item) => !item.productId)) {
      setError("Select a product for each return line.")
      return
    }

    if (replacementItems.some((item) => !item.productId)) {
      setError("Select a product for each replacement line.")
      return
    }

    const hasInvalidReturn = returnItems.some(
      (item) =>
        Number.isNaN(item.quantity) ||
        item.quantity < 1 ||
        Number.isNaN(item.unitPrice) ||
        item.unitPrice < 0
    )

    const hasInvalidReplacement = replacementItems.some(
      (item) =>
        Number.isNaN(item.quantity) ||
        item.quantity < 1 ||
        Number.isNaN(item.unitPrice) ||
        item.unitPrice < 0
    )

    if (hasInvalidReturn || hasInvalidReplacement) {
      setError("Quantity must be at least 1 and price must be 0 or more.")
      return
    }

    if (!replacementWithinReturn) {
      setError("Replacement total cannot exceed the return total.")
      return
    }

    const newReturnItems: ReturnItemClient[] = returnItems.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      lineTotal: item.unitPrice * item.quantity,
    }))
    const newReplacementItems: ReturnItemClient[] = replacementItems.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      lineTotal: item.unitPrice * item.quantity,
    }))

    const newNetMap = buildNetMap(newReturnItems, newReplacementItems)
    const existingEntry = activeReturnId
      ? returns.find((entry) => entry._id === activeReturnId)
      : null
    const oldNetMap = existingEntry
      ? buildNetMap(existingEntry.returnItems, existingEntry.replacementItems)
      : new Map<string, number>()

    const allProductIds = new Set([
      ...Array.from(newNetMap.keys()),
      ...Array.from(oldNetMap.keys()),
    ])

    for (const productId of allProductIds) {
      const product = productMap.get(productId)
      if (!product) {
        setError("One selected product is no longer available.")
        return
      }
      const oldNet = oldNetMap.get(productId) ?? 0
      const newNet = newNetMap.get(productId) ?? 0
      const delta = newNet - oldNet
      if (product.quantity + delta < 0) {
        setError(`Insufficient stock for ${product.name}.`)
        return
      }
    }

    setSubmitting(true)

    try {
      const response = await fetch(
        activeReturnId ? `/api/returns/${activeReturnId}` : "/api/returns",
        {
          method: activeReturnId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            returnItems,
            replacementItems,
            notes: notes.trim(),
          }),
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
          ? current.map((entry) => (entry._id === activeReturnId ? normalized : entry))
          : [normalized, ...current]
      )

      setFormOpen(false)
      resetForm()
      setCurrentPage(1)
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
    } catch {
      setError("Failed to delete return.")
    } finally {
      setSubmitting(false)
    }
  }

  const renderItemRows = (items: DraftItem[], list: "return" | "replacement") => {
    return items.map((item, index) => {
      const selectedProduct = item.productId ? productMap.get(item.productId) : null
      return (
        <div
          key={`${list}-${index}-${item.productId}`}
          className="grid gap-3 rounded-lg border border-border/80 p-3 md:grid-cols-[1.6fr_0.8fr_1fr_auto]"
        >
          <label className="grid gap-1 text-sm">
            Product
            <ProductSearchSelect
              products={products}
              value={item.productId}
              onValueChange={(value) => {
                const product = productMap.get(value)
                setDraftItem(list, index, "productId", value)
                if (product) {
                  setDraftItem(list, index, "unitPrice", String(product.price))
                }
              }}
            />
          </label>

          <label className="grid gap-1 text-sm">
            Quantity
            <Input
              type="number"
              min={1}
              placeholder="e.g. 2"
              value={item.quantity}
              onChange={(event) =>
                setDraftItem(list, index, "quantity", event.target.value)
              }
            />
          </label>

          <label className="grid gap-1 text-sm">
            Unit Price
            <Input
              type="number"
              min={0}
              step="0.01"
              placeholder="e.g. 1200"
              value={item.unitPrice}
              onChange={(event) =>
                setDraftItem(list, index, "unitPrice", event.target.value)
              }
            />
          </label>

          <div className="flex items-end">
            <Button
              variant="outline"
              onClick={() => removeDraftItem(list, index)}
              disabled={items.length === 1}
            >
              Remove
            </Button>
          </div>

          {selectedProduct ? (
            <p className="md:col-span-4 text-xs text-muted-foreground">
              Current stock: {selectedProduct.quantity} {selectedProduct.unit}
            </p>
          ) : null}
        </div>
      )
    })
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Customer Service
          </p>
          <h2 className="text-2xl font-semibold">Returns & Exchanges</h2>
          <p className="text-sm text-muted-foreground">
            Logged in as: {currentUserLabel}
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="size-4" />
          Add Return
        </Button>
      </div>

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
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h4 className="text-lg font-semibold">Returned Items</h4>
                <Button variant="outline" onClick={() => addDraftItem("return")}
                  >
                  Add Item
                </Button>
              </div>
              {renderItemRows(returnDraftItems, "return")}
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h4 className="text-lg font-semibold">Replacement Items</h4>
                <Button
                  variant="outline"
                  onClick={() => addDraftItem("replacement")}
                >
                  Add Item
                </Button>
              </div>
              {renderItemRows(replacementDraftItems, "replacement")}
            </div>

            <div className="grid gap-3 rounded-lg border border-border/80 p-3 text-sm md:grid-cols-3">
              <div>
                <p className="text-xs text-muted-foreground">Return Total</p>
                <p className="text-base font-semibold">
                  {formatCurrency(returnTotal)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Replacement Total</p>
                <p className="text-base font-semibold">
                  {formatCurrency(replacementTotal)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Status</p>
                <p
                  className={
                    replacementWithinReturn
                      ? "text-base font-semibold text-emerald-600"
                      : "text-base font-semibold text-destructive"
                  }
                >
                  {replacementWithinReturn
                    ? "Replacement within return"
                    : "Replacement exceeds return"}
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
              {submitting ? "Saving..." : "Save"}
            </Button>
          </div>
        </section>
      ) : null}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Time</TableHead>
            <TableHead>Returned Items</TableHead>
            <TableHead>Replacement Items</TableHead>
            <TableHead>Total</TableHead>
            <TableHead>Logged By</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {paginatedReturns.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-muted-foreground">
                No returns recorded yet.
              </TableCell>
            </TableRow>
          ) : (
            paginatedReturns.map((entry) => (
              <TableRow key={entry._id}>
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
                <TableCell>
                  <div className="space-y-1">
                    {entry.replacementItems.map((item, index) => (
                      <p
                        key={`${entry._id}-replacement-${item.productId}-${index}`}
                      >
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
