"use client"

// Fetches and presents role-aware metrics for the selected store.
import { useEffect, useState } from "react"
import {
  Banknote,
  Boxes,
  Coins,
  Clock,
  Landmark,
  Package,
  PackageSearch,
  ReceiptText,
  Smartphone,
  TrendingUp,
  Warehouse,
  Wallet,
} from "lucide-react"
import { DashboardSkeleton } from "@/components/dashboard/dashboard-skeleton"
import { formatCurrency } from "@/lib/utils/format"
import { formatInKigali } from "@/lib/utils/time"
import { cn } from "@/lib/utils"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type DashboardStatsProps = {
  store: "store1" | "store2"
  isAdmin: boolean
}

type StatsResponse = {
  productCount?: number
  lowStockCount?: number
  salesCount?: number
  revenue?: number
  salesToday: number
  stockValue?: number
  revenueToday: number
  costOfSalesToday?: number
  loansToday: number
  grossProfitToday?: number
  expensesToday: number
  profitToday?: number
  lowStockProducts?: Array<{
    _id: string
    name: string
    sku: string
    quantity: number
    unit: string
    lowStockThreshold: number
  }>
  recentSales?: Array<{
    _id: string
    createdAt: string
    totalAmount: number
    quantitySold: number
    units: string[]
  }>
  topMoving?: Array<{
    sku: string
    name: string
    unit: string
    soldQuantity: number
    salesValue: number
  }>
  paymentsByMethod: {
    cash: number
    bank: number
    mobile: number
  }
}

const nonAdminCardLabels = new Set([
  "Sales Today",
  "Revenue Today",
  "Today's Loans",
  "Expenses Today",
  "Cash Payments",
  "Bank Payments",
  "Mobile Payments",
])

