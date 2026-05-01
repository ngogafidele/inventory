import { redirect } from "next/navigation"
import { connection } from "next/server"
import { getCurrentStore, requireServerSession } from "@/lib/auth/server"
import { connectToDatabase } from "@/lib/db/connection"
import { Invoice } from "@/lib/db/models/Invoice"
import { Product } from "@/lib/db/models/Product"
import { Sale } from "@/lib/db/models/Sale"
import { StockAdjustment } from "@/lib/db/models/StockAdjustment"
import { formatCurrency } from "@/lib/utils/format"
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

type StoreKey = "store1" | "store2"

type StoreReport = {
  store: StoreKey
  products: number
  lowStock: number
  inventoryCost: number
  inventoryRetail: number
  sales: number
  revenue: number
  grossProfit: number
  invoices: number
  unpaidInvoices: number
  outstanding: number
  adjustments: number
}

type SaleTotals = {
  _id: StoreKey
  sales: number
  revenue: number
  grossProfit: number
  unitsSold: number
}

type ProductTotals = {
  _id: StoreKey
  products: number
  lowStock: number
  inventoryCost: number
  inventoryRetail: number
}

type InvoiceTotals = {
  _id: StoreKey
  invoices: number
  unpaidInvoices: number
  outstanding: number
}

type AdjustmentTotals = {
  _id: StoreKey
  adjustments: number
}

type SearchParams = Promise<{
  from?: string | string[]
  to?: string | string[]
}>

type TopMovingProduct = {
  sku: string
  name: string
  unit: string
  soldQuantity: number
  revenue: number
  grossProfit: number
}

type RecentSale = {
  _id: string
  store: StoreKey
  createdAt?: Date
  totalAmount: number
  items: Array<{
    name: string
    sku: string
    unit: string
    quantity: number
  }>
}

const storeLabels: Record<StoreKey, string> = {
  store1: "Store 1",
  store2: "Store 2",
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value)
}

function formatDateTime(date: Date | undefined) {
  if (!date) return "-"

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}

function getSingleParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function formatDateInput(date: Date) {
  return date.toISOString().slice(0, 10)
}

function parseDateInput(value: string | undefined) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null
  }

  const date = new Date(`${value}T00:00:00.000Z`)
  return Number.isNaN(date.getTime()) ? null : date
}

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

function getReportRange(params: Awaited<SearchParams>) {
  const now = new Date()
  const today = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  )
  const monthStart = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)
  )

  const rawFrom = getSingleParam(params.from)
  const rawTo = getSingleParam(params.to)
  const parsedFrom = parseDateInput(rawFrom)
  const parsedTo = parseDateInput(rawTo)

  let from = parsedFrom ?? monthStart
  let to = parsedTo ?? today

  if (from > to) {
    const earlierDate = to
    to = from
    from = earlierDate
  }

  return {
    from,
    to,
    endExclusive: addDays(to, 1),
    fromInput: formatDateInput(from),
    toInput: formatDateInput(to),
  }
}

function formatDateOnly(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  }).format(date)
}

