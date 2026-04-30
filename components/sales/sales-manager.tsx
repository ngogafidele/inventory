"use client"

import { Fragment, useEffect, useMemo, useState } from "react"
import { formatCurrency } from "@/lib/utils/format"
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

type ProductOption = {
  _id: string
  name: string
  sku: string
  unit: string
  price: number
  quantity: number
}

type SaleItemClient = {
  productId: string
  name?: string
  sku?: string
  unit?: string
  quantity: number
  basePrice?: number
  sellingPrice: number
  lineTotal: number
}

type SaleClient = {
  _id: string
  items: SaleItemClient[]
  totalAmount: number
  notes: string
  createdByName?: string
  createdAtLabel?: string
  createdAt?: string
}

type DraftItem = {
  productId: string
  quantity: string
  sellingPrice: string
}

const emptyDraft: DraftItem = {
  productId: "",
  quantity: "",
  sellingPrice: "",
}

const SALES_PER_PAGE = 20

export function SalesManager({
  initialSales,
  products,
  currentUserLabel,
}: {
  initialSales: SaleClient[]
  products: ProductOption[]
  currentUserLabel: string
}) {
  const [sales, setSales] = useState(initialSales)
  const [draftItems, setDraftItems] = useState<DraftItem[]>([emptyDraft])
  const [notes, setNotes] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)

  const productMap = useMemo(
    () => new Map(products.map((product) => [product._id, product])),
    [products]
  )

  const pageCount = Math.max(1, Math.ceil(sales.length / SALES_PER_PAGE))
  const safeCurrentPage = Math.min(currentPage, pageCount)
  const pageStart = (safeCurrentPage - 1) * SALES_PER_PAGE
  const paginatedSales = sales.slice(pageStart, pageStart + SALES_PER_PAGE)
  const visibleStart = sales.length === 0 ? 0 : pageStart + 1
  const visibleEnd = Math.min(pageStart + SALES_PER_PAGE, sales.length)

  useEffect(() => {
    if (currentPage > pageCount) {
      setCurrentPage(pageCount)
    }
  }, [currentPage, pageCount])

  const setDraftItem = (
    index: number,
    key: keyof DraftItem,
    value: string
  ) => {
    setDraftItems((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [key]: value } : item
      )
    )
  }

  const addDraftItem = () => {
    setDraftItems((current) => [...current, emptyDraft])
  }

  const removeDraftItem = (index: number) => {
    setDraftItems((current) =>
      current.length === 1
        ? current
        : current.filter((_, itemIndex) => itemIndex !== index)
    )
  }

  const resetForm = () => {
    setDraftItems([emptyDraft])
    setNotes("")
    setError(null)
  }

  const getItemLabel = (item: SaleItemClient) => {
    return item.name?.trim() || item.sku?.trim() || "Unnamed item"
  }

  const submitSale = async () => {
    setError(null)

    const payloadItems = draftItems.map((item) => ({
      productId: item.productId,
      quantity: Number(item.quantity),
      sellingPrice: Number(item.sellingPrice),
    }))

    if (payloadItems.some((item) => !item.productId)) {
      setError("Select a product for each line.")
      return
    }

    if (
      payloadItems.some(
        (item) =>
          Number.isNaN(item.quantity) ||
          item.quantity < 1 ||
          Number.isNaN(item.sellingPrice) ||
          item.sellingPrice < 0
      )
    ) {
      setError("Quantity must be at least 1 and price must be 0 or more.")
      return
    }

    const requestedByProduct = new Map<string, number>()
    for (const item of payloadItems) {
      const current = requestedByProduct.get(item.productId) ?? 0
      requestedByProduct.set(item.productId, current + item.quantity)
    }

    for (const [productId, totalRequested] of requestedByProduct.entries()) {
      const product = productMap.get(productId)
      if (!product) {
        setError("One selected product is no longer available.")
        return
      }
      if (totalRequested > product.quantity) {
        setError(`Insufficient stock for ${product.name}.`)
        return
      }
    }

    setSubmitting(true)

    try {
      const response = await fetch("/api/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: payloadItems,
          notes: notes.trim(),
        }),
      })

      const body = await response.json()
      if (!response.ok || !body?.success) {
        setError(body?.error ?? "Failed to record sale.")
        return
      }

      const createdSale = body.data as SaleClient
      setSales((current) => [createdSale, ...current])
      setCurrentPage(1)
      resetForm()
    } catch {
      setError("Failed to record sale.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Transactions
        </p>
        <h2 className="text-2xl font-semibold">Sales</h2>
        <p className="text-sm text-muted-foreground">
          Logged in as: {currentUserLabel}
        </p>
      </div>

      <section className="space-y-4 rounded-2xl border border-border bg-card p-4 sm:p-5">
        <h3 className="text-lg font-semibold">Record Sale</h3>
        <div className="space-y-3">
          {draftItems.map((item, index) => {
            const selectedProduct = item.productId
              ? productMap.get(item.productId)
              : null
            return (
              <div
                key={`${index}-${item.productId}`}
                className="grid gap-3 rounded-lg border border-border/80 p-3 md:grid-cols-[1.6fr_0.8fr_1fr_auto]"
              >
                <label className="grid gap-1 text-sm">
                  Product
                  <ProductSearchSelect
                    products={products}
                    value={item.productId}
                    onValueChange={(value) => {
                      const product = productMap.get(value)
                      setDraftItem(index, "productId", value)
                      if (product) {
                        setDraftItem(index, "sellingPrice", String(product.price))
                      }
                    }}
                  />
                </label>

                <label className="grid gap-1 text-sm">
                  Quantity
                  <Input
                    type="number"
                    min={1}
                    placeholder="e.g. 3"
                    value={item.quantity}
                    onChange={(event) =>
                      setDraftItem(index, "quantity", event.target.value)
                    }
                  />
                </label>

                <label className="grid gap-1 text-sm">
                  Selling Price
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="e.g. 1200"
                    value={item.sellingPrice}
                    onChange={(event) =>
                      setDraftItem(index, "sellingPrice", event.target.value)
                    }
                  />
                </label>

                <div className="flex items-end">
                  <Button
                    variant="outline"
                    onClick={() => removeDraftItem(index)}
                    disabled={draftItems.length === 1}
                  >
                    Remove
                  </Button>
                </div>

                {selectedProduct ? (
                  <p className="md:col-span-4 text-xs text-muted-foreground">
                    Base price: {formatCurrency(selectedProduct.price)} | Available: {selectedProduct.quantity} {selectedProduct.unit}
                  </p>
                ) : null}
              </div>
            )
          })}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={addDraftItem}>
            Add Item
          </Button>
        </div>

        <label className="grid gap-1 text-sm">
          Notes (optional)
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            className="min-h-[80px] rounded-md border border-border px-3 py-2"
            placeholder="Any note for this sale"
          />
        </label>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <Button onClick={submitSale} disabled={submitting || products.length === 0}>
          {submitting ? "Recording..." : "Record Sale"}
        </Button>
      </section>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Time</TableHead>
            <TableHead>Items Sold</TableHead>
            <TableHead>Quantity Sold</TableHead>
            <TableHead>Cost Price</TableHead>
            <TableHead>Sold Price</TableHead>
            <TableHead>Total</TableHead>
            <TableHead>Logged By</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {paginatedSales.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-muted-foreground">
                No sales recorded yet.
              </TableCell>
            </TableRow>
          ) : (
            paginatedSales.map((sale) => {
              const items = sale.items.length
                ? sale.items
                : [
                    {
                      productId: `${sale._id}-empty`,
                      quantity: 0,
                      sellingPrice: 0,
                      lineTotal: 0,
                    },
                  ]
              const rowSpan = items.length

              return (
                <Fragment key={sale._id}>
                  {items.map((item, itemIndex) => (
                    <TableRow key={`${sale._id}-${item.productId}-${itemIndex}`}>
                      {itemIndex === 0 ? (
                        <TableCell rowSpan={rowSpan}>
                          {sale.createdAtLabel ?? "-"}
                        </TableCell>
                      ) : null}
                      <TableCell>
                        <div className="whitespace-normal break-words">
                          <p className="font-medium">{getItemLabel(item)}</p>
                          {item.sku ? (
                            <p className="text-xs text-muted-foreground">
                              {item.sku}
                            </p>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell>
                        {item.quantity} {item.unit ?? "pcs"}
                      </TableCell>
                      <TableCell>{formatCurrency(item.basePrice ?? 0)}</TableCell>
                      <TableCell>{formatCurrency(item.sellingPrice)}</TableCell>
                      {itemIndex === 0 ? (
                        <>
                          <TableCell rowSpan={rowSpan}>
                            {formatCurrency(sale.totalAmount)}
                          </TableCell>
                          <TableCell rowSpan={rowSpan}>
                            {sale.createdByName ?? "Unknown User"}
                          </TableCell>
                        </>
                      ) : null}
                    </TableRow>
                  ))}
                </Fragment>
              )
            })
          )}
        </TableBody>
      </Table>
      <div className="flex flex-col gap-3 border-t border-border/80 pt-4 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p>
          Showing {visibleStart}-{visibleEnd} of {sales.length} sales
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
            disabled={safeCurrentPage === 1}
          >
            Previous
          </Button>
          <span className="min-w-20 text-center">
            Page {safeCurrentPage} of {pageCount}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setCurrentPage((page) => Math.min(pageCount, page + 1))
            }
            disabled={safeCurrentPage === pageCount}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  )
}
