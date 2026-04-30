"use client"

import { useMemo, useState } from "react"
import type { CategoryDocument } from "@/lib/db/models/Category"
import type { ProductDocument } from "@/lib/db/models/Product"
import { formatCurrency } from "@/lib/utils/format"
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

type CategoryClient = Pick<CategoryDocument, "name" | "description"> & {
  _id: string
  createdAt?: string
  updatedAt?: string
}

type ProductClient = Pick<
  ProductDocument,
  "name" | "sku" | "unit" | "quantity" | "lowStockThreshold" | "costPrice" | "price" | "categoryId"
> & {
  _id: string
  createdAt?: string
  updatedAt?: string
  categoryId: string | CategoryClient
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

  const categoryMap = useMemo(() => {
    return new Map(categories.map((category) => [category._id, category]))
  }, [categories])

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
      lowStockThreshold: String(product.lowStockThreshold ?? 10),
      costPrice: String(product.costPrice ?? 0),
      price: String(product.price ?? 0),
      categoryId: categoryId ?? categories[0]?._id ?? "",
    })
    setActiveProductId(product._id)
    setError(null)
    setDialogOpen(true)
  }

  const submitForm = async () => {
    if (!formState.name || !formState.sku || !formState.unit || !formState.lowStockThreshold || !formState.categoryId) {
      setError("Please fill all required fields.")
      return
    }

    setSubmitting(true)
    setError(null)

    const payload = {
      name: formState.name.trim(),
      sku: formState.sku.trim(),
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

      const updated = body.data as ProductDocument & { _id: string }

      setProducts((current) => {
        if (activeProductId) {
          return current.map((item) =>
            item._id === activeProductId ? updated : item
          )
        }
        return [updated, ...current]
      })

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

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Catalog
          </p>
          <h2 className="text-2xl font-semibold">Products</h2>
        </div>
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
                  SKU
                  <Input
                    value={formState.sku}
                    onChange={(event) =>
                      setFormState((prev) => ({
                        ...prev,
                        sku: event.target.value,
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
                    Low Stock Threshold
                    <Input
                      type="number"
                      min={0}
                      placeholder="e.g. 10"
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
          {products.map((product) => (
            <TableRow key={product._id.toString()}>
              <TableCell>{product.name}</TableCell>
              <TableCell>{product.sku}</TableCell>
              <TableCell>{resolveCategoryName(product)}</TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <span>{product.quantity}</span>
                  {product.quantity <= (product.lowStockThreshold ?? 10) ? (
                    <span className="rounded-md bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                      Low
                    </span>
                  ) : null}
                </div>
              </TableCell>
              <TableCell>{product.unit ?? "pcs"}</TableCell>
              <TableCell>{product.lowStockThreshold ?? 10}</TableCell>
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
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