function sumReports(reports: StoreReport[]) {
  return reports.reduce(
    (total, report) => ({
      products: total.products + report.products,
      lowStock: total.lowStock + report.lowStock,
      inventoryCost: total.inventoryCost + report.inventoryCost,
      inventoryRetail: total.inventoryRetail + report.inventoryRetail,
      sales: total.sales + report.sales,
      revenue: total.revenue + report.revenue,
      grossProfit: total.grossProfit + report.grossProfit,
      invoices: total.invoices + report.invoices,
      unpaidInvoices: total.unpaidInvoices + report.unpaidInvoices,
      outstanding: total.outstanding + report.outstanding,
      adjustments: total.adjustments + report.adjustments,
    }),
    {
      products: 0,
      lowStock: 0,
      inventoryCost: 0,
      inventoryRetail: 0,
      sales: 0,
      revenue: 0,
      grossProfit: 0,
      invoices: 0,
      unpaidInvoices: 0,
      outstanding: 0,
      adjustments: 0,
    }
  )
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  await connection()
  const session = await requireServerSession()
  if (!session.isAdmin) {
    redirect("/sales")
  }

  const currentStore = getCurrentStore(session)
  const range = getReportRange(await searchParams)
  const periodFilter = {
    $gte: range.from,
    $lt: range.endExclusive,
  }

  await connectToDatabase()

  const [
    productTotals,
    saleTotals,
    invoiceTotals,
    adjustmentTotals,
    topMovingProducts,
    recentSales,
  ] = await Promise.all([
    Product.aggregate<ProductTotals>([
      { $match: { store: currentStore } },
      {
        $group: {
          _id: "$store",
          products: { $sum: 1 },
          lowStock: {
            $sum: {
              $cond: [
                { $lte: ["$quantity", { $ifNull: ["$lowStockThreshold", 0] }] },
                1,
                0,
              ],
            },
          },
          inventoryCost: {
            $sum: { $multiply: ["$quantity", "$costPrice"] },
          },
          inventoryRetail: {
            $sum: { $multiply: ["$quantity", "$price"] },
          },
        },
      },
    ]),
    Sale.aggregate<SaleTotals>([
      { $match: { store: currentStore, createdAt: periodFilter } },
      { $unwind: { path: "$items", preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: "$store",
          saleIds: { $addToSet: "$_id" },
          revenue: { $sum: "$items.lineTotal" },
          unitsSold: { $sum: "$items.quantity" },
          grossProfit: {
            $sum: {
              $subtract: [
                "$items.lineTotal",
                { $multiply: ["$items.basePrice", "$items.quantity"] },
              ],
            },
          },
        },
      },
      {
        $project: {
          sales: { $size: "$saleIds" },
          revenue: 1,
          grossProfit: 1,
          unitsSold: 1,
        },
      },
    ]),
    Invoice.aggregate<InvoiceTotals>([
      { $match: { store: currentStore, issuedAt: periodFilter } },
      {
        $group: {
          _id: "$store",
          invoices: { $sum: 1 },
          unpaidInvoices: {
            $sum: { $cond: [{ $eq: ["$status", "unpaid"] }, 1, 0] },
          },
          outstanding: {
            $sum: {
              $cond: [{ $eq: ["$status", "unpaid"] }, "$totalAmount", 0],
            },
          },
        },
      },
    ]),
    StockAdjustment.aggregate<AdjustmentTotals>([
      { $match: { store: currentStore, createdAt: periodFilter } },
      {
        $group: {
          _id: "$store",
          adjustments: { $sum: 1 },
        },
      },
    ]),
    Sale.aggregate<TopMovingProduct>([
      { $match: { store: currentStore, createdAt: periodFilter } },
      { $unwind: "$items" },
      {
        $group: {
          _id: {
            sku: "$items.sku",
            name: "$items.name",
            unit: "$items.unit",
          },
          soldQuantity: { $sum: "$items.quantity" },
          revenue: { $sum: "$items.lineTotal" },
          grossProfit: {
            $sum: {
              $subtract: [
                "$items.lineTotal",
                { $multiply: ["$items.basePrice", "$items.quantity"] },
              ],
            },
          },
        },
      },
      { $sort: { revenue: -1 } },
      { $limit: 8 },
      {
        $project: {
          _id: 0,
          sku: "$_id.sku",
          name: "$_id.name",
          unit: "$_id.unit",
          soldQuantity: 1,
          revenue: 1,
          grossProfit: 1,
        },
      },
    ]),
    Sale.find({ store: currentStore, createdAt: periodFilter })
      .select("store items totalAmount createdAt")
      .sort({ createdAt: -1 })
      .limit(8)
      .lean<RecentSale[]>(),
  ])

  const productMap = new Map(productTotals.map((item) => [item._id, item]))
  const saleMap = new Map(saleTotals.map((item) => [item._id, item]))
  const invoiceMap = new Map(invoiceTotals.map((item) => [item._id, item]))
  const adjustmentMap = new Map(
    adjustmentTotals.map((item) => [item._id, item])
  )

  const storeReports = [currentStore].map((store) => {
    const products = productMap.get(store)
    const sales = saleMap.get(store)
    const invoices = invoiceMap.get(store)
    const adjustments = adjustmentMap.get(store)

    return {
      store,
      products: products?.products ?? 0,
      lowStock: products?.lowStock ?? 0,
      inventoryCost: products?.inventoryCost ?? 0,
      inventoryRetail: products?.inventoryRetail ?? 0,
      sales: sales?.sales ?? 0,
      revenue: sales?.revenue ?? 0,
      grossProfit: sales?.grossProfit ?? 0,
      invoices: invoices?.invoices ?? 0,
      unpaidInvoices: invoices?.unpaidInvoices ?? 0,
      outstanding: invoices?.outstanding ?? 0,
      adjustments: adjustments?.adjustments ?? 0,
    } satisfies StoreReport
  })

  const totals = sumReports(storeReports)

  const cards = [
    { label: "Total Revenue", value: formatCurrency(totals.revenue) },
    { label: "Gross Profit", value: formatCurrency(totals.grossProfit) },
    { label: "Inventory Cost", value: formatCurrency(totals.inventoryCost) },
    { label: "Inventory Retail", value: formatCurrency(totals.inventoryRetail) },
    { label: "Sales Records", value: formatNumber(totals.sales) },
    { label: "Products", value: formatNumber(totals.products) },
    { label: "Low Stock", value: formatNumber(totals.lowStock) },
    { label: "Outstanding", value: formatCurrency(totals.outstanding) },
  ]

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          {storeLabels[currentStore]} Overview
        </p>
        <h2 className="text-2xl font-semibold">Reports</h2>
        <p className="text-sm text-muted-foreground">
          Reports for {storeLabels[currentStore]} from{" "}
          {formatDateOnly(range.from)} to {formatDateOnly(range.to)}.
        </p>
      </div>

      <form
        action="/reports"
        className="grid gap-3 rounded-2xl border border-border/80 bg-card p-4 shadow-sm md:grid-cols-[1fr_1fr_auto]"
      >
        <label className="grid gap-1 text-sm">
          From
          <Input name="from" type="date" defaultValue={range.fromInput} />
        </label>
        <label className="grid gap-1 text-sm">
          To
          <Input name="to" type="date" defaultValue={range.toInput} />
        </label>
        <div className="flex items-end">
          <Button type="submit" className="w-full md:w-auto">
            Produce Report
          </Button>
        </div>
      </form>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <div
            key={card.label}
            className="rounded-2xl border border-border/80 bg-background/80 p-4 shadow-sm"
          >
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
              {card.label}
            </p>
            <p className="mt-2 text-2xl font-semibold text-foreground">
              {card.value}
            </p>
          </div>
        ))}
      </div>

      <section className="space-y-3 rounded-2xl border border-border/80 bg-card p-4 shadow-sm">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
            Store Summary
          </p>
          <h3 className="text-lg font-semibold">
            {storeLabels[currentStore]} Performance
          </h3>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Store</TableHead>
              <TableHead>Revenue</TableHead>
              <TableHead>Gross Profit</TableHead>
              <TableHead>Sales</TableHead>
              <TableHead>Products</TableHead>
              <TableHead>Low Stock</TableHead>
              <TableHead>Outstanding</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {storeReports.map((report) => (
              <TableRow key={report.store}>
                <TableCell>{storeLabels[report.store]}</TableCell>
                <TableCell>{formatCurrency(report.revenue)}</TableCell>
                <TableCell>{formatCurrency(report.grossProfit)}</TableCell>
                <TableCell>{formatNumber(report.sales)}</TableCell>
                <TableCell>{formatNumber(report.products)}</TableCell>
                <TableCell>{formatNumber(report.lowStock)}</TableCell>
                <TableCell>{formatCurrency(report.outstanding)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="space-y-3 rounded-2xl border border-border/80 bg-card p-4 shadow-sm">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              Product Performance
            </p>
            <h3 className="text-lg font-semibold">Top Moving Products</h3>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Sold</TableHead>
                <TableHead>Revenue</TableHead>
                <TableHead>Profit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {topMovingProducts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground">
                    No sales movement yet.
                  </TableCell>
                </TableRow>
              ) : (
                topMovingProducts.map((product) => (
                  <TableRow key={product.sku}>
                    <TableCell>
                      <p className="font-medium">{product.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {product.sku}
                      </p>
                    </TableCell>
                    <TableCell>
                      {formatNumber(product.soldQuantity)}{" "}
                      {product.unit ?? "pcs"}
                    </TableCell>
                    <TableCell>{formatCurrency(product.revenue)}</TableCell>
                    <TableCell>{formatCurrency(product.grossProfit)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </section>

        <section className="space-y-3 rounded-2xl border border-border/80 bg-card p-4 shadow-sm">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              Sales Activity
            </p>
            <h3 className="text-lg font-semibold">Recent Sales</h3>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Store</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentSales.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground">
                    No sales recorded yet.
                  </TableCell>
                </TableRow>
              ) : (
                recentSales.map((sale) => (
                  <TableRow key={sale._id.toString()}>
                    <TableCell>{formatDateTime(sale.createdAt)}</TableCell>
                    <TableCell>{storeLabels[sale.store]}</TableCell>
                    <TableCell>
                      <span className="whitespace-normal break-words">
                        {sale.items
                          .map((item) => item.name || item.sku)
                          .join(", ")}
                      </span>
                    </TableCell>
                    <TableCell>{formatCurrency(sale.totalAmount)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </section>
      </div>
    </div>
  )
}
