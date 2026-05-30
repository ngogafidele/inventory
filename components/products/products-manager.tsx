"use client"

// Manages product records, catalog actions, and branch inventory display.
import { useMemo, useState } from "react"
import { formatCurrency } from "@/lib/utils/format"
import { formatKigaliDateInput } from "@/lib/utils/time"
import { FileText, PackagePlus } from "lucide-react"
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type ProductClient = {
  _id: string
  name: string
  sku: string
  unit: string
  quantity: number
  lowStockThreshold: number
  costPrice: number
  price: number
  lastRestock?: string
  lastRestockLabel?: string
  supplierName?: string
  createdAt?: string
  updatedAt?: string
}

export type ProductsManagerProps = {
  initialProducts: ProductClient[]
  isAdmin: boolean
}

type FormState = {
  name: string
  sku: string
  unit: string
  quantity: string
  lowStockThreshold: string
  costPrice: string
  price: string
  supplierName: string
  supplierPhone: string
}

type ReceiveFormState = {
  supplierName: string
  supplierPhone: string
  quantity: string
  unitCost: string
  receivedAt: string
}

const emptyForm: FormState = {
  name: "",
  sku: "",
  unit: "",
  quantity: "",
  lowStockThreshold: "",
  costPrice: "",
  price: "",
  supplierName: "",
  supplierPhone: "",
}

function getEmptyReceiveForm(): ReceiveFormState {
  return {
    supplierName: "",
    supplierPhone: "",
    quantity: "",
    unitCost: "",
    receivedAt: formatKigaliDateInput(new Date()),
  }
}

const PRODUCTS_PER_PAGE = 20

