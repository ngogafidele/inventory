"use client"

import { Fragment, useEffect, useMemo, useState } from "react"
import { formatCurrency } from "@/lib/utils/format"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { ProductSearchSelect } from "@/components/products/product-search-select"
import { AlertTriangle, Pencil } from "lucide-react"
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

type ProductOption = {
  _id: string
  name: string
  sku: string
  unit: string
  price: number
  costPrice?: number
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
  paymentStatus?: "paid" | "unpaid"
  paymentMethod?: "cash" | "bank" | "mobile"
  outstanding?: {
    customerName?: string
    customerPhone?: string
    paymentDate?: string
  }
  createdByName?: string
  createdAtLabel?: string
  createdAt?: string
}

type DraftItem = {
  productId: string
  quantity: string
  sellingPrice: string
  costPrice?: string
}

type OutstandingDraft = {
  customerName: string
  customerPhone: string
  paymentDate: string
}

const emptyDraft: DraftItem = {
  productId: "",
  quantity: "",
  sellingPrice: "",
  costPrice: "",
}

const SALES_PER_PAGE = 20

function normalizeSearchText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "")
}

function getStatusLabel(status?: SaleClient["paymentStatus"]) {
  return status === "unpaid" ? "Unpaid" : "Paid"
}

export function SalesManager({
  initialSales,
  products,
  currentUserLabel,
  isAdmin,
}: {
  initialSales: SaleClient[]
  products: ProductOption[]
  currentUserLabel: string
  isAdmin: boolean
}) {
  const [sales, setSales] = useState(initialSales)
  const [productOptions, setProductOptions] = useState(products)
  const [draftItems, setDraftItems] = useState<DraftItem[]>([emptyDraft])
  const [activeSaleId, setActiveSaleId] = useState<string | null>(null)
  const [notes, setNotes] = useState("")
  const [paymentStatus, setPaymentStatus] = useState<"paid" | "unpaid">(
    "paid"
  )
  const [paymentMethod, setPaymentMethod] = useState<
    "cash" | "bank" | "mobile"
  >("cash")
  const [outstandingOpen, setOutstandingOpen] = useState(false)
  const [outstandingDraft, setOutstandingDraft] = useState<OutstandingDraft>({
    customerName: "",
    customerPhone: "",
    paymentDate: "",
  })
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [search, setSearch] = useState("")

  const productMap = useMemo(
    () => new Map(productOptions.map((product) => [product._id, product])),
    [productOptions]
  )

  const activeSale = useMemo(
    () => sales.find((sale) => sale._id === activeSaleId) ?? null,
    [activeSaleId, sales]
  )

  const draftTotal = useMemo(() => {
    return draftItems.reduce((sum, item) => {
      const quantity = Number(item.quantity)
      const sellingPrice = Number(item.sellingPrice)

      if (!Number.isFinite(quantity) || !Number.isFinite(sellingPrice)) {
        return sum
      }

      return sum + Math.max(0, quantity) * Math.max(0, sellingPrice)
    }, 0)
  }, [draftItems])

  const activeSaleQuantities = useMemo(() => {
    const quantities = new Map<string, number>()
    activeSale?.items.forEach((item) => {
      quantities.set(
        item.productId,
        (quantities.get(item.productId) ?? 0) + item.quantity
      )
    })
    return quantities
  }, [activeSale])

  const filteredSales = useMemo(() => {
    const query = search.trim().toLowerCase()
    const normalizedQuery = normalizeSearchText(search.trim())
    if (!query) return sales

    return sales.filter((sale) => {
      const name = sale.outstanding?.customerName?.toLowerCase() ?? ""
      const phone = sale.outstanding?.customerPhone?.toLowerCase() ?? ""
      const normalizedName = normalizeSearchText(name)
      const normalizedPhone = normalizeSearchText(phone)

      return (
        name.includes(query) ||
        phone.includes(query) ||
        normalizedName.includes(normalizedQuery) ||
        normalizedPhone.includes(normalizedQuery)
      )
    })
  }, [sales, search])

  const pageCount = Math.max(1, Math.ceil(filteredSales.length / SALES_PER_PAGE))
  const safeCurrentPage = Math.min(currentPage, pageCount)
  const pageStart = (safeCurrentPage - 1) * SALES_PER_PAGE
  const paginatedSales = filteredSales.slice(pageStart, pageStart + SALES_PER_PAGE)
  const visibleStart = filteredSales.length === 0 ? 0 : pageStart + 1
  const visibleEnd = Math.min(pageStart + SALES_PER_PAGE, filteredSales.length)

  useEffect(() => {
    if (currentPage > pageCount) {
      setCurrentPage(pageCount)
    }
  }, [currentPage, pageCount])

  useEffect(() => {
    setCurrentPage(1)
  }, [search])

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
    setActiveSaleId(null)
    setNotes("")
    setPaymentStatus("paid")
    setPaymentMethod("cash")
    setOutstandingDraft({
      customerName: "",
      customerPhone: "",
      paymentDate: "",
    })
    setError(null)
  }

  const getItemLabel = (item: SaleItemClient) => {
    return item.name?.trim() || item.sku?.trim() || "Unnamed item"
  }

  const isSoldBelowCost = (item: SaleItemClient) => {
    return item.basePrice !== undefined && item.sellingPrice < item.basePrice
  }

  const updateProductQuantities = (
    previousItems: SaleItemClient[],
    nextItems: SaleItemClient[]
  ) => {
    const changes = new Map<string, number>()

    previousItems.forEach((item) => {
      changes.set(item.productId, (changes.get(item.productId) ?? 0) + item.quantity)
    })
    nextItems.forEach((item) => {
      changes.set(item.productId, (changes.get(item.productId) ?? 0) - item.quantity)
    })

    setProductOptions((current) =>
      current.map((product) => ({
        ...product,
        quantity: product.quantity + (changes.get(product._id) ?? 0),
      }))
    )
  }

  const normalizeSaleResponse = (
    sale: SaleClient,
    previous?: SaleClient | null
  ): SaleClient => ({
    ...previous,
    ...sale,
    _id: sale._id,
    notes: sale.notes ?? "",
    paymentStatus: sale.paymentStatus ?? "paid",
    items: sale.items.map((item) => ({
      ...item,
      productId: String(item.productId),
      unit: item.unit ?? "pcs",
    })),
    createdAtLabel: sale.createdAtLabel ?? previous?.createdAtLabel,
    createdByName: sale.createdByName ?? previous?.createdByName ?? currentUserLabel,
  })

  const openEdit = (sale: SaleClient) => {
    setActiveSaleId(sale._id)
    setDraftItems(
      sale.items.length
        ? sale.items.map((item) => ({
            productId: item.productId,
            quantity: String(item.quantity),
            sellingPrice: String(item.sellingPrice),
            costPrice: isAdmin ? String(item.basePrice ?? "") : "",
          }))
        : [emptyDraft]
    )
    setNotes(sale.notes ?? "")
    setPaymentStatus(sale.paymentStatus ?? "paid")
    setPaymentMethod(sale.paymentMethod ?? "cash")
    setOutstandingDraft({
      customerName: sale.outstanding?.customerName ?? "",
      customerPhone: sale.outstanding?.customerPhone ?? "",
      paymentDate: sale.outstanding?.paymentDate ?? "",
    })
    setError(null)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const submitSale = async (outstanding?: OutstandingDraft) => {
    setError(null)

    const payloadItems = draftItems.map((item) => ({
      productId: item.productId,
      quantity: Number(item.quantity),
      sellingPrice: Number(item.sellingPrice),
      costPrice:
        isAdmin && item.costPrice !== undefined && item.costPrice !== ""
          ? Number(item.costPrice)
          : undefined,
    }))

    if (payloadItems.some((item) => !item.productId)) {
      setError("Select a product for each line.")
      return
    }

    if (
      payloadItems.some((item) => {
        const hasInvalidCostPrice =
          isAdmin &&
          item.costPrice !== undefined &&
          (Number.isNaN(item.costPrice) || item.costPrice < 0)

        return (
          Number.isNaN(item.quantity) ||
          item.quantity < 1 ||
          Number.isNaN(item.sellingPrice) ||
          item.sellingPrice < 0 ||
          hasInvalidCostPrice
        )
      })
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
      const availableQuantity =
        product.quantity + (activeSaleQuantities.get(productId) ?? 0)
      if (totalRequested > availableQuantity) {
        setError(`Insufficient stock for ${product.name}.`)
        return
      }
    }

    setSubmitting(true)

    try {
      if (paymentStatus === "unpaid") {
        if (!outstanding?.customerName.trim()) {
          setError("Customer name is required for unpaid sales.")
          return false
        }
        if (!outstanding?.customerPhone.trim()) {
          setError("Customer phone is required for unpaid sales.")
          return false
        }
        if (!outstanding?.paymentDate) {
          setError("Payment date is required for unpaid sales.")
          return false
        }
      }

      const previousSale = activeSale
      const response = await fetch(
        activeSaleId ? `/api/sales/${activeSaleId}` : "/api/sales",
        {
          method: activeSaleId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            items: payloadItems,
            notes: notes.trim(),
            paymentStatus,
            paymentMethod: paymentStatus === "paid" ? paymentMethod : undefined,
            outstanding:
              paymentStatus === "unpaid"
                ? {
                    customerName: outstanding?.customerName.trim(),
                    customerPhone: outstanding?.customerPhone.trim(),
                    paymentDate: outstanding?.paymentDate,
                  }
                : undefined,
          }),
        }
      )

      const body = await response.json()
      if (!response.ok || !body?.success) {
        setError(body?.error ?? "Failed to save sale.")
        return false
      }

      const savedSale = normalizeSaleResponse(body.data as SaleClient, previousSale)
      updateProductQuantities(previousSale?.items ?? [], savedSale.items)
      setSales((current) => {
        if (previousSale) {
          return current.map((sale) =>
            sale._id === savedSale._id ? savedSale : sale
          )
        }
        return [savedSale, ...current]
      })
      if (!previousSale) {
        setCurrentPage(1)
      }
      resetForm()
      return true
    } catch {
      setError("Failed to save sale.")
      return false
    } finally {
      setSubmitting(false)
    }
  }

  const handleRecordSale = () => {
    if (paymentStatus === "unpaid") {
      setOutstandingOpen(true)
      return
    }

    submitSale()
  }

  const handleOutstandingSubmit = async () => {
    const didSubmit = await submitSale(outstandingDraft)
    if (didSubmit) {
      setOutstandingOpen(false)
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
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-lg font-semibold">
            {activeSaleId ? "Edit Sale" : "Record Sale"}
          </h3>
          {activeSaleId ? (
            <Button variant="outline" onClick={resetForm} disabled={submitting}>
              Cancel Edit
            </Button>
          ) : null}
        </div>
        <div className="space-y-3">
          {draftItems.map((item, index) => {
            const selectedProduct = item.productId
              ? productMap.get(item.productId)
              : null
            return (
              <div
                key={`${index}-${item.productId}`}
                className={`grid gap-3 rounded-lg border border-border/80 p-3 ${
                  isAdmin
                    ? "md:grid-cols-[1.6fr_0.7fr_0.7fr_0.7fr_auto]"
                    : "md:grid-cols-[1.6fr_0.8fr_1fr_auto]"
                }`}
              >
                <label className="grid gap-1 text-sm">
                  Product
                  <ProductSearchSelect
                    products={productOptions}
                    value={item.productId}
                    onValueChange={(value) => {
                      const product = productMap.get(value)
                      setDraftItem(index, "productId", value)
                      if (product) {
                        setDraftItem(index, "sellingPrice", String(product.price))
                        if (isAdmin) {
                          setDraftItem(
                            index,
                            "costPrice",
                            String(product.costPrice ?? product.price)
                          )
                        }
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

                {isAdmin ? (
                  <label className="grid gap-1 text-sm">
                    Cost Price
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      placeholder="e.g. 800"
                      value={item.costPrice ?? ""}
                      onChange={(event) =>
                        setDraftItem(index, "costPrice", event.target.value)
                      }
                    />
                  </label>
                ) : null}

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
                    Base price: {formatCurrency(selectedProduct.costPrice ?? selectedProduct.price)} | Available: {selectedProduct.quantity + (activeSaleQuantities.get(item.productId) ?? 0)} {selectedProduct.unit}
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

        <div className="flex items-center justify-between rounded-lg border border-border/80 bg-muted/40 px-4 py-3 text-sm">
          <span className="text-muted-foreground">Total to be paid</span>
          <span className="text-base font-semibold text-foreground">
            {formatCurrency(draftTotal)}
          </span>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="grid gap-1 text-sm">
            Payment status
            <Select
              value={paymentStatus}
              onValueChange={(value) =>
                setPaymentStatus(value as "paid" | "unpaid")
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="unpaid">Unpaid</SelectItem>
              </SelectContent>
            </Select>
          </label>

          {paymentStatus === "paid" ? (
            <label className="grid gap-1 text-sm">
              Payment method
              <Select
                value={paymentMethod}
                onValueChange={(value) =>
                  setPaymentMethod(value as "cash" | "bank" | "mobile")
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="bank">Bank</SelectItem>
                  <SelectItem value="mobile">Mobile Money</SelectItem>
                </SelectContent>
              </Select>
            </label>
          ) : null}
        </div>

        <label className="grid gap-1 text-sm">
          Notes (optional)
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            className="min-h-20 rounded-md border border-border px-3 py-2"
            placeholder="Any note for this sale"
          />
        </label>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <Button
          onClick={handleRecordSale}
          disabled={submitting || productOptions.length === 0}
        >
          {submitting
            ? activeSaleId
              ? "Saving..."
              : "Recording..."
            : activeSaleId
              ? "Save Changes"
              : "Record Sale"}
        </Button>
      </section>

      <Dialog open={outstandingOpen} onOpenChange={setOutstandingOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Loan details</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <label className="grid gap-1 text-sm">
              Customer name
              <Input
                value={outstandingDraft.customerName}
                onChange={(event) =>
                  setOutstandingDraft((current) => ({
                    ...current,
                    customerName: event.target.value,
                  }))
                }
              />
            </label>
            <label className="grid gap-1 text-sm">
              Customer phone
              <Input
                value={outstandingDraft.customerPhone}
                onChange={(event) =>
                  setOutstandingDraft((current) => ({
                    ...current,
                    customerPhone: event.target.value,
                  }))
                }
              />
            </label>
            <label className="grid gap-1 text-sm">
              Payment date
              <Input
                type="date"
                value={outstandingDraft.paymentDate}
                onChange={(event) =>
                  setOutstandingDraft((current) => ({
                    ...current,
                    paymentDate: event.target.value,
                  }))
                }
              />
            </label>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOutstandingOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleOutstandingSubmit}
              disabled={submitting}
            >
              {submitting
                ? activeSaleId
                  ? "Saving..."
                  : "Recording..."
                : activeSaleId
                  ? "Save Changes"
                  : "Record Sale"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="w-full sm:max-w-sm">
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by customer name or phone"
          aria-label="Search sales by customer name or phone"
        />
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Time</TableHead>
            <TableHead>Customer Name</TableHead>
            <TableHead>Customer Phone</TableHead>
            <TableHead>Items Sold</TableHead>
            <TableHead>Cost Price</TableHead>
            <TableHead>Sold Price</TableHead>
            <TableHead>Total</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Logged By</TableHead>
            {isAdmin ? <TableHead>Actions</TableHead> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {paginatedSales.length === 0 ? (
            <TableRow>
              <TableCell colSpan={isAdmin ? 10 : 9} className="text-muted-foreground">
                {search.trim() ? "No matching sales found." : "No sales recorded yet."}
              </TableCell>
            </TableRow>
          ) : (
            paginatedSales.map((sale) => {
              const customerName = sale.paymentStatus === "unpaid" ? sale.outstanding?.customerName ?? "-" : "-"
              const customerPhone = sale.paymentStatus === "unpaid" ? sale.outstanding?.customerPhone ?? "-" : "-"
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
                      {itemIndex === 0 ? (
                        <>
                          <TableCell rowSpan={rowSpan}>
                            {customerName}
                          </TableCell>
                          <TableCell rowSpan={rowSpan}>
                            {customerPhone}
                          </TableCell>
                        </>
                      ) : null}
                      <TableCell>
                        <div className="whitespace-normal wrap-break-word">
                          <p className="font-medium">
                            {getItemLabel(item)} ({item.quantity} {item.unit ?? "pcs"})
                          </p>
                          {item.sku ? (
                            <p className="text-xs text-muted-foreground">
                              {item.sku}
                            </p>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell>{formatCurrency(item.basePrice ?? 0)}</TableCell>
                      <TableCell>
                        <div className="grid gap-1">
                          <span>{formatCurrency(item.sellingPrice)}</span>
                          {isSoldBelowCost(item) ? (
                            <span className="inline-flex w-fit items-center gap-1 rounded-md border border-destructive/30 bg-destructive/10 px-2 py-1 text-xs font-medium text-destructive">
                              <AlertTriangle className="size-3.5" />
                              Sold below cost
                            </span>
                          ) : null}
                        </div>
                      </TableCell>
                      {itemIndex === 0 ? (
                        <>
                          <TableCell rowSpan={rowSpan}>
                            {formatCurrency(sale.totalAmount)}
                          </TableCell>
                          <TableCell rowSpan={rowSpan}>
                            <span
                              className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${
                                sale.paymentStatus === "unpaid"
                                  ? "border-amber-500/30 bg-amber-500/10 text-amber-700"
                                  : "border-emerald-500/30 bg-emerald-500/10 text-emerald-700"
                              }`}
                            >
                              {getStatusLabel(sale.paymentStatus)}
                            </span>
                          </TableCell>
                          <TableCell rowSpan={rowSpan}>
                            {sale.createdByName ?? "Unknown User"}
                          </TableCell>
                          {isAdmin ? (
                            <TableCell rowSpan={rowSpan}>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => openEdit(sale)}
                              >
                                <Pencil className="size-4" />
                                Edit
                              </Button>
                            </TableCell>
                          ) : null}
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
          Showing {visibleStart}-{visibleEnd} of {filteredSales.length} sales
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
