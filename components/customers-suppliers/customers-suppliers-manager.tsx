"use client"

// Shows customer purchase history and supplier receipt history.
import Link from "next/link"
import { useMemo, useState } from "react"
import { ShoppingCart } from "lucide-react"
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
import { formatCurrency } from "@/lib/utils/format"
import { cn } from "@/lib/utils"

type CustomerSale = {
  _id: string
  createdAtLabel: string
  items: string
  totalAmount: number
  paymentStatus: "paid" | "unpaid"
}

type CustomerSummary = {
  id: string
  name: string
  phone: string
  totalPurchases: number
  salesCount: number
  purchases: CustomerSale[]
}

type SupplierReceipt = {
  _id: string
  receivedAtLabel: string
  productName: string
  sku: string
  quantity: number
  unit: string
  unitCost: number
  totalCost: number
}

type SupplierSummary = {
  id: string
  name: string
  phone: string
  totalSupplied: number
  receiptsCount: number
  receipts: SupplierReceipt[]
}

type ActiveTab = "customers" | "suppliers"

function buildSaleHref(customer: CustomerSummary) {
  const params = new URLSearchParams({
    customerName: customer.name,
  })
  if (customer.phone) params.set("customerPhone", customer.phone)
  return `/sales?${params.toString()}`
}