export function ProductsManager({
  initialProducts,
  isAdmin,
}: ProductsManagerProps) {
  const [products, setProducts] = useState(initialProducts)
  const [formState, setFormState] = useState<FormState>(emptyForm)
  const [activeProductId, setActiveProductId] = useState<string | null>(null)
  const [receiveProduct, setReceiveProduct] = useState<ProductClient | null>(
    null
  )
  const [receiveForm, setReceiveForm] =
    useState<ReceiveFormState>(getEmptyReceiveForm)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [receiveDialogOpen, setReceiveDialogOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [catalogDownloading, setCatalogDownloading] = useState(false)

  const costValue = Number(formState.costPrice)
  const priceValue = Number(formState.price)
  const showPriceWarning =
    formState.costPrice.trim() !== "" &&
    formState.price.trim() !== "" &&
    !Number.isNaN(costValue) &&
    !Number.isNaN(priceValue) &&
    priceValue < costValue
  const receiveQuantityValue = Number(receiveForm.quantity)
  const receiveUnitCostValue = Number(receiveForm.unitCost)
  const receiveTotal =
    Number.isFinite(receiveQuantityValue) &&
    Number.isFinite(receiveUnitCostValue)
      ? Math.max(0, receiveQuantityValue) * Math.max(0, receiveUnitCostValue)
      : 0

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return products

    return products.filter((product) => {
      return (
        product.name.toLowerCase().includes(query) ||
        product.sku.toLowerCase().includes(query) ||
        (product.unit ?? "").toLowerCase().includes(query)
      )
    })
  }, [products, search])

  const pageCount = Math.max(
    1,
    Math.ceil(filteredProducts.length / PRODUCTS_PER_PAGE)
  )
  const safeCurrentPage = Math.min(currentPage, pageCount)
  const pageStart = (safeCurrentPage - 1) * PRODUCTS_PER_PAGE
  const paginatedProducts = filteredProducts.slice(
    pageStart,
    pageStart + PRODUCTS_PER_PAGE
  )
  const visibleStart = filteredProducts.length === 0 ? 0 : pageStart + 1
  const visibleEnd = Math.min(
    pageStart + PRODUCTS_PER_PAGE,
    filteredProducts.length
  )

  const resetForm = () => {
    setFormState({
      ...emptyForm,
    })
    setActiveProductId(null)
    setError(null)
  }

  const openCreate = () => {
    resetForm()
    setDialogOpen(true)
  }

  const openEdit = (product: ProductClient) => {
    setFormState({
      name: product.name,
      sku: product.sku,
      unit: product.unit ?? "pcs",
      quantity: String(product.quantity ?? 0),
      lowStockThreshold: String(product.lowStockThreshold ?? 0),
      costPrice: String(product.costPrice ?? 0),
      price: String(product.price ?? 0),
      supplierName: "",
      supplierPhone: "",
    })
    setActiveProductId(product._id)
    setError(null)
    setDialogOpen(true)
  }

  const openReceive = (product: ProductClient) => {
    setReceiveProduct(product)
    setReceiveForm({
      ...getEmptyReceiveForm(),
      unitCost: String(product.costPrice ?? 0),
    })
    setError(null)
    setReceiveDialogOpen(true)
  }

  const submitReceive = async () => {
    if (!receiveProduct) return

    const supplierName = receiveForm.supplierName.trim()
    const supplierPhone = receiveForm.supplierPhone.trim()
    const quantity = Number(receiveForm.quantity)
    const unitCost = Number(receiveForm.unitCost)

    if (!supplierName || !supplierPhone || !receiveForm.receivedAt) {
      setError("Supplier name, phone, and received date are required.")
      return
    }

    if (
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      Number.isNaN(unitCost) ||
      unitCost < 0
    ) {
      setError("Quantity must be at least 1 and cost must be 0 or more.")
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const response = await fetch(
        `/api/products/${receiveProduct._id}/receipts`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            supplierName,
            supplierPhone,
            quantity,
            unitCost,
            receivedAt: receiveForm.receivedAt,
          }),
        }
      )
      const body = await response.json()

      if (!response.ok || !body?.success) {
        setError(body?.error ?? "Failed to receive product.")
        return
      }

      const updatedProduct = body.data.product as ProductClient
      const receipt = body.data.receipt as
        | { supplierName?: string; receivedAt?: string }
        | undefined
      setProducts((current) =>
        current.map((product) =>
          product._id === receiveProduct._id
            ? {
                ...updatedProduct,
                lastRestock: receipt?.receivedAt,
                lastRestockLabel: receiveForm.receivedAt,
                supplierName: receipt?.supplierName ?? supplierName,
              }
            : product
        )
      )
      setReceiveDialogOpen(false)
      setReceiveProduct(null)
      setReceiveForm(getEmptyReceiveForm())
    } catch {
      setError("Failed to receive product.")
    } finally {
      setSubmitting(false)
    }
  }

  const submitForm = async () => {
    const trimmedName = formState.name.trim()
    const trimmedUnit = formState.unit.trim()
    const supplierName = formState.supplierName?.trim() ?? ""
    const supplierPhone = formState.supplierPhone?.trim() ?? ""

    if (!trimmedName || !trimmedUnit) {
      setError("Please fill all required fields.")
      return
    }

    if (!activeProductId && Boolean(supplierName) !== Boolean(supplierPhone)) {
      setError("Supplier name and phone must be provided together.")
      return
    }

    setSubmitting(true)
    setError(null)

    const payload = {
      name: trimmedName,
      unit: trimmedUnit,
      quantity: Number(formState.quantity || 0),
      lowStockThreshold: Number(formState.lowStockThreshold || 0),
      costPrice: Number(formState.costPrice || 0),
      price: Number(formState.price || 0),
      ...(!activeProductId && supplierName && supplierPhone
        ? { supplierName, supplierPhone }
        : {}),
    }

    try {
      const response = await fetch(
        activeProductId ? `/api/products/${activeProductId}` : "/api/products",
        {
          method: activeProductId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      )

      const body = await response.json()
      if (!response.ok || !body?.success) {
        setError(body?.error ?? "Failed to save product.")
        return
      }

      const updated = body.data as ProductClient
      const productForList =
        !activeProductId && supplierName && supplierPhone && updated.quantity > 0
          ? {
              ...updated,
              lastRestock: new Date().toISOString(),
              lastRestockLabel: "Today",
              supplierName,
            }
          : updated

      setProducts((current) => {
        if (activeProductId) {
          return current.map((item) =>
            item._id === activeProductId ? productForList : item
          )
        }
        return [productForList, ...current]
      })
      setCurrentPage(1)

      setDialogOpen(false)
      resetForm()
    } catch {
      setError("Failed to save product.")
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (productId: string) => {
    if (!confirm("Delete this product?")) {
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const response = await fetch(`/api/products/${productId}`, {
        method: "DELETE",
      })
      const body = await response.json()
      if (!response.ok || !body?.success) {
        setError(body?.error ?? "Failed to delete product.")
        return
      }

      setProducts((current) =>
        current.filter((product) => product._id !== productId)
      )
    } catch {
      setError("Failed to delete product.")
    } finally {
      setSubmitting(false)
    }
  }

  const produceCatalogPdf = async () => {
    setCatalogDownloading(true)
    setError(null)

    try {
      const response = await fetch("/api/products/catalog/pdf")

      if (!response.ok) {
        const body = await response.json().catch(() => null)
        setError(body?.error ?? "Failed to download catalog PDF.")
        return
      }

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      const disposition = response.headers.get("content-disposition")
      const filename =
        disposition?.match(/filename="(.+)"/)?.[1] ?? "products-catalog.pdf"
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch {
      setError("Failed to download catalog PDF.")
    } finally {
      setCatalogDownloading(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Catalog
          </p>
          <h2 className="text-2xl font-semibold">Products</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <Input
            placeholder="Search products"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value)
              setCurrentPage(1)
            }}
            className="w-full sm:w-56"
          />
          <Button
            variant="outline"
            onClick={produceCatalogPdf}
            disabled={catalogDownloading}
          >
            <FileText className="size-4" />
            {catalogDownloading ? "Preparing..." : "Catalog PDF"}
          </Button>
          {isAdmin ? (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={openCreate}>Add Product</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>
                    {activeProductId ? "Edit product" : "Add product"}
                  </DialogTitle>
                </DialogHeader>
                <div className="grid gap-3">
                  <label className="grid gap-1 text-sm">
                    Name
                    <Input
                      value={formState.name}
                      onChange={(event) =>
                        setFormState((prev) => ({
                          ...prev,
                          name: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className="grid gap-1 text-sm">
                    Unit
                    <Input
                      placeholder="pcs, kg, l, box"
                      value={formState.unit}
                      onChange={(event) =>
                        setFormState((prev) => ({
                          ...prev,
                          unit: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="grid gap-1 text-sm">
                      Quantity
                      <Input
                        type="number"
                        min={0}
                        placeholder="e.g. 120"
                        value={formState.quantity}
                        onChange={(event) =>
                          setFormState((prev) => ({
                            ...prev,
                            quantity: event.target.value,
                          }))
                        }
                      />
                    </label>
                    <label className="grid gap-1 text-sm">
                      Low Stock Threshold (optional)
                      <Input
                        type="number"
                        min={0}
                        placeholder="Defaults to 0"
                        value={formState.lowStockThreshold}
                        onChange={(event) =>
                          setFormState((prev) => ({
                            ...prev,
                            lowStockThreshold: event.target.value,
                          }))
                        }
                      />
                    </label>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="grid gap-1 text-sm">
                      Cost Price
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        placeholder="e.g. 850"
                        value={formState.costPrice}
                        onChange={(event) =>
                          setFormState((prev) => ({
                            ...prev,
                            costPrice: event.target.value,
                          }))
                        }
                      />
                    </label>
                  </div>
                  {!activeProductId ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="grid gap-1 text-sm">
                        Supplier name
                        <Input
                          value={formState.supplierName}
                          onChange={(event) =>
                            setFormState((prev) => ({
                              ...prev,
                              supplierName: event.target.value,
                            }))
                          }
                        />
                      </label>
                      <label className="grid gap-1 text-sm">
                        Supplier phone
                        <Input
                          value={formState.supplierPhone}
                          onChange={(event) =>
                            setFormState((prev) => ({
                              ...prev,
                              supplierPhone: event.target.value,
                            }))
                          }
                        />
                      </label>
                    </div>
                  ) : null}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="grid gap-1 text-sm">
                      Selling Price
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        placeholder="e.g. 1000"
                        value={formState.price}
                        onChange={(event) =>
                          setFormState((prev) => ({
                            ...prev,
                            price: event.target.value,
                          }))
                        }
                      />
                      {showPriceWarning ? (
                        <span className="text-xs text-amber-600">
                          Warning: selling price is below cost price.
                        </span>
                      ) : null}
                    </label>
                  </div>
                  {error ? (
                    <p className="text-sm text-destructive">{error}</p>
                  ) : null}
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button onClick={submitForm} disabled={submitting}>
                    {submitting
                      ? "Saving..."
                      : activeProductId
                      ? "Save changes"
                      : "Create product"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          ) : null}
        </div>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Dialog
        open={receiveDialogOpen}
        onOpenChange={(open) => {
            setReceiveDialogOpen(open)
          if (!open) {
            setReceiveProduct(null)
            setReceiveForm(getEmptyReceiveForm())
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Receive {receiveProduct?.name ?? "product"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <label className="grid gap-1 text-sm">
              Supplier name
              <Input
                value={receiveForm.supplierName}
                onChange={(event) =>
                  setReceiveForm((prev) => ({
                    ...prev,
                    supplierName: event.target.value,
                  }))
                }
              />
            </label>
            <label className="grid gap-1 text-sm">
              Supplier phone
              <Input
                value={receiveForm.supplierPhone}
                onChange={(event) =>
                  setReceiveForm((prev) => ({
                    ...prev,
                    supplierPhone: event.target.value,
                  }))
                }
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1 text-sm">
                Quantity
                <Input
                  type="number"
                  min={1}
                  value={receiveForm.quantity}
                  onChange={(event) =>
                    setReceiveForm((prev) => ({
                      ...prev,
                      quantity: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="grid gap-1 text-sm">
                Unit cost
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={receiveForm.unitCost}
                  onChange={(event) =>
                    setReceiveForm((prev) => ({
                      ...prev,
                      unitCost: event.target.value,
                    }))
                  }
                />
              </label>
            </div>
            <label className="grid gap-1 text-sm">
              Received date
              <Input
                type="date"
                value={receiveForm.receivedAt}
                onChange={(event) =>
                  setReceiveForm((prev) => ({
                    ...prev,
                    receivedAt: event.target.value,
                  }))
                }
              />
            </label>
            <div className="flex items-center justify-between rounded-lg border border-border/80 bg-muted/40 px-4 py-3 text-sm">
              <span className="text-muted-foreground">Supplied goods cost</span>
              <span className="font-semibold text-foreground">
                {formatCurrency(receiveTotal)}
              </span>
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setReceiveDialogOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="button" onClick={submitReceive} disabled={submitting}>
              {submitting ? "Receiving..." : "Receive"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>SKU</TableHead>
            <TableHead>Quantity</TableHead>
            <TableHead>Unit</TableHead>
            <TableHead>Low Stock Threshold</TableHead>
            <TableHead>Cost Price</TableHead>
            <TableHead>Selling Price</TableHead>
            <TableHead>Last Restock</TableHead>
            <TableHead>Supplier</TableHead>
            {isAdmin ? <TableHead className="text-right">Actions</TableHead> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {paginatedProducts.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={isAdmin ? 10 : 9}
                className="text-muted-foreground"
              >
                No products found.
              </TableCell>
            </TableRow>
          ) : (
            paginatedProducts.map((product, productIndex) => (
              <TableRow
                key={product._id.toString()}
                className={
                  productIndex % 2 === 1
                    ? "bg-muted/60 hover:bg-muted/70"
                    : undefined
                }
              >
                <TableCell>{product.name}</TableCell>
                <TableCell>{product.sku}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span>{product.quantity}</span>
                    {product.quantity <= (product.lowStockThreshold ?? 0) ? (
                      <span className="rounded-md bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                        Low
                      </span>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell>{product.unit ?? "pcs"}</TableCell>
                <TableCell>{product.lowStockThreshold ?? 0}</TableCell>
                <TableCell>{formatCurrency(product.costPrice ?? 0)}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span>{formatCurrency(product.price)}</span>
                    {product.price < (product.costPrice ?? 0) ? (
                      <span className="rounded-md bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                        Below cost
                      </span>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell>{product.lastRestockLabel ?? "-"}</TableCell>
                <TableCell>{product.supplierName ?? "-"}</TableCell>
                {isAdmin ? (
                  <TableCell className="text-right">
                    <div className="flex flex-wrap justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openReceive(product)}
                        disabled={submitting}
                      >
                        <PackagePlus className="size-4" />
                        Receive
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openEdit(product)}
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDelete(product._id)}
                        disabled={submitting}
                      >
                        Delete
                      </Button>
                    </div>
                  </TableCell>
                ) : null}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
      <div className="flex flex-col gap-3 border-t border-border/80 pt-4 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p>
          Showing {visibleStart}-{visibleEnd} of {filteredProducts.length} products
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
