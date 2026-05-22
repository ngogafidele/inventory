import { redirect } from "next/navigation"
import { connection } from "next/server"
import { getCurrentStore, requireServerSession } from "@/lib/auth/server"
import { connectToDatabase } from "@/lib/db/connection"
import { Invoice } from "@/lib/db/models/Invoice"
import { Product } from "@/lib/db/models/Product"
import { ReturnModel } from "@/lib/db/models/Return"
import { Sale } from "@/lib/db/models/Sale"
import { StockAdjustment } from "@/lib/db/models/StockAdjustment"
import { Expense } from "@/lib/db/models/Expense"
import { STORE_LABELS } from "@/lib/utils/constants"
import { formatCurrency } from "@/lib/utils/format"
import {
  formatInKigali,
  formatKigaliDateInput,
  getKigaliDateParts,
  parseKigaliDateInput,
} from "@/lib/utils/time"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ReportPrintButton } from "@/components/reports/report-print-button"
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
  inventoryCost: number
  inventoryRetail: number
  sales: number
  revenue: number
  costOfSales: number
  expenses: number
  profit: number
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

type ReturnTotals = {
  _id: StoreKey
  revenue: number
  grossProfit: number
}

type ProductTotals = {
  _id: StoreKey
  products: number
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

type ExpenseTotals = {
  _id: StoreKey
  expenses: number
}

type OutstandingSaleTotals = {
  _id: StoreKey
  outstanding: number
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

type ReturnedProductTotals = {
  sku: string
  name: string
  unit: string
  returnedQuantity: number
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

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value)
}

function formatDateTime(date: Date | undefined) {
  if (!date) return "-"

  return formatInKigali(date, {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function getSingleParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function formatDateInput(date: Date) {
  return formatKigaliDateInput(date)
}

function parseDateInput(value: string | undefined) {
  return parseKigaliDateInput(value)
}

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

function getReportRange(params: Awaited<SearchParams>) {
  const now = new Date()
  const nowParts = getKigaliDateParts(now)
  const todayInput = `${nowParts.year}-${String(nowParts.month).padStart(2, "0")}-${String(
    nowParts.day
  ).padStart(2, "0")}`
  const monthStartInput = `${nowParts.year}-${String(nowParts.month).padStart(2, "0")}-01`
  const today = parseKigaliDateInput(todayInput) ?? now
  const monthStart = parseKigaliDateInput(monthStartInput) ?? today

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
  return formatInKigali(date, {
    month: "short",
    day: "2-digit",
    year: "numeric",
  })
}

function sumReports(reports: StoreReport[]) {
  return reports.reduce(
    (total, report) => ({
      products: total.products + report.products,
      inventoryCost: total.inventoryCost + report.inventoryCost,
      inventoryRetail: total.inventoryRetail + report.inventoryRetail,
      sales: total.sales + report.sales,
      revenue: total.revenue + report.revenue,
      costOfSales: total.costOfSales + report.costOfSales,
      expenses: total.expenses + report.expenses,
      profit: total.profit + report.profit,
      invoices: total.invoices + report.invoices,
      unpaidInvoices: total.unpaidInvoices + report.unpaidInvoices,
      outstanding: total.outstanding + report.outstanding,
      adjustments: total.adjustments + report.adjustments,
    }),
    {
      products: 0,
      inventoryCost: 0,
      inventoryRetail: 0,
      sales: 0,
      revenue: 0,
      costOfSales: 0,
      expenses: 0,
      profit: 0,
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
    returnTotals,
    invoiceTotals,
    adjustmentTotals,
    expenseTotals,
    outstandingSalesTotals,
    topMovingProducts,
    returnedProductTotals,
    recentSales,
  ] = await Promise.all([
    Product.aggregate<ProductTotals>([
      { $match: { store: currentStore } },
      {
        $group: {
          _id: "$store",
          products: { $sum: 1 },
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
    ReturnModel.aggregate<ReturnTotals>([
      { $match: { store: currentStore, createdAt: periodFilter } },
      { $unwind: "$returnItems" },
      {
        $lookup: {
          from: "products",
          localField: "returnItems.productId",
          foreignField: "_id",
          as: "product",
        },
      },
      { $unwind: { path: "$product", preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: "$store",
          revenue: { $sum: "$returnItems.lineTotal" },
          grossProfit: {
            $sum: {
              $subtract: [
                "$returnItems.lineTotal",
                {
                  $multiply: [
                    {
                      $ifNull: [
                        "$returnItems.basePrice",
                        { $ifNull: ["$product.costPrice", 0] },
                      ],
                    },
                    "$returnItems.quantity",
                  ],
                },
              ],
            },
          },
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
    Expense.aggregate<ExpenseTotals>([
      { $match: { store: currentStore, date: periodFilter } },
      {
        $group: {
          _id: "$store",
          expenses: { $sum: "$amount" },
        },
      },
    ]),
    Sale.aggregate<OutstandingSaleTotals>([
      {
        $match: {
          store: currentStore,
          createdAt: periodFilter,
          paymentStatus: "unpaid",
        },
      },
      {
        $group: {
          _id: "$store",
          outstanding: { $sum: "$totalAmount" },
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
    ReturnModel.aggregate<ReturnedProductTotals>([
      { $match: { store: currentStore, createdAt: periodFilter } },
      { $unwind: "$returnItems" },
      {
        $lookup: {
          from: "products",
          localField: "returnItems.productId",
          foreignField: "_id",
          as: "product",
        },
      },
      { $unwind: { path: "$product", preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: {
            sku: "$returnItems.sku",
            name: "$returnItems.name",
            unit: "$returnItems.unit",
          },
          returnedQuantity: { $sum: "$returnItems.quantity" },
          revenue: { $sum: "$returnItems.lineTotal" },
          grossProfit: {
            $sum: {
              $subtract: [
                "$returnItems.lineTotal",
                {
                  $multiply: [
                    {
                      $ifNull: [
                        "$returnItems.basePrice",
                        { $ifNull: ["$product.costPrice", 0] },
                      ],
                    },
                    "$returnItems.quantity",
                  ],
                },
              ],
            },
          },
        },
      },
      {
        $project: {
          _id: 0,
          sku: "$_id.sku",
          name: "$_id.name",
          unit: "$_id.unit",
          returnedQuantity: 1,
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
  const returnMap = new Map(returnTotals.map((item) => [item._id, item]))
  const invoiceMap = new Map(invoiceTotals.map((item) => [item._id, item]))
  const adjustmentMap = new Map(
    adjustmentTotals.map((item) => [item._id, item])
  )
  const expenseMap = new Map(expenseTotals.map((item) => [item._id, item]))
  const outstandingSalesMap = new Map(
    outstandingSalesTotals.map((item) => [item._id, item])
  )

  const storeReports = [currentStore].map((store) => {
    const products = productMap.get(store)
    const sales = saleMap.get(store)
    const returns = returnMap.get(store)
    const invoices = invoiceMap.get(store)
    const adjustments = adjustmentMap.get(store)
    const expenses = expenseMap.get(store)
    const outstandingSales = outstandingSalesMap.get(store)

    const grossProfit = (sales?.grossProfit ?? 0) - (returns?.grossProfit ?? 0)
    const netRevenue = (sales?.revenue ?? 0) - (returns?.revenue ?? 0)
    const costOfSales = netRevenue - grossProfit
    const expenseTotal = expenses?.expenses ?? 0

    return {
      store,
      products: products?.products ?? 0,
      inventoryCost: products?.inventoryCost ?? 0,
      inventoryRetail: products?.inventoryRetail ?? 0,
      sales: sales?.sales ?? 0,
      revenue: netRevenue,
      costOfSales,
      expenses: expenseTotal,
      profit: grossProfit - expenseTotal,
      invoices: invoices?.invoices ?? 0,
      unpaidInvoices: invoices?.unpaidInvoices ?? 0,
      outstanding: outstandingSales?.outstanding ?? 0,
      adjustments: adjustments?.adjustments ?? 0,
    } satisfies StoreReport
  })

  const totals = sumReports(storeReports)
  const topMovingMap = new Map(
    topMovingProducts.map((product) => [product.sku, { ...product }])
  )
  returnedProductTotals.forEach((returnedProduct) => {
    const current = topMovingMap.get(returnedProduct.sku)
    if (current) {
      current.soldQuantity -= returnedProduct.returnedQuantity
      current.revenue -= returnedProduct.revenue
      current.grossProfit -= returnedProduct.grossProfit
      return
    }

    topMovingMap.set(returnedProduct.sku, {
      sku: returnedProduct.sku,
      name: returnedProduct.name,
      unit: returnedProduct.unit,
      soldQuantity: -returnedProduct.returnedQuantity,
      revenue: -returnedProduct.revenue,
      grossProfit: -returnedProduct.grossProfit,
    })
  })
  const netTopMovingProducts = Array.from(topMovingMap.values())
    .filter((product) => product.soldQuantity !== 0 || product.revenue !== 0)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 8)
  const fromLabel = formatDateOnly(range.from)
  const toLabel = formatDateOnly(range.to)
  const cards = [
    {
      label: "Total Revenue",
      value: formatCurrency(totals.revenue),
      className: "border-emerald-200 bg-emerald-50 text-emerald-950",
    },
    {
      label: "Cost of Sales",
      value: formatCurrency(totals.costOfSales),
      className: "border-sky-200 bg-sky-50 text-sky-950",
    },
    {
      label: "Expenses",
      value: formatCurrency(totals.expenses),
      className: "border-rose-200 bg-rose-50 text-rose-950",
    },
    {
      label: "Profit",
      value: formatCurrency(totals.profit),
      className:
        totals.profit >= 0
          ? "border-teal-200 bg-teal-50 text-teal-950"
          : "border-amber-200 bg-amber-50 text-amber-950",
    },
    {
      label: "Inventory Cost",
      value: formatCurrency(totals.inventoryCost),
      className: "border-indigo-200 bg-indigo-50 text-indigo-950",
    },
    {
      label: "Inventory Retail",
      value: formatCurrency(totals.inventoryRetail),
      className: "border-cyan-200 bg-cyan-50 text-cyan-950",
    },
    {
      label: "Sales Records",
      value: formatNumber(totals.sales),
      className: "border-violet-200 bg-violet-50 text-violet-950",
    },
    {
      label: "Products",
      value: formatNumber(totals.products),
      className: "border-lime-200 bg-lime-50 text-lime-950",
    },
    {
      label: "Outstanding",
      value: formatCurrency(totals.outstanding),
      className:
        totals.outstanding > 0
          ? "border-orange-200 bg-orange-50 text-orange-950"
          : "border-slate-200 bg-slate-50 text-slate-950",
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          {STORE_LABELS[currentStore]} Overview
        </p>
        <h2 className="text-2xl font-semibold">Reports</h2>
        <p className="text-sm text-muted-foreground">
          Reports for {STORE_LABELS[currentStore]} from {fromLabel} to{" "}
          {toLabel}.
        </p>
      </div>

      <form
        action="/reports"
        className="grid gap-3 rounded-2xl border border-border/80 bg-card p-4 shadow-sm md:grid-cols-[1fr_1fr_auto_auto]"
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
        <div className="flex items-end">
          <ReportPrintButton />
        </div>
      </form>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <div
            key={card.label}
            className={`rounded-2xl border p-4 shadow-sm ${card.className}`}
          >
            <p className="text-xs uppercase tracking-[0.16em] opacity-70">
              {card.label}
            </p>
            <p className="mt-2 text-2xl font-semibold">
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
            {STORE_LABELS[currentStore]} Performance
          </h3>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Store</TableHead>
              <TableHead>Revenue</TableHead>
              <TableHead>Expenses</TableHead>
              <TableHead>Profit</TableHead>
              <TableHead>Sales</TableHead>
              <TableHead>Products</TableHead>
              <TableHead>Outstanding</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {storeReports.map((report) => (
              <TableRow key={report.store}>
                <TableCell>{STORE_LABELS[report.store]}</TableCell>
                <TableCell>{formatCurrency(report.revenue)}</TableCell>
                <TableCell>{formatCurrency(report.expenses)}</TableCell>
                <TableCell>{formatCurrency(report.profit)}</TableCell>
                <TableCell>{formatNumber(report.sales)}</TableCell>
                <TableCell>{formatNumber(report.products)}</TableCell>
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
              {netTopMovingProducts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground">
                    No sales movement yet.
                  </TableCell>
                </TableRow>
              ) : (
                netTopMovingProducts.map((product) => (
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
                    <TableCell>{STORE_LABELS[sale.store]}</TableCell>
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