export function CustomersSuppliersManager({
  customers,
  suppliers,
}: {
  customers: CustomerSummary[]
  suppliers: SupplierSummary[]
}) {
  const [activeTab, setActiveTab] = useState<ActiveTab>("customers")
  const [activeCustomerId, setActiveCustomerId] = useState("")
  const [activeSupplierId, setActiveSupplierId] = useState("")
  const [customerSearch, setCustomerSearch] = useState("")
  const [supplierSearch, setSupplierSearch] = useState("")

  const activeCustomer = useMemo(
    () =>
      customers.find((customer) => customer.id === activeCustomerId) ?? null,
    [activeCustomerId, customers]
  )
  const activeSupplier = useMemo(
    () =>
      suppliers.find((supplier) => supplier.id === activeSupplierId) ?? null,
    [activeSupplierId, suppliers]
  )
  const filteredCustomers = useMemo(() => {
    const query = customerSearch.trim().toLowerCase()
    if (!query) return customers
    return customers.filter((customer) =>
      `${customer.name} ${customer.phone}`.toLowerCase().includes(query)
    )
  }, [customerSearch, customers])
  const filteredSuppliers = useMemo(() => {
    const query = supplierSearch.trim().toLowerCase()
    if (!query) return suppliers
    return suppliers.filter((supplier) =>
      `${supplier.name} ${supplier.phone}`.toLowerCase().includes(query)
    )
  }, [supplierSearch, suppliers])

  const tabs: Array<{ value: ActiveTab; label: string }> = [
    { value: "customers", label: "Customers" },
    { value: "suppliers", label: "Suppliers" },
  ]

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Relationships
        </p>
        <h2 className="text-2xl font-semibold">Customers / Suppliers</h2>
      </div>

      <div className="rounded-lg border border-border bg-muted/40 p-1">
        <div className="grid grid-cols-2 gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setActiveTab(tab.value)}
              className={cn(
                "min-h-12 rounded-md px-4 py-3 text-base font-semibold text-muted-foreground transition hover:bg-background/70 hover:text-foreground",
                activeTab === tab.value &&
                  "bg-primary text-primary-foreground shadow-sm"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "customers" ? (
        <div
          className={cn(
            "grid gap-4",
            activeCustomer && "xl:grid-cols-[0.9fr_1.4fr]"
          )}
        >
          <section
            className={cn(
              "space-y-3",
              activeCustomer && "xl:border-r-2 xl:border-primary/60 xl:pr-4"
            )}
          >
            <h3 className="text-lg font-semibold">Customers</h3>
            <Input
              aria-label="Search customers by name or phone"
              value={customerSearch}
              onChange={(event) => setCustomerSearch(event.target.value)}
              placeholder="Search by name or phone"
            />
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Sales</TableHead>
                  <TableHead>Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-muted-foreground">
                      No customers recorded yet.
                    </TableCell>
                  </TableRow>
                ) : filteredCustomers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-muted-foreground">
                      No customers match your search.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredCustomers.map((customer, customerIndex) => (
                    <TableRow
                      key={customer.id}
                      className={cn(
                        customerIndex % 2 === 1 &&
                          "bg-muted/60 hover:bg-muted/70",
                        activeCustomer?.id === customer.id &&
                          "bg-primary text-primary-foreground hover:bg-primary/90"
                      )}
                      onClick={() => setActiveCustomerId(customer.id)}
                    >
                      <TableCell className="font-medium">
                        {customer.name}
                      </TableCell>
                      <TableCell>{customer.phone || "-"}</TableCell>
                      <TableCell>{customer.salesCount}</TableCell>
                      <TableCell>
                        {formatCurrency(customer.totalPurchases)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </section>

          {activeCustomer ? (
            <section className="space-y-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-lg font-semibold">
                    {activeCustomer.name}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {activeCustomer.phone || "No phone recorded"}
                  </p>
                </div>
                <Button asChild>
                  <Link href={buildSaleHref(activeCustomer)}>
                    <ShoppingCart className="size-4" />
                    Sell to customer
                  </Link>
                </Button>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeCustomer.purchases.map((purchase, purchaseIndex) => (
                    <TableRow
                      key={purchase._id}
                      className={
                        purchaseIndex % 2 === 1
                          ? "bg-muted/60 hover:bg-muted/70"
                          : undefined
                      }
                    >
                      <TableCell>{purchase.createdAtLabel}</TableCell>
                      <TableCell className="whitespace-normal">
                        {purchase.items}
                      </TableCell>
                      <TableCell className="capitalize">
                        {purchase.paymentStatus}
                      </TableCell>
                      <TableCell>{formatCurrency(purchase.totalAmount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </section>
          ) : null}
        </div>
      ) : (
        <div
          className={cn(
            "grid gap-4",
            activeSupplier && "xl:grid-cols-[0.9fr_1.4fr]"
          )}
        >
          <section
            className={cn(
              "space-y-3",
              activeSupplier && "xl:border-r-2 xl:border-primary/60 xl:pr-4"
            )}
          >
            <h3 className="text-lg font-semibold">Suppliers</h3>
            <Input
              aria-label="Search suppliers by name or phone"
              value={supplierSearch}
              onChange={(event) => setSupplierSearch(event.target.value)}
              placeholder="Search by name or phone"
            />
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Receipts</TableHead>
                  <TableHead>Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {suppliers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-muted-foreground">
                      No suppliers recorded yet.
                    </TableCell>
                  </TableRow>
                ) : filteredSuppliers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-muted-foreground">
                      No suppliers match your search.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredSuppliers.map((supplier, supplierIndex) => (
                    <TableRow
                      key={supplier.id}
                      className={cn(
                        supplierIndex % 2 === 1 &&
                          "bg-muted/60 hover:bg-muted/70",
                        activeSupplier?.id === supplier.id &&
                          "bg-primary text-primary-foreground hover:bg-primary/90"
                      )}
                      onClick={() => setActiveSupplierId(supplier.id)}
                    >
                      <TableCell className="font-medium">
                        {supplier.name}
                      </TableCell>
                      <TableCell>{supplier.phone}</TableCell>
                      <TableCell>{supplier.receiptsCount}</TableCell>
                      <TableCell>{formatCurrency(supplier.totalSupplied)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </section>

          {activeSupplier ? (
            <section className="space-y-3">
              <div>
                <h3 className="text-lg font-semibold">
                  {activeSupplier.name}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {activeSupplier.phone}
                </p>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Unit Cost</TableHead>
                    <TableHead>Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeSupplier.receipts.map((receipt, receiptIndex) => (
                    <TableRow
                      key={receipt._id}
                      className={
                        receiptIndex % 2 === 1
                          ? "bg-muted/60 hover:bg-muted/70"
                          : undefined
                      }
                    >
                      <TableCell>{receipt.receivedAtLabel}</TableCell>
                      <TableCell>
                        <p className="font-medium">{receipt.productName}</p>
                        <p className="text-xs text-muted-foreground">
                          {receipt.sku}
                        </p>
                      </TableCell>
                      <TableCell>
                        {receipt.quantity} {receipt.unit}
                      </TableCell>
                      <TableCell>{formatCurrency(receipt.unitCost)}</TableCell>
                      <TableCell>{formatCurrency(receipt.totalCost)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </section>
          ) : null}
        </div>
      )}
    </div>
  )
}
