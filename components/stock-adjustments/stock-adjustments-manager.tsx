"use client"

import { useMemo, useState } from "react"
import { ArrowDown, ArrowUp, SlidersHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
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

type ProductOption = {
  _id: string
  name: string
  sku: string
  unit: string
  quantity: number
}

type AdjustmentClient = {
  _id: string
  productId: string
  sku: string
  quantityChange: number
  reason: string
  createdAt?: string
}

export function StockAdjustmentsManager({
  initialAdjustments,
  products,
}: {
  initialAdjustments: AdjustmentClient[]
  products: ProductOption[]
}) {
  const [adjustments, setAdjustments] = useState(initialAdjustments)
  const [productId, setProductId] = useState(products[0]?._id ?? "")
  const [quantityChange, setQuantityChange] = useState("")
  const [reason, setReason] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const productMap = useMemo(
    () => new Map(products.map((product) => [product._id, product])),
    [products]
  )

  const selectedProduct = productId ? productMap.get(productId) : null

  const submitAdjustment = async () => {
    setError(null)

    const numericChange = Number(quantityChange)
    if (!productId) {
      setError("Please select a product.")
      return
    }
    if (!Number.isInteger(numericChange) || numericChange === 0) {
      setError("Quantity change must be a non-zero integer.")
      return
    }
    if (reason.trim().length < 2) {
      setError("Reason must be at least 2 characters.")
      return
    }

    if (selectedProduct && selectedProduct.quantity + numericChange < 0) {
      setError("Adjustment would make stock negative.")
      return
    }

    setSubmitting(true)
    try {
      const response = await fetch("/api/stock-adjustments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId,
          quantityChange: numericChange,
          reason: reason.trim(),
        }),
      })

      const body = await response.json()
      if (!response.ok || !body?.success) {
        setError(body?.error ?? "Failed to create adjustment.")
        return
      }

      setAdjustments((current) => [body.data as AdjustmentClient, ...current])
      setQuantityChange("")
      setReason("")
    } catch {
      setError("Failed to create adjustment.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Inventory Control
        </p>
        <h2 className="text-2xl font-semibold">Stock Adjustments</h2>
      </div>

      <section className="space-y-4 rounded-2xl border border-border bg-card p-4 sm:p-5">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="size-4 text-primary" />
          <h3 className="text-lg font-semibold">Adjust Stock</h3>
        </div>

        <div className="grid gap-3 md:grid-cols-[1.5fr_0.9fr_1.4fr_auto]">
          <label className="grid gap-1 text-sm">
            Product
            <Select value={productId} onValueChange={setProductId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select product" />
              </SelectTrigger>
              <SelectContent>
                {products.map((product) => (
                  <SelectItem key={product._id} value={product._id}>
                    {product.name} ({product.sku}) - Stock {product.quantity} {product.unit}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>

          <label className="grid gap-1 text-sm">
            Change
            <Input
              type="number"
              step="1"
              placeholder="-3 or 10"
              value={quantityChange}
              onChange={(event) => setQuantityChange(event.target.value)}
            />
          </label>

          <label className="grid gap-1 text-sm">
            Reason
            <Input
              placeholder="Damaged items, recount, etc."
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </label>

          <div className="flex items-end">
            <Button
              onClick={submitAdjustment}
              disabled={submitting || products.length === 0}
            >
              {submitting ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>

        {selectedProduct ? (
          <p className="text-xs text-muted-foreground">
            Current stock: {selectedProduct.quantity} {selectedProduct.unit}
          </p>
        ) : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </section>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>SKU</TableHead>
            <TableHead>Change</TableHead>
            <TableHead>Reason</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {adjustments.map((adjustment) => {
            const isIncrease = adjustment.quantityChange > 0
            return (
              <TableRow key={adjustment._id}>
                <TableCell>
                  {adjustment.createdAt
                    ? new Date(adjustment.createdAt).toLocaleDateString()
                    : "-"}
                </TableCell>
                <TableCell>{adjustment.sku}</TableCell>
                <TableCell>
                  <span
                    className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium ${
                      isIncrease
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {isIncrease ? (
                      <ArrowUp className="size-3.5" />
                    ) : (
                      <ArrowDown className="size-3.5" />
                    )}
                    {adjustment.quantityChange > 0
                      ? `+${adjustment.quantityChange}`
                      : adjustment.quantityChange}
                  </span>
                </TableCell>
                <TableCell>{adjustment.reason}</TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