export function DashboardStats({ store, isAdmin }: DashboardStatsProps) {
  const [stats, setStats] = useState<StatsResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true)
      const response = await fetch(`/api/dashboard/stats?store=${store}`)
      const data = await response.json()
      if (data?.success) {
        setStats(data.data)
      }
      setLoading(false)
    }

    fetchStats()
  }, [store])

  if (loading) {
    return <DashboardSkeleton restricted={!isAdmin} />
  }

  if (!stats) {
    return <p className="text-sm text-muted-foreground">No stats available.</p>
  }

  const profitToday = stats.profitToday ?? 0
  const cards = [
    {
      label: "Products",
      value: stats.productCount ?? 0,
      icon: Boxes,
      className: "border-lime-200 bg-lime-50 text-lime-950",
      iconClassName: "text-lime-700",
      adminOnly: true,
    },
    {
      label: "Total Stock Value",
      value: formatCurrency(stats.stockValue ?? 0),
      icon: Warehouse,
      className: "border-indigo-200 bg-indigo-50 text-indigo-950",
      iconClassName: "text-indigo-700",
      adminOnly: true,
    },
    {
      label: "Sales Today",
      value: stats.salesToday,
      icon: ReceiptText,
      className: "border-violet-200 bg-violet-50 text-violet-950",
      iconClassName: "text-violet-700",
    },
    {
      label: "Revenue Today",
      value: formatCurrency(stats.revenueToday),
      icon: Coins,
      className: "border-emerald-200 bg-emerald-50 text-emerald-950",
      iconClassName: "text-emerald-700",
    },
    {
      label: "Today's Loans",
      value: formatCurrency(stats.loansToday),
      icon: Clock,
      className: "border-orange-200 bg-orange-50 text-orange-950",
      iconClassName: "text-orange-700",
    },
    {
      label: "Cost of Sales",
      value: formatCurrency(stats.costOfSalesToday ?? 0),
      icon: Package,
      className: "border-sky-200 bg-sky-50 text-sky-950",
      iconClassName: "text-sky-700",
      adminOnly: true,
    },
    {
      label: "Expenses Today",
      value: formatCurrency(stats.expensesToday),
      icon: Wallet,
      className: "border-rose-200 bg-rose-50 text-rose-950",
      iconClassName: "text-rose-700",
    },
    {
      label: "Profit Today",
      value: formatCurrency(profitToday),
      icon: TrendingUp,
      className:
        profitToday >= 0
          ? "border-teal-200 bg-teal-50 text-teal-950"
          : "border-amber-200 bg-amber-50 text-amber-950",
      iconClassName: profitToday >= 0 ? "text-teal-700" : "text-amber-700",
      adminOnly: true,
    },
    {
      label: "Cash Payments",
      value: formatCurrency(stats.paymentsByMethod.cash),
      icon: Banknote,
      className: "border-green-200 bg-green-50 text-green-950",
      iconClassName: "text-green-700",
    },
    {
      label: "Bank Payments",
      value: formatCurrency(stats.paymentsByMethod.bank),
      icon: Landmark,
      className: "border-blue-200 bg-blue-50 text-blue-950",
      iconClassName: "text-blue-700",
    },
    {
      label: "Mobile Payments",
      value: formatCurrency(stats.paymentsByMethod.mobile),
      icon: Smartphone,
      className: "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-950",
      iconClassName: "text-fuchsia-700",
    },
  ]
  const visibleCards = isAdmin
    ? cards
    : cards.filter(
        (card) => !card.adminOnly && nonAdminCardLabels.has(card.label)
      )

  return (
    <div className="space-y-14">
      <div className="grid gap-x-5 gap-y-12 md:grid-cols-2 xl:grid-cols-6">
        {visibleCards.map((card) => (
          <div
            key={card.label}
            className={cn("rounded-2xl border p-4 shadow-sm", card.className)}
          >
            <div className="flex items-center justify-between">
              <p className="max-w-36 text-xs uppercase leading-4 tracking-[0.12em] opacity-70">
                {card.label}
              </p>
              <card.icon className={cn("size-4", card.iconClassName)} />
            </div>
            <p className="mt-2 text-2xl font-semibold">{card.value}</p>
          </div>
        ))}
      </div>

      {isAdmin ? (
        <>
          <div className="grid gap-12">
            <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    Sales Activity
                  </p>
                  <h3 className="text-lg font-semibold">Recent Sales</h3>
                </div>
                <ReceiptText className="size-4 text-primary" />
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Quantity Sold</TableHead>
                    <TableHead>Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(stats.recentSales ?? []).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-muted-foreground">
                        No sales recorded yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    (stats.recentSales ?? []).map((sale, saleIndex) => (
                      <TableRow
                        key={sale._id}
                        className={
                          saleIndex % 2 === 1
                            ? "bg-muted/60 hover:bg-muted/70"
                            : undefined
                        }
                      >
                        <TableCell>
                          {formatInKigali(sale.createdAt, {
                            year: "numeric",
                            month: "2-digit",
                            day: "2-digit",
                          })}
                        </TableCell>
                        <TableCell>
                          {sale.quantitySold} {sale.units.join("/")}
                        </TableCell>
                        <TableCell>{formatCurrency(sale.totalAmount)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          <div className="grid gap-12">
            <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    Product Performance
                  </p>
                  <h3 className="text-lg font-semibold">Top Moving Products</h3>
                </div>
                <PackageSearch className="size-4 text-primary" />
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Sold</TableHead>
                    <TableHead>Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(stats.topMoving ?? []).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-muted-foreground">
                        No movement data yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    (stats.topMoving ?? []).map((item, itemIndex) => (
                      <TableRow
                        key={item.sku}
                        className={
                          itemIndex % 2 === 1
                            ? "bg-muted/60 hover:bg-muted/70"
                            : undefined
                        }
                      >
                        <TableCell>
                          <p className="font-medium">{item.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {item.sku}
                          </p>
                        </TableCell>
                        <TableCell>
                          {item.soldQuantity} {item.unit}
                        </TableCell>
                        <TableCell>{formatCurrency(item.salesValue)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}
