"use client"

import { useEffect, useMemo, useState } from "react"
import { Input } from "@/components/ui/input"

export type ProductSearchOption = {
  _id: string
  name: string
  sku: string
  unit: string
  quantity: number
}

function formatProductLabel(product: ProductSearchOption) {
  return `${product.name} (${product.sku})`
}

export function ProductSearchSelect({
  products,
  value,
  onValueChange,
  placeholder = "Search product by name or SKU",
}: {
  products: ProductSearchOption[]
  value: string
  onValueChange: (value: string) => void
  placeholder?: string
}) {
  const [search, setSearch] = useState("")
  const [open, setOpen] = useState(false)

  const selectedProduct = useMemo(
    () => products.find((product) => product._id === value) ?? null,
    [products, value]
  )

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return products.slice(0, 20)

    return products
      .filter((product) => {
        return (
          product.name.toLowerCase().includes(query) ||
          product.sku.toLowerCase().includes(query)
        )
      })
      .slice(0, 20)
  }, [products, search])

  useEffect(() => {
    if (!open) {
      setSearch(selectedProduct ? formatProductLabel(selectedProduct) : "")
    }
  }, [open, selectedProduct])

  return (
    <div className="relative">
      <Input
        value={search}
        placeholder={placeholder}
        onFocus={(event) => {
          setOpen(true)
          event.currentTarget.select()
        }}
        onBlur={() => {
          window.setTimeout(() => setOpen(false), 120)
        }}
        onChange={(event) => {
          setSearch(event.target.value)
          setOpen(true)
          if (
            selectedProduct &&
            event.target.value !== formatProductLabel(selectedProduct)
          ) {
            onValueChange("")
          }
        }}
      />
      {open ? (
        <div className="absolute z-40 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-md">
          {filteredProducts.length === 0 ? (
            <div className="px-2 py-2 text-sm text-muted-foreground">
              No products found.
            </div>
          ) : (
            filteredProducts.map((product) => (
              <button
                key={product._id}
                type="button"
                className="flex w-full flex-col rounded-md px-2 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus:outline-none"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onValueChange(product._id)
                  setSearch(formatProductLabel(product))
                  setOpen(false)
                }}
              >
                <span className="font-medium">{product.name}</span>
                <span className="text-xs text-muted-foreground">
                  {product.sku} - Stock {product.quantity} {product.unit}
                </span>
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  )
}
