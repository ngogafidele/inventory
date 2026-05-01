"use client"

import { useEffect, useMemo, useState } from "react"
import { formatCurrency } from "@/lib/utils/format"
import { FileText } from "lucide-react"
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

type CategoryClient = {
  _id: string
  name: string
  description: string
  createdAt?: string
  updatedAt?: string
}

type ProductClient = {
  _id: string
  name: string
  sku: string
  unit: string
  quantity: number
  lowStockThreshold: number
  costPrice: number
  price: number
  createdAt?: string
  updatedAt?: string
  categoryId?: string | CategoryClient
}

export type ProductsManagerProps = {
  initialProducts: ProductClient[]
  categories: CategoryClient[]
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
  categoryId: string
}

const emptyForm: FormState = {
  name: "",
  sku: "",
  unit: "",
  quantity: "",
  lowStockThreshold: "",
  costPrice: "",
  price: "",
  categoryId: "",
}

const PRODUCTS_PER_PAGE = 20

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

export function ProductsManager({
  initialProducts,
  categories,
  isAdmin,
}: ProductsManagerProps) {
  const [products, setProducts] = useState(initialProducts)
  const [formState, setFormState] = useState<FormState>(emptyForm)
  const [activeProductId, setActiveProductId] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)

  const categoryMap = useMemo(() => {
    return new Map(categories.map((category) => [category._id, category]))
  }, [categories])

  const pageCount = Math.max(1, Math.ceil(products.length / PRODUCTS_PER_PAGE))
  const safeCurrentPage = Math.min(currentPage, pageCount)
  const pageStart = (safeCurrentPage - 1) * PRODUCTS_PER_PAGE
  const paginatedProducts = products.slice(
    pageStart,
    pageStart + PRODUCTS_PER_PAGE
  )
  const visibleStart = products.length === 0 ? 0 : pageStart + 1
  const visibleEnd = Math.min(pageStart + PRODUCTS_PER_PAGE, products.length)

  useEffect(() => {
    if (currentPage > pageCount) {
      setCurrentPage(pageCount)
    }
  }, [currentPage, pageCount])

  const resetForm = () => {
    setFormState({
      ...emptyForm,
      categoryId: categories[0]?._id ?? "",
    })
    setActiveProductId(null)
    setError(null)
  }

  const openCreate = () => {
    resetForm()
    setDialogOpen(true)
  }

  const openEdit = (product: ProductClient) => {
    const categoryId =
      typeof product.categoryId === "object" && product.categoryId
        ? product.categoryId._id
        : product.categoryId

    setFormState({
      name: product.name,
      sku: product.sku,
      unit: product.unit ?? "pcs",
      quantity: String(product.quantity ?? 0),
      lowStockThreshold: String(product.lowStockThreshold ?? 0),
      costPrice: String(product.costPrice ?? 0),
      price: String(product.price ?? 0),
      categoryId: categoryId ?? categories[0]?._id ?? "",
    })
    setActiveProductId(product._id)
    setError(null)
    setDialogOpen(true)
  }

  const submitForm = async () => {
    if (
      !formState.name ||
      !formState.unit ||
      !formState.categoryId
    ) {
      setError("Please fill all required fields.")
      return
    }

    setSubmitting(true)
    setError(null)

    const payload = {
      name: formState.name.trim(),
      unit: formState.unit.trim(),
      quantity: Number(formState.quantity || 0),
      lowStockThreshold: Number(formState.lowStockThreshold || 0),
      costPrice: Number(formState.costPrice || 0),
      price: Number(formState.price || 0),
      categoryId: formState.categoryId,
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

      setProducts((current) => {
        if (activeProductId) {
          return current.map((item) =>
            item._id === activeProductId ? updated : item
          )
        }
        return [updated, ...current]
      })
      setCurrentPage(1)

      setDialogOpen(false)
      resetForm()
    } catch (err) {
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
    } catch (err) {
      setError("Failed to delete product.")
    } finally {
      setSubmitting(false)
    }
  }

  const resolveCategoryName = (product: ProductClient) => {
    if (typeof product.categoryId === "object" && product.categoryId) {
      return product.categoryId.name
    }

    if (typeof product.categoryId === "string") {
      return categoryMap.get(product.categoryId)?.name ?? "Unassigned"
    }

    return "Unassigned"
  }

  const produceCatalogPdf = () => {
    const printWindow = window.open("", "_blank")
    if (!printWindow) {
      setError("Allow pop-ups to produce the catalog PDF.")
      return
    }

    const generatedAt = new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date())

    const rows = products
      .map((product, index) => {
        const categoryName = resolveCategoryName(product)
        const stockStatus =
          product.quantity <= (product.lowStockThreshold ?? 0)
            ? "Low stock"
            : "In stock"

        return `
          <tr>
            <td>${index + 1}</td>
            <td>
              <strong>${escapeHtml(product.name)}</strong>
              <span>${escapeHtml(product.sku)}</span>
            </td>
            <td>${escapeHtml(categoryName)}</td>
            <td>${escapeHtml(String(product.quantity))} ${escapeHtml(product.unit ?? "pcs")}</td>
            <td>${escapeHtml(String(product.lowStockThreshold ?? 0))}</td>
            <td>${escapeHtml(formatCurrency(product.costPrice ?? 0))}</td>
            <td>${escapeHtml(formatCurrency(product.price))}</td>
            <td>${stockStatus}</td>
          </tr>
        `
      })
      .join("")

    printWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>Products Catalog</title>
          <style>
            * { box-sizing: border-box; }
            body {
              margin: 0;
              padding: 32px;
              color: #17201b;
              font-family: Arial, sans-serif;
              background: #ffffff;
            }
            header {
              display: flex;
              justify-content: space-between;
              gap: 24px;
              border-bottom: 2px solid #1f8a5b;
              padding-bottom: 16px;
              margin-bottom: 24px;
            }
            h1 {
              margin: 0 0 6px;
              font-size: 28px;
              letter-spacing: 0;
            }
            p {
              margin: 0;
              color: #53645b;
              font-size: 13px;
            }
            .summary {
              text-align: right;
              white-space: nowrap;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              font-size: 12px;
            }
            th {
              background: #e9f6ef;
              color: #173c2b;
              text-align: left;
              border: 1px solid #c8ded2;
              padding: 9px 8px;
            }
            td {
              border: 1px solid #d8e3dc;
              padding: 8px;
              vertical-align: top;
            }
            td span {
              display: block;
              margin-top: 3px;
              color: #66746c;
              font-size: 11px;
            }
            tr:nth-child(even) td {
              background: #fbfdfc;
            }
            @page {
              size: A4 landscape;
              margin: 12mm;
            }
            @media print {
              body { padding: 0; }
            }
          </style>
        </head>
        <body>
          <header>
            <div>
              <h1>Products Catalog</h1>
              <p>Complete product list for the current store.</p>
            </div>
            <div class="summary">
              <p><strong>${products.length}</strong> products</p>
              <p>Generated ${escapeHtml(generatedAt)}</p>
            </div>
          </header>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Product</th>
                <th>Category</th>
                <th>Quantity</th>
                <th>Low Stock</th>
                <th>Cost Price</th>
                <th>Selling Price</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${
                rows ||
                '<tr><td colspan="8">No products found.</td></tr>'
              }
            </tbody>
          </table>
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
    <div className="space-y-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Catalog
          </p>
          <h2 className="text-2xl font-semibold">Products</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={produceCatalogPdf}>
            <FileText className="size-4" />
            Catalog PDF
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
                  {activeProductId ? (
                    <div className="grid gap-1 text-sm">
                      SKU
                      <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-muted-foreground">
                        {formState.sku}
                      </div>
                    </div>
                  ) : null}
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
                    </label>
                  </div>
                  <label className="grid gap-1 text-sm">
                    Category
                    <Select
                      value={formState.categoryId}
                      onValueChange={(value) =>
                        setFormState((prev) => ({
                          ...prev,
                          categoryId: value,
                        }))
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select a category" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((category) => (
                          <SelectItem key={category._id} value={category._id}>
                            {category.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </label>
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
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>SKU</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Quantity</TableHead>
            <TableHead>Unit</TableHead>
            <TableHead>Low Stock Threshold</TableHead>
            <TableHead>Cost Price</TableHead>
            <TableHead>Selling Price</TableHead>
            {isAdmin ? <TableHead className="text-right">Actions</TableHead> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {paginatedProducts.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={isAdmin ? 9 : 8}
                className="text-muted-foreground"
              >
                No products found.
              </TableCell>
            </TableRow>
          ) : (
            paginatedProducts.map((product) => (
              <TableRow key={product._id.toString()}>
                <TableCell>{product.name}</TableCell>
                <TableCell>{product.sku}</TableCell>
                <TableCell>{resolveCategoryName(product)}</TableCell>
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
                <TableCell>{formatCurrency(product.price)}</TableCell>
                {isAdmin ? (
                  <TableCell className="text-right">
                    <div className="flex flex-wrap justify-end gap-2">
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
          Showing {visibleStart}-{visibleEnd} of {products.length} products
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
