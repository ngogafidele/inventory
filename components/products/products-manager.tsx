"use client"

// Manages product records, catalog actions, and branch inventory display.
import { useMemo, useState } from "react"
import { formatCurrency } from "@/lib/utils/format"
import { formatKigaliDateInput } from "@/lib/utils/time"
import { Activity, FileText, PackagePlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  ProductMonitorDialog,
  type MonitorProduct,
} from "@/components/products/product-monitor-dialog"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { PasswordConfirmDialog } from "@/components/auth/password-confirm-dialog"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  COMMON_UNITS,
  describeUnit,
  findUnitOption,
  formatStock,
  getCostUnit,
  getUnitOptions,
  roundCost,
  roundMoney,
  toBaseQuantity,
  type PackUnit,
} from "@/lib/utils/units"
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
  // Base unit; stock, cost, threshold, and price are per one of it.
  unit: string
  packUnits?: PackUnit[]
  costUnit?: string
  quantity: number
  lowStockThreshold: number
  // Per base unit; entered and shown per cost unit (see getCostUnit).
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
  // Whether the active store sells in package units (see PACK_UNIT_STORES).
  packUnitsEnabled: boolean
}

type PackUnitRow = {
  name: string
  factor: string
  price: string
}

type FormState = {
  name: string
  sku: string
  unit: string
  packUnits: PackUnitRow[]
  // Unit the cost field is in; empty means the default (largest package).
  costUnit: string
  // Unit the stock field is counted in; empty means the cost unit.
  stockUnit: string
  // Unit the low-stock threshold is counted in; empty means the cost unit.
  thresholdUnit: string
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
  // Unit bought in; empty means the base unit.
  unit: string
  quantity: string
  unitCost: string
  receivedAt: string
}

const emptyForm: FormState = {
  name: "",
  sku: "",
  unit: "",
  packUnits: [],
  costUnit: "",
  stockUnit: "",
  thresholdUnit: "",
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
    unit: "",
    quantity: "",
    unitCost: "",
    receivedAt: formatKigaliDateInput(new Date()),
  }
}

const PRODUCTS_PER_PAGE = 20

export function ProductsManager({
  initialProducts,
  isAdmin,
  packUnitsEnabled,
}: ProductsManagerProps) {
  const [products, setProducts] = useState(initialProducts)
  const [formState, setFormState] = useState<FormState>(emptyForm)
  const [activeProductId, setActiveProductId] = useState<string | null>(null)
  const [receiveProduct, setReceiveProduct] = useState<ProductClient | null>(
    null
  )
  const [receiveForm, setReceiveForm] =
    useState<ReceiveFormState>(getEmptyReceiveForm)
  const [monitorProduct, setMonitorProduct] = useState<MonitorProduct | null>(
    null
  )
  const [monitorOpen, setMonitorOpen] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [receiveDialogOpen, setReceiveDialogOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [catalogDownloading, setCatalogDownloading] = useState(false)

  // The form's units as currently typed, so the cost field can be entered per
  // crate even before the product is saved.
  const formBaseUnit = formState.unit.trim() || "pcs"
  const formPackUnits: PackUnit[] = formState.packUnits
    .map((row) => ({
      name: row.name.trim(),
      factor: Number(row.factor),
      price: Number(row.price) || 0,
    }))
    .filter((pack) => pack.name && Number.isInteger(pack.factor) && pack.factor >= 2)
  const formCostUnit = getCostUnit({
    unit: formBaseUnit,
    price: Number(formState.price) || 0,
    packUnits: formPackUnits,
    costUnit: formState.costUnit,
  })
  const formCostUnitOptions = getUnitOptions({
    unit: formBaseUnit,
    price: 0,
    packUnits: formPackUnits,
  })
  // Stock can be counted in any of the form's units (10 crates); it is saved
  // in base units.
  const formStockUnit =
    findUnitOption(
      { unit: formBaseUnit, price: 0, packUnits: formPackUnits },
      formState.stockUnit || formCostUnit.name
    ) ?? formCostUnitOptions[0]
  const formStockQuantity = Number(formState.quantity)
  const formStockBase =
    formState.quantity.trim() === ""
      ? 0
      : formStockQuantity === 0
        ? 0
        : toBaseQuantity(formStockQuantity, formStockUnit.factor)
  // The threshold is counted the same way (alert below 2 crates) and saved in
  // base units.
  const formThresholdUnit =
    findUnitOption(
      { unit: formBaseUnit, price: 0, packUnits: formPackUnits },
      formState.thresholdUnit || formCostUnit.name
    ) ?? formCostUnitOptions[0]
  const formThresholdCount = Number(formState.lowStockThreshold)
  const formThresholdBase =
    formState.lowStockThreshold.trim() === "" || formThresholdCount === 0
      ? 0
      : toBaseQuantity(formThresholdCount, formThresholdUnit.factor)
  // Cost per base unit, derived from what was typed per cost unit.
  const costValue = Number(formState.costPrice) / formCostUnit.factor
  const hasFormCost =
    formState.costPrice.trim() !== "" && Number.isFinite(costValue) && costValue >= 0
  const priceValue = Number(formState.price)
  const showPriceWarning =
    formState.costPrice.trim() !== "" &&
    formState.price.trim() !== "" &&
    !Number.isNaN(costValue) &&
    !Number.isNaN(priceValue) &&
    priceValue < costValue
  const receiveQuantityValue = Number(receiveForm.quantity)
  const receiveUnitCostValue = Number(receiveForm.unitCost)
  const receiveUnit = receiveProduct
    ? findUnitOption(receiveProduct, receiveForm.unit)
    : null
  const receiveBaseQuantity =
    receiveUnit && receiveForm.quantity.trim() !== ""
      ? toBaseQuantity(receiveQuantityValue, receiveUnit.factor)
      : null
  const receiveTotal =
    Number.isFinite(receiveQuantityValue) &&
    Number.isFinite(receiveUnitCostValue)
      ? Math.max(0, receiveQuantityValue) * Math.max(0, receiveUnitCostValue)
      : 0
  // The supplier price becomes the product's cost, stored per base unit: a
  // crate of 24 bought at 24,000 costs 1,000 per bottle.
  const receiveCostPreview =
    receiveUnit &&
    receiveForm.unitCost.trim() !== "" &&
    Number.isFinite(receiveUnitCostValue) &&
    receiveUnitCostValue >= 0
      ? receiveUnitCostValue / receiveUnit.factor
      : null

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

  const setPackUnitRow = (
    rowIndex: number,
    field: keyof PackUnitRow,
    value: string
  ) => {
    setFormState((prev) => ({
      ...prev,
      packUnits: prev.packUnits.map((row, index) =>
        index === rowIndex ? { ...row, [field]: value } : row
      ),
    }))
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
      packUnits: (product.packUnits ?? []).map((pack) => ({
        name: pack.name,
        factor: String(pack.factor),
        price: String(pack.price),
      })),
      // Existing stock opens in the base unit: 187 bottles is not a whole
      // number of crates.
      stockUnit: product.unit ?? "pcs",
      quantity: String(product.quantity ?? 0),
      // Shown in the cost unit when it divides evenly (48 bottles -> 2 crates).
      ...(() => {
        const threshold = product.lowStockThreshold ?? 0
        const unit = getCostUnit(product)
        return threshold > 0 && threshold % unit.factor === 0
          ? {
              thresholdUnit: unit.name,
              lowStockThreshold: String(threshold / unit.factor),
            }
          : {
              thresholdUnit: product.unit ?? "pcs",
              lowStockThreshold: String(threshold),
            }
      })(),
      costUnit: getCostUnit(product).name,
      // Shown per cost unit: 500 per bottle appears as 12,000 per crate.
      costPrice: String(
        roundMoney((product.costPrice ?? 0) * getCostUnit(product).factor)
      ),
      price: String(product.price ?? 0),
      supplierName: "",
      supplierPhone: "",
    })
    setActiveProductId(product._id)
    setError(null)
    setDialogOpen(true)
  }

  const openMonitor = (product: ProductClient) => {
    setMonitorProduct({
      _id: product._id,
      name: product.name,
      sku: product.sku,
      unit: product.unit ?? "pcs",
    })
    setMonitorOpen(true)
  }

  const openReceive = (product: ProductClient) => {
    setReceiveProduct(product)
    // Deliveries default to the unit cost is thought of in (e.g. crates),
    // with the current cost for that unit as the starting supplier price.
    const costUnit = getCostUnit(product)
    setReceiveForm({
      ...getEmptyReceiveForm(),
      unit: costUnit.name,
      unitCost: String(roundMoney((product.costPrice ?? 0) * costUnit.factor)),
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

    const unit = findUnitOption(receiveProduct, receiveForm.unit)
    if (
      !unit ||
      !Number.isFinite(quantity) ||
      quantity <= 0 ||
      Number.isNaN(unitCost) ||
      unitCost < 0
    ) {
      setError("Quantity must be more than 0 and cost must be 0 or more.")
      return
    }
    if (toBaseQuantity(quantity, unit.factor) === null) {
      setError(
        `${quantity} ${unit.name} is not a whole number of ${receiveProduct.unit}.`
      )
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
            unit: unit.name,
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

    // Blank rows are ignored; a partly filled row is an error.
    const packUnits: PackUnit[] = []
    for (const row of formState.packUnits) {
      const name = row.name.trim()
      if (!name && !row.factor.trim() && !row.price.trim()) continue
      const factor = Number(row.factor)
      const price = Number(row.price)
      if (
        !name ||
        !Number.isInteger(factor) ||
        factor < 2 ||
        row.price.trim() === "" ||
        !Number.isFinite(price) ||
        price < 0
      ) {
        setError(
          `Package unit "${name || "(no name)"}" needs a name, how many ${trimmedUnit} it holds (2 or more), and a price.`
        )
        return
      }
      packUnits.push({ name, factor, price })
    }

    // Stock is saved in base units: 10 crates of 24 saves as 240 bottles.
    // Same default as the form shows: an unset stock unit means the cost unit.
    const stockUnit = formState.stockUnit
      ? findUnitOption({ unit: trimmedUnit, price: 0, packUnits }, formState.stockUnit)
      : null
    const stockCount = Number(formState.quantity || 0)
    const stockUnitUsed =
      stockUnit ??
      getCostUnit({ unit: trimmedUnit, price: 0, packUnits, costUnit: formState.costUnit })
    const baseStock =
      stockCount === 0 ? 0 : toBaseQuantity(stockCount, stockUnitUsed.factor)
    if (baseStock === null || !Number.isFinite(stockCount) || stockCount < 0) {
      setError(
        `${formState.quantity} ${stockUnitUsed.name} is not a whole number of ${trimmedUnit}.`
      )
      return
    }

    // Threshold likewise: 2 crates of 24 saves as 48 bottles.
    const thresholdUnitUsed =
      (formState.thresholdUnit
        ? findUnitOption({ unit: trimmedUnit, price: 0, packUnits }, formState.thresholdUnit)
        : null) ??
      getCostUnit({ unit: trimmedUnit, price: 0, packUnits, costUnit: formState.costUnit })
    const thresholdCount = Number(formState.lowStockThreshold || 0)
    const baseThreshold =
      thresholdCount === 0
        ? 0
        : toBaseQuantity(thresholdCount, thresholdUnitUsed.factor)
    if (
      baseThreshold === null ||
      !Number.isFinite(thresholdCount) ||
      thresholdCount < 0
    ) {
      setError(
        `Low stock threshold: ${formState.lowStockThreshold} ${thresholdUnitUsed.name} is not a whole number of ${trimmedUnit}.`
      )
      return
    }

    // Stored per base unit: 12,000 entered per crate of 24 saves as 500.
    const costUnit = getCostUnit({
      unit: trimmedUnit,
      price: 0,
      packUnits,
      costUnit: formState.costUnit,
    })

    setSubmitting(true)
    setError(null)

    const payload = {
      name: trimmedName,
      unit: trimmedUnit,
      packUnits,
      quantity: baseStock,
      ...(!activeProductId && stockUnitUsed.factor > 1
        ? { openingUnit: stockUnitUsed.name }
        : {}),
      lowStockThreshold: baseThreshold,
      costUnit: costUnit.name,
      costPrice: roundCost(Number(formState.costPrice || 0) / costUnit.factor),
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

  const handleDelete = async (password: string) => {
    const productId = deleteTarget
    if (!productId) return

    setSubmitting(true)
    setError(null)
    setDeleteError(null)

    try {
      const response = await fetch(`/api/products/${productId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      })
      const body = await response.json()
      if (!response.ok || !body?.success) {
        // Kept inside the dialog so a mistyped password can be corrected
        // without losing which product was being deleted.
        setDeleteError(body?.error ?? "Failed to delete product.")
        return
      }

      setProducts((current) =>
        current.filter((product) => product._id !== productId)
      )
      setDeleteTarget(null)
    } catch {
      setDeleteError("Failed to delete product.")
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
              {/* Wide enough for quantity + unit pickers and the package-units table. */}
              <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
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
                    Base unit (smallest unit sold)
                    <Input
                      placeholder="pcs, bottle, g"
                      list="product-unit-suggestions"
                      value={formState.unit}
                      onChange={(event) =>
                        setFormState((prev) => ({
                          ...prev,
                          unit: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <datalist id="product-unit-suggestions">
                    {COMMON_UNITS.map((unit) => (
                      <option key={unit} value={unit} />
                    ))}
                  </datalist>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="grid gap-1 text-sm">
                      {activeProductId ? "Quantity" : "Opening stock"} (
                      {formStockUnit.name})
                      <div className="flex gap-2 [&>input]:min-w-24 [&>input]:flex-1">
                        <Input
                          type="number"
                          min={0}
                          step="any"
                          placeholder="e.g. 10"
                          value={formState.quantity}
                          onChange={(event) =>
                            setFormState((prev) => ({
                              ...prev,
                              quantity: event.target.value,
                            }))
                          }
                        />
                        {formCostUnitOptions.length > 1 ? (
                          <Select
                            value={formStockUnit.name}
                            onValueChange={(value) =>
                              // Converts when the count divides evenly, so
                              // 240 bottles becomes 10 crates.
                              setFormState((prev) => {
                                const next = formCostUnitOptions.find(
                                  (option) => option.name === value
                                )
                                if (!next) return prev
                                const count = Number(prev.quantity)
                                const base =
                                  prev.quantity.trim() === "" || count === 0
                                    ? null
                                    : toBaseQuantity(count, formStockUnit.factor)
                                return {
                                  ...prev,
                                  stockUnit: next.name,
                                  quantity:
                                    base !== null && base % next.factor === 0
                                      ? String(base / next.factor)
                                      : prev.quantity,
                                }
                              })
                            }
                          >
                            <SelectTrigger className="w-36 shrink-0">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {formCostUnitOptions.map((option) => (
                                <SelectItem key={option.name} value={option.name}>
                                  {describeUnit(option, formBaseUnit)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : null}
                      </div>
                      {formStockUnit.factor > 1 && formState.quantity.trim() !== "" ? (
                        <span
                          className={`text-xs ${
                            formStockBase === null
                              ? "text-destructive"
                              : "text-muted-foreground"
                          }`}
                        >
                          {formStockBase === null
                            ? `Not a whole number of ${formBaseUnit}.`
                            : `= ${formatStock(formStockBase, { unit: formBaseUnit, packUnits: formPackUnits })} (${formStockBase} ${formBaseUnit})`}
                        </span>
                      ) : null}
                    </label>
                    <label className="grid gap-1 text-sm">
                      Low Stock Threshold ({formThresholdUnit.name}, optional)
                      <div className="flex gap-2 [&>input]:min-w-24 [&>input]:flex-1">
                        <Input
                          type="number"
                          min={0}
                          step="any"
                          placeholder="Defaults to 0"
                          value={formState.lowStockThreshold}
                          onChange={(event) =>
                            setFormState((prev) => ({
                              ...prev,
                              lowStockThreshold: event.target.value,
                            }))
                          }
                        />
                        {formCostUnitOptions.length > 1 ? (
                          <Select
                            value={formThresholdUnit.name}
                            onValueChange={(value) =>
                              // Converts when the count divides evenly, so
                              // 48 bottles becomes 2 crates.
                              setFormState((prev) => {
                                const next = formCostUnitOptions.find(
                                  (option) => option.name === value
                                )
                                if (!next) return prev
                                const count = Number(prev.lowStockThreshold)
                                const base =
                                  prev.lowStockThreshold.trim() === "" || count === 0
                                    ? null
                                    : toBaseQuantity(count, formThresholdUnit.factor)
                                return {
                                  ...prev,
                                  thresholdUnit: next.name,
                                  lowStockThreshold:
                                    base !== null && base % next.factor === 0
                                      ? String(base / next.factor)
                                      : prev.lowStockThreshold,
                                }
                              })
                            }
                          >
                            <SelectTrigger className="w-36 shrink-0">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {formCostUnitOptions.map((option) => (
                                <SelectItem key={option.name} value={option.name}>
                                  {describeUnit(option, formBaseUnit)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : null}
                      </div>
                      {formThresholdUnit.factor > 1 &&
                      formState.lowStockThreshold.trim() !== "" ? (
                        <span
                          className={`text-xs ${
                            formThresholdBase === null
                              ? "text-destructive"
                              : "text-muted-foreground"
                          }`}
                        >
                          {formThresholdBase === null
                            ? `Not a whole number of ${formBaseUnit}.`
                            : `= ${formThresholdBase} ${formBaseUnit}`}
                        </span>
                      ) : null}
                    </label>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="grid gap-1 text-sm">
                      Cost Price (per {formCostUnit.name})
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        placeholder="e.g. 12000"
                        value={formState.costPrice}
                        onChange={(event) =>
                          setFormState((prev) => ({
                            ...prev,
                            costPrice: event.target.value,
                          }))
                        }
                      />
                    </label>
                    {formCostUnitOptions.length > 1 ? (
                      <label className="grid gap-1 text-sm">
                        Cost entered per
                        <Select
                          value={formCostUnit.name}
                          onValueChange={(value) =>
                            // Keeps the same total value: 12,000 per crate
                            // becomes 500 per bottle, not 12,000 per bottle.
                            setFormState((prev) => {
                              const next = formCostUnitOptions.find(
                                (option) => option.name === value
                              )
                              const entered = Number(prev.costPrice)
                              if (!next) return prev
                              return {
                                ...prev,
                                costUnit: next.name,
                                costPrice:
                                  prev.costPrice.trim() === "" ||
                                  !Number.isFinite(entered)
                                    ? prev.costPrice
                                    : String(
                                        roundMoney(
                                          (entered / formCostUnit.factor) *
                                            next.factor
                                        )
                                      ),
                              }
                            })
                          }
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {formCostUnitOptions.map((option) => (
                              <SelectItem key={option.name} value={option.name}>
                                {describeUnit(option, formBaseUnit)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </label>
                    ) : null}
                  </div>
                  {formCostUnit.factor > 1 ? (
                    // Calculated from the package cost as it is typed; the
                    // value saved is this per-base-unit cost.
                    <div className="grid gap-1 rounded-lg border border-border/80 bg-muted/40 px-3 py-2 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-muted-foreground">
                          Cost per {formBaseUnit} (calculated)
                        </span>
                        <span className="font-semibold text-foreground">
                          {hasFormCost ? formatCurrency(costValue) : "-"}
                        </span>
                      </div>
                      {formCostUnitOptions
                        .filter(
                          (option) =>
                            !option.isBase && option.name !== formCostUnit.name
                        )
                        .map((option) => (
                          <div
                            key={option.name}
                            className="flex items-center justify-between gap-2 text-xs"
                          >
                            <span className="text-muted-foreground">
                              Cost per {option.name}
                            </span>
                            <span className="text-foreground">
                              {hasFormCost
                                ? formatCurrency(costValue * option.factor)
                                : "-"}
                            </span>
                          </div>
                        ))}
                    </div>
                  ) : null}
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
                      Selling Price (per {formState.unit.trim() || "base unit"})
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
                        <span className="text-xs text-warning">
                          Warning: selling price is below cost price.
                        </span>
                      ) : null}
                    </label>
                  </div>
                  {/* Package units are offered only where the store sells in them. */}
                  {packUnitsEnabled ? (
                    <div className="grid gap-2 rounded-lg border border-border/80 bg-muted/40 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium">Package units</p>
                          <p className="text-xs text-muted-foreground">
                            Bought or sold by the crate, box, or sack? Add it here
                            with how many {formState.unit.trim() || "base units"}{" "}
                            it holds and its own selling price.
                          </p>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={formState.packUnits.length >= 10}
                          onClick={() =>
                            setFormState((prev) => ({
                              ...prev,
                              packUnits: [
                                ...prev.packUnits,
                                { name: "", factor: "", price: "" },
                              ],
                            }))
                          }
                        >
                          Add unit
                        </Button>
                      </div>
                      {formState.packUnits.map((row, rowIndex) => (
                        <div
                          key={rowIndex}
                          className="grid grid-cols-[1fr_1fr_1fr_auto] items-end gap-2"
                        >
                          <label className="grid gap-1 text-xs">
                            Unit
                            <Input
                              placeholder="crate"
                              list="product-unit-suggestions"
                              value={row.name}
                              onChange={(event) =>
                                setPackUnitRow(rowIndex, "name", event.target.value)
                              }
                            />
                          </label>
                          <label className="grid gap-1 text-xs">
                            {formState.unit.trim() || "Base units"} in it
                            <Input
                              type="number"
                              min={2}
                              step={1}
                              placeholder="24"
                              value={row.factor}
                              onChange={(event) =>
                                setPackUnitRow(rowIndex, "factor", event.target.value)
                              }
                            />
                          </label>
                          <label className="grid gap-1 text-xs">
                            Selling price
                            <Input
                              type="number"
                              min={0}
                              step="0.01"
                              placeholder="13500"
                              value={row.price}
                              onChange={(event) =>
                                setPackUnitRow(rowIndex, "price", event.target.value)
                              }
                            />
                          </label>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              setFormState((prev) => ({
                                ...prev,
                                packUnits: prev.packUnits.filter(
                                  (_, index) => index !== rowIndex
                                ),
                              }))
                            }
                          >
                            Remove
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : null}
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
        <DialogContent className="sm:max-w-lg">
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
            {receiveProduct && (receiveProduct.packUnits?.length ?? 0) > 0 ? (
              <label className="grid gap-1 text-sm">
                Received in
                <Select
                  value={receiveUnit?.name ?? receiveProduct.unit}
                  onValueChange={(value) =>
                    // The cost follows the unit: 24,000 per crate of 24
                    // becomes 1,000 per bottle.
                    setReceiveForm((prev) => {
                      const current = findUnitOption(receiveProduct, prev.unit)
                      const next = findUnitOption(receiveProduct, value)
                      const entered = Number(prev.unitCost)
                      if (!current || !next) return prev
                      return {
                        ...prev,
                        unit: next.name,
                        unitCost:
                          prev.unitCost.trim() === "" || !Number.isFinite(entered)
                            ? prev.unitCost
                            : String(
                                roundMoney((entered / current.factor) * next.factor)
                              ),
                      }
                    })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {getUnitOptions(receiveProduct).map((option) => (
                      <SelectItem key={option.name} value={option.name}>
                        {describeUnit(option, receiveProduct.unit)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1 text-sm">
                Quantity ({receiveUnit?.name ?? receiveProduct?.unit ?? "pcs"})
                <Input
                  type="number"
                  min={0}
                  step="any"
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
                Cost per {receiveUnit?.name ?? receiveProduct?.unit ?? "unit"}{" "}
                (supplier price)
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="Price on the supplier invoice"
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
            {receiveProduct && (receiveProduct.packUnits?.length ?? 0) > 0 ? (
              <div className="grid gap-1 rounded-lg border border-border/80 bg-muted/40 px-4 py-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">
                    In stock
                  </span>
                  <span className="font-medium text-foreground">
                    {formatStock(receiveProduct.quantity, receiveProduct)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">
                    New cost per {receiveProduct.unit} after receiving
                  </span>
                  <span className="font-semibold text-foreground">
                    {receiveCostPreview === null
                      ? "-"
                      : formatCurrency(receiveCostPreview)}
                  </span>
                </div>
              </div>
            ) : null}
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
      <ProductMonitorDialog
        product={monitorProduct}
        open={monitorOpen}
        onOpenChange={(open) => {
          setMonitorOpen(open)
          if (!open) setMonitorProduct(null)
        }}
      />
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
                    <span>{formatStock(product.quantity, product)}</span>
                    {product.quantity <= (product.lowStockThreshold ?? 0) ? (
                      <span className="rounded-md bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
                        Low
                      </span>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="grid gap-0.5">
                    <span>{product.unit ?? "pcs"}</span>
                    {(product.packUnits ?? []).map((pack) => (
                      <span
                        key={pack.name}
                        className="text-xs text-muted-foreground"
                      >
                        {pack.name} = {pack.factor} {product.unit} ·{" "}
                        {formatCurrency(pack.price)}
                      </span>
                    ))}
                  </div>
                </TableCell>
                <TableCell>
                  {formatStock(product.lowStockThreshold ?? 0, product)}
                </TableCell>
                <TableCell>
                  {formatCurrency(
                    (product.costPrice ?? 0) * getCostUnit(product).factor
                  )}
                  {(product.packUnits?.length ?? 0) > 0 ? (
                    <span className="text-xs text-muted-foreground">
                      {" "}
                      / {getCostUnit(product).name}
                    </span>
                  ) : null}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span>{formatCurrency(product.price)}</span>
                    {product.price < (product.costPrice ?? 0) ||
                    (product.packUnits ?? []).some(
                      (pack) => pack.price < (product.costPrice ?? 0) * pack.factor
                    ) ? (
                      <span className="rounded-md bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning">
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
                        onClick={() => openMonitor(product)}
                      >
                        <Activity className="size-4" />
                        Monitor
                      </Button>
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
                        onClick={() => {
                          setDeleteError(null)
                          setDeleteTarget(product._id)
                        }}
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

      <PasswordConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open && !submitting) {
            setDeleteTarget(null)
            setDeleteError(null)
          }
        }}
        title="Delete product?"
        description="This removes the product from the catalogue and from branch inventory."
        confirmLabel="Delete Product"
        pendingLabel="Deleting..."
        pending={submitting}
        error={deleteError}
        onConfirm={handleDelete}
      />
    </div>
  )
}
